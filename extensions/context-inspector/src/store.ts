import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { jsonUtf8Bytes } from "../../../src/infra/json-utf8-bytes.js";
import type {
  PluginHookAfterCompactionEvent,
  PluginHookAfterToolCallEvent,
  PluginHookAgentContext,
  PluginHookBeforeCompactionEvent,
  PluginHookBeforeToolCallEvent,
  PluginHookLlmInputEvent,
  PluginHookLlmOutputEvent,
  PluginLogger,
} from "../../../src/plugins/types.js";
import {
  applyAttentionProxy,
  buildBootstrapSectionOrigins,
  buildContextStages,
  buildCutFirstRecommendations,
  buildHistorySegments,
  buildOrigins,
  buildOptimizationSuggestions,
  buildPromptSegments,
  buildSystemSegments,
  computeDuplicateChars,
  computeNoiseScore,
  estimateTokens,
  extractThinkingTexts,
  linkSegmentsToOrigins,
  sanitizeUnknownValue,
} from "./analysis.js";
import type { ContextInspectorConfig } from "./config.js";
import type {
  ContextInspectorRunRecord,
  ContextInspectorRunSummary,
  InspectorOrigin,
} from "./types.js";

type PromptReportLike = {
  injectedWorkspaceFiles?: Array<{
    name?: string;
    path?: string;
    rawChars?: number;
    injectedChars?: number;
    truncated?: boolean;
    missing?: boolean;
  }>;
  skills?: {
    entries?: Array<{
      name?: string;
      blockChars?: number;
    }>;
  };
  tools?: {
    listChars?: number;
    schemaChars?: number;
    entries?: Array<{
      name?: string;
      summaryChars?: number;
      schemaChars?: number;
      propertiesCount?: number | null;
    }>;
  };
};

type BootstrapFileOrigin = {
  name: string;
  path: string;
  rawChars: number;
  injectedChars: number;
  truncated: boolean;
  missing?: boolean;
};

type CaptureDiagnostics = {
  droppedAfterToolCallEvents: number;
  droppedBeforeToolCallEvents: number;
  droppedCompactionEvents: number;
  skippedBootstrapEnrichments: number;
  flushCycles: number;
  flushedRuns: number;
  lastFlushAt?: number;
};

const PRUNE_WRITE_INTERVAL = 24;
const PRUNE_OVERFLOW_BUFFER = 24;
const MAX_BACKGROUND_SECTION_FILES = 12;
const MAX_DIRTY_RUNS_BEFORE_DEGRADE = 48;
const MAX_BACKGROUND_TASKS_BEFORE_DEGRADE = 16;
const FLUSH_DEBOUNCE_MS = 180;
const MAX_FLUSH_BATCH_SIZE = 24;

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function now() {
  return Date.now();
}

function timelineId(type: string) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortByUpdatedAtDesc<T extends { updatedAt: number }>(items: T[]): T[] {
  return items.toSorted((a, b) => b.updatedAt - a.updatedAt);
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
  );
  await fs.promises.writeFile(tmpPath, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.promises.rename(tmpPath, filePath);
}

function getTimelineSummary(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    return value.length > 220 ? `${value.slice(0, 220)}…` : value;
  }
  try {
    const raw = JSON.stringify(value);
    return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
  } catch {
    return undefined;
  }
}

function toRunSummary(record: ContextInspectorRunRecord): ContextInspectorRunSummary {
  return {
    runId: record.runId,
    sessionKey: record.sessionKey,
    provider: record.provider,
    model: record.model,
    startedAt: record.startedAt,
    updatedAt: record.updatedAt,
    status: record.status,
    chars: record.input.chars,
    estimatedTokens: record.input.estimatedTokens,
    noiseScore: record.input.noiseScore,
    duplicateChars: record.input.duplicateChars,
    toolCalls: record.counters.toolCalls,
    compactions: record.counters.compactions,
  };
}

function normalizeBootstrapOrigins(report?: PromptReportLike): BootstrapFileOrigin[] {
  return (report?.injectedWorkspaceFiles ?? [])
    .map((file) => ({
      name: typeof file.name === "string" ? file.name : path.basename(String(file.path ?? "")),
      path: typeof file.path === "string" ? file.path : "",
      rawChars: typeof file.rawChars === "number" ? file.rawChars : 0,
      injectedChars: typeof file.injectedChars === "number" ? file.injectedChars : 0,
      truncated: file.truncated === true,
      missing: file.missing === true,
    }))
    .filter((file) => file.path.length > 0);
}

function mergeOrigins(existing: InspectorOrigin[], next: InspectorOrigin[]): InspectorOrigin[] {
  const byId = new Map(existing.map((origin) => [origin.id, origin] as const));
  for (const origin of next) {
    byId.set(origin.id, origin);
  }
  return [...byId.values()];
}

export class ContextInspectorStore {
  private readonly runsDir: string;
  private readonly writeQueue = new Map<string, Promise<void>>();
  private readonly runCache = new Map<string, ContextInspectorRunRecord>();
  private readonly latestRunIdBySessionId = new Map<string, string>();
  private readonly summaryCache = new Map<string, ContextInspectorRunSummary>();
  private readonly backgroundTasks = new Set<Promise<void>>();
  private readonly dirtyRunIds = new Set<string>();
  private readonly diagnostics: CaptureDiagnostics = {
    droppedAfterToolCallEvents: 0,
    droppedBeforeToolCallEvents: 0,
    droppedCompactionEvents: 0,
    skippedBootstrapEnrichments: 0,
    flushCycles: 0,
    flushedRuns: 0,
  };

  private summariesLoaded = false;
  private summaryLoadPromise: Promise<void> | null = null;
  private pruneScheduled = false;
  private writesSincePrune = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushPromise: Promise<void> | null = null;
  private flushRequested = false;

  constructor(
    private readonly params: {
      rootDir: string;
      logger: PluginLogger;
      config: ContextInspectorConfig;
      openClawConfig?: unknown;
    },
  ) {
    this.runsDir = path.join(params.rootDir, "runs");
    ensureDir(this.runsDir);
  }

  private runPath(runId: string): string {
    return path.join(this.runsDir, `${runId}.json`);
  }

  private enqueue(runId: string, task: () => Promise<void>): Promise<void> {
    const previous = this.writeQueue.get(runId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    this.writeQueue.set(runId, next);
    return next.finally(() => {
      if (this.writeQueue.get(runId) === next) {
        this.writeQueue.delete(runId);
      }
    });
  }

  private rememberRun(record: ContextInspectorRunRecord) {
    this.runCache.set(record.runId, record);
    this.summaryCache.set(record.runId, toRunSummary(record));
    if (record.sessionId) {
      this.latestRunIdBySessionId.set(record.sessionId, record.runId);
    }
  }

  private forgetRun(runId: string) {
    this.runCache.delete(runId);
    this.summaryCache.delete(runId);
  }

  private readRun(runId: string): ContextInspectorRunRecord | null {
    const cached = this.runCache.get(runId);
    if (cached) {
      return cached;
    }
    const record = readJsonFile<ContextInspectorRunRecord>(this.runPath(runId));
    if (record) {
      this.rememberRun(record);
    }
    return record;
  }

  private stageRun(record: ContextInspectorRunRecord): void {
    this.rememberRun(record);
    this.dirtyRunIds.add(record.runId);
    this.scheduleFlush();
  }

  private scheduleFlush(immediate = false) {
    if (this.flushPromise) {
      this.flushRequested = true;
      return;
    }
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(
      () => {
        this.flushTimer = null;
        void this.flushDirtyRuns().catch((error) => {
          this.params.logger.warn(`context-inspector flush failed: ${String(error)}`);
        });
      },
      immediate ? 0 : FLUSH_DEBOUNCE_MS,
    );
  }

  private async flushDirtyRuns(): Promise<void> {
    if (this.flushPromise) {
      this.flushRequested = true;
      return this.flushPromise;
    }

    const runIds = [...this.dirtyRunIds].slice(0, MAX_FLUSH_BATCH_SIZE);
    if (runIds.length === 0) {
      return;
    }
    for (const runId of runIds) {
      this.dirtyRunIds.delete(runId);
    }

    this.flushPromise = (async () => {
      let flushed = 0;
      for (const runId of runIds) {
        const record = this.runCache.get(runId);
        if (!record) {
          continue;
        }
        await writeJsonAtomic(this.runPath(runId), record);
        flushed += 1;
      }
      this.diagnostics.flushCycles += 1;
      this.diagnostics.flushedRuns += flushed;
      this.diagnostics.lastFlushAt = now();
      this.writesSincePrune += flushed;
      this.schedulePrune();
    })().finally(() => {
      this.flushPromise = null;
      if (this.dirtyRunIds.size > 0 || this.flushRequested) {
        this.flushRequested = false;
        this.scheduleFlush(true);
      }
    });

    return this.flushPromise;
  }

  private schedulePrune() {
    if (this.pruneScheduled) {
      return;
    }
    const needsPruneSoon =
      this.writesSincePrune >= PRUNE_WRITE_INTERVAL ||
      this.summaryCache.size > this.params.config.capture.maxRuns + PRUNE_OVERFLOW_BUFFER;
    if (!needsPruneSoon) {
      return;
    }
    this.pruneScheduled = true;
    setTimeout(() => {
      void this.runPrune().catch((error) => {
        this.params.logger.warn(`context-inspector prune failed: ${String(error)}`);
      });
    }, 0);
  }

  private async runPrune(): Promise<void> {
    this.pruneScheduled = false;
    this.writesSincePrune = 0;

    const entries = await fs.promises
      .readdir(this.runsDir, { withFileTypes: true })
      .catch(() => []);
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const fullPath = path.join(this.runsDir, entry.name);
          const stats = await fs.promises.stat(fullPath);
          return { fullPath, runId: entry.name.replace(/\.json$/, ""), mtimeMs: stats.mtimeMs };
        }),
    );
    const overflow = files.length - this.params.config.capture.maxRuns;
    if (overflow <= 0) {
      return;
    }
    const victims = files.toSorted((a, b) => a.mtimeMs - b.mtimeMs).slice(0, overflow);
    await Promise.all(
      victims.map(async (victim) => {
        await fs.promises.unlink(victim.fullPath).catch(() => {});
        this.forgetRun(victim.runId);
      }),
    );
  }

  private async withRun(
    runId: string,
    updater: (
      record: ContextInspectorRunRecord | null,
    ) => Promise<ContextInspectorRunRecord | null>,
  ) {
    await this.enqueue(runId, async () => {
      const current = this.readRun(runId);
      const next = await updater(current);
      if (next) {
        this.stageRun(next);
      }
    });
  }

  private runBackground(label: string, task: () => Promise<void>) {
    let job: Promise<void>;
    job = task()
      .catch((error) => {
        this.params.logger.warn(`context-inspector ${label} failed: ${String(error)}`);
      })
      .finally(() => {
        this.backgroundTasks.delete(job);
      });
    this.backgroundTasks.add(job);
  }

  private isInDegradedMode(): boolean {
    return (
      this.dirtyRunIds.size >= MAX_DIRTY_RUNS_BEFORE_DEGRADE ||
      this.backgroundTasks.size >= MAX_BACKGROUND_TASKS_BEFORE_DEGRADE
    );
  }

  async recordLlmInput(event: PluginHookLlmInputEvent, ctx: PluginHookAgentContext): Promise<void> {
    const maxStringChars = this.params.config.capture.maxStringChars;
    const timestamp = now();
    const systemPrompt = String(sanitizeUnknownValue(event.systemPrompt ?? "", maxStringChars));
    const prompt = String(sanitizeUnknownValue(event.prompt, maxStringChars));
    const historyMessages = sanitizeUnknownValue(
      event.historyMessages,
      maxStringChars,
    ) as unknown[];
    const report = sanitizeUnknownValue(event.systemPromptReport, maxStringChars) as
      | PromptReportLike
      | undefined;

    let systemSegments = buildSystemSegments(systemPrompt);
    let promptSegments = buildPromptSegments(prompt);
    let historySegments = buildHistorySegments(historyMessages);
    const contextStages = buildContextStages(event.contextStages);
    const duplicateChars =
      computeDuplicateChars(systemPrompt) +
      computeDuplicateChars(prompt) +
      historySegments.reduce((sum, segment) => sum + segment.duplicateChars, 0);
    const totalChars =
      systemPrompt.length +
      prompt.length +
      historySegments.reduce((sum, segment) => sum + segment.chars, 0);
    const oversizedSegments = historySegments.filter((segment) => segment.chars > 8_000).length;
    const noiseScore = computeNoiseScore({
      totalChars,
      duplicateChars,
      oversizedSegments,
    });

    const bootstrapFiles = normalizeBootstrapOrigins(report);
    const origins = buildOrigins({
      systemSegments,
      promptSegments,
      historySegments,
      bootstrapFiles,
      skillEntries:
        (report?.skills?.entries ?? []).map((skill) => ({
          name: typeof skill.name === "string" ? skill.name : "skill",
          blockChars: typeof skill.blockChars === "number" ? skill.blockChars : 0,
        })) ?? [],
      toolListChars: typeof report?.tools?.listChars === "number" ? report.tools.listChars : 0,
      toolEntries:
        (report?.tools?.entries ?? []).map((tool) => ({
          name: typeof tool.name === "string" ? tool.name : "tool",
          summaryChars: typeof tool.summaryChars === "number" ? tool.summaryChars : 0,
          schemaChars: typeof tool.schemaChars === "number" ? tool.schemaChars : 0,
          propertiesCount:
            typeof tool.propertiesCount === "number" ? tool.propertiesCount : undefined,
        })) ?? [],
    });

    const linkedSegments = linkSegmentsToOrigins({
      systemSegments,
      promptSegments,
      historySegments,
      origins,
    });
    systemSegments = linkedSegments.systemSegments;
    promptSegments = linkedSegments.promptSegments;
    historySegments = linkedSegments.historySegments;

    const record: ContextInspectorRunRecord = {
      schemaVersion: 1,
      runId: event.runId,
      sessionId: event.sessionId,
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      workspaceDir: ctx.workspaceDir,
      trigger: ctx.trigger,
      channelId: ctx.channelId,
      provider: event.provider,
      model: event.model,
      startedAt: timestamp,
      updatedAt: timestamp,
      status: "capturing",
      imagesCount: event.imagesCount,
      input: {
        systemPrompt,
        prompt,
        historyMessages,
        systemSegments,
        promptSegments,
        historySegments,
        contextStages,
        origins,
        chars: totalChars,
        estimatedTokens: estimateTokens(totalChars),
        duplicateChars,
        noiseScore,
        suggestions: buildOptimizationSuggestions({
          totalChars,
          duplicateChars,
          systemSegments,
          historySegments,
          contextStages,
          origins,
          report,
        }),
        cutFirst: buildCutFirstRecommendations({
          origins,
          historySegments,
          contextStages,
        }),
        report: report as Record<string, unknown> | undefined,
      },
      timeline: [
        {
          id: timelineId("llm_input"),
          type: "llm_input",
          at: timestamp,
          title: "LLM input captured",
          summary: `${event.provider}/${event.model} · ${historySegments.length} history messages`,
          meta: {
            imagesCount: event.imagesCount,
            bytes: jsonUtf8Bytes(historyMessages),
          },
        },
      ],
      counters: {
        toolCalls: 0,
        compactions: 0,
      },
    };

    await this.withRun(event.runId, async () => record);
    this.scheduleBootstrapSectionEnrichment(event.runId, report);
  }

  async recordLlmOutput(
    event: PluginHookLlmOutputEvent,
    _ctx: PluginHookAgentContext,
  ): Promise<void> {
    const maxStringChars = this.params.config.capture.maxStringChars;
    await this.withRun(event.runId, async (record) => {
      if (!record) {
        return null;
      }
      const assistantTexts = event.assistantTexts.map((text) =>
        String(sanitizeUnknownValue(text, maxStringChars)),
      );
      const thinkingTexts = extractThinkingTexts(
        sanitizeUnknownValue(event.lastAssistant, maxStringChars),
        assistantTexts,
      );
      const outputChars = assistantTexts.reduce((sum, text) => sum + text.length, 0);
      record.input.systemSegments = applyAttentionProxy(
        record.input.systemSegments,
        assistantTexts,
      );
      record.input.promptSegments = applyAttentionProxy(
        record.input.promptSegments,
        assistantTexts,
      );
      record.input.historySegments = applyAttentionProxy(
        record.input.historySegments,
        assistantTexts,
      );
      record.output = {
        assistantTexts,
        thinkingTexts,
        usage: event.usage,
        chars: outputChars,
        estimatedTokens: estimateTokens(outputChars),
      };
      record.updatedAt = now();
      record.completedAt = record.updatedAt;
      record.status = "complete";
      record.timeline.push({
        id: timelineId("llm_output"),
        type: "llm_output",
        at: record.updatedAt,
        title: "LLM output captured",
        summary: `${assistantTexts.length} assistant blocks`,
        meta: {
          thinkingBlocks: thinkingTexts.length,
          outputChars,
          estimatedTokens: estimateTokens(outputChars),
          contextSegments:
            record.input.systemSegments.length +
            record.input.promptSegments.length +
            record.input.historySegments.length,
        },
      });
      record.input.suggestions = buildOptimizationSuggestions({
        totalChars: record.input.chars,
        duplicateChars: record.input.duplicateChars,
        systemSegments: record.input.systemSegments,
        historySegments: record.input.historySegments,
        contextStages: record.input.contextStages,
        origins: record.input.origins,
        report: record.input.report as PromptReportLike | null | undefined,
      });
      record.input.cutFirst = buildCutFirstRecommendations({
        origins: record.input.origins,
        historySegments: record.input.historySegments,
        contextStages: record.input.contextStages,
      });
      return record;
    });
  }

  async recordBeforeToolCall(
    event: PluginHookBeforeToolCallEvent,
    ctx: { runId?: string },
  ): Promise<void> {
    if (!ctx.runId) {
      return;
    }
    if (this.isInDegradedMode()) {
      this.diagnostics.droppedBeforeToolCallEvents += 1;
      return;
    }
    const maxStringChars = this.params.config.capture.maxStringChars;
    await this.withRun(ctx.runId, async (record) => {
      if (!record) {
        return null;
      }
      record.counters.toolCalls += 1;
      record.updatedAt = now();
      record.timeline.push({
        id: timelineId("before_tool_call"),
        type: "before_tool_call",
        at: record.updatedAt,
        title: `Tool call: ${event.toolName}`,
        summary: getTimelineSummary(sanitizeUnknownValue(event.params, maxStringChars)),
      });
      return record;
    });
  }

  async recordAfterToolCall(
    event: PluginHookAfterToolCallEvent,
    ctx: { runId?: string },
  ): Promise<void> {
    if (!ctx.runId) {
      return;
    }
    if (this.isInDegradedMode()) {
      this.diagnostics.droppedAfterToolCallEvents += 1;
      return;
    }
    const maxStringChars = this.params.config.capture.maxStringChars;
    await this.withRun(ctx.runId, async (record) => {
      if (!record) {
        return null;
      }
      record.updatedAt = now();
      record.timeline.push({
        id: timelineId("after_tool_call"),
        type: "after_tool_call",
        at: record.updatedAt,
        title: `Tool result: ${event.toolName}`,
        summary: event.error
          ? `Error: ${event.error}`
          : getTimelineSummary(sanitizeUnknownValue(event.result, maxStringChars)),
        meta: {
          durationMs: event.durationMs,
          toolCallId: event.toolCallId,
          hasResult: event.result !== undefined,
        },
      });
      return record;
    });
  }

  async recordBeforeCompaction(
    event: PluginHookBeforeCompactionEvent,
    ctx: PluginHookAgentContext,
  ): Promise<void> {
    if (!ctx.sessionId) {
      return;
    }
    if (this.isInDegradedMode()) {
      this.diagnostics.droppedCompactionEvents += 1;
      return;
    }
    const runId = this.latestRunIdBySessionId.get(ctx.sessionId);
    if (!runId) {
      return;
    }
    await this.withRun(runId, async (record) => {
      if (!record) {
        return null;
      }
      record.counters.compactions += 1;
      record.updatedAt = now();
      record.timeline.push({
        id: timelineId("before_compaction"),
        type: "before_compaction",
        at: record.updatedAt,
        title: "Compaction started",
        summary: `${event.messageCount} messages`,
        meta: {
          compactingCount: event.compactingCount,
          tokenCount: event.tokenCount,
          originalMessageCount: event.originalMessageCount,
          originalTokenCount: event.originalTokenCount,
          hasOriginalMessages: Array.isArray(event.originalMessages),
          hasCompactingMessages: Array.isArray(event.compactingMessages),
        },
      });
      return record;
    });
  }

  async recordAfterCompaction(
    event: PluginHookAfterCompactionEvent,
    ctx: PluginHookAgentContext,
  ): Promise<void> {
    if (!ctx.sessionId) {
      return;
    }
    if (this.isInDegradedMode()) {
      this.diagnostics.droppedCompactionEvents += 1;
      return;
    }
    const runId = this.latestRunIdBySessionId.get(ctx.sessionId);
    if (!runId) {
      return;
    }
    await this.withRun(runId, async (record) => {
      if (!record) {
        return null;
      }
      record.updatedAt = now();
      record.timeline.push({
        id: timelineId("after_compaction"),
        type: "after_compaction",
        at: record.updatedAt,
        title: "Compaction finished",
        summary: `${event.compactedCount} compacted / ${event.messageCount} messages`,
        meta: {
          tokenCount: event.tokenCount,
          tokensBefore: event.tokensBefore,
          summary: event.summary,
          firstKeptEntryId: event.firstKeptEntryId,
          hasMessages: Array.isArray(event.messages),
        },
      });
      return record;
    });
  }

  private scheduleBootstrapSectionEnrichment(runId: string, report?: PromptReportLike) {
    if (this.isInDegradedMode()) {
      this.diagnostics.skippedBootstrapEnrichments += 1;
      return;
    }
    const files = normalizeBootstrapOrigins(report)
      .filter((file) => !file.missing && file.path.length > 0)
      .slice(0, MAX_BACKGROUND_SECTION_FILES);
    if (files.length === 0) {
      return;
    }

    // File-section provenance is valuable, but it is never worth delaying the live model call.
    this.runBackground("bootstrap-enrichment", async () => {
      const contextFiles = await Promise.all(
        files.map(async (file) => {
          try {
            const content = await fs.promises.readFile(file.path, "utf8");
            return { path: file.path, content };
          } catch {
            return null;
          }
        }),
      );
      const sectionOrigins = buildBootstrapSectionOrigins(
        contextFiles.filter(
          (file): file is { path: string; content: string } =>
            Boolean(file?.path) && Boolean(file?.content),
        ),
      );
      if (sectionOrigins.length === 0) {
        return;
      }

      await this.withRun(runId, async (record) => {
        if (!record) {
          return null;
        }
        const origins = mergeOrigins(record.input.origins, sectionOrigins);
        const linkedSegments = linkSegmentsToOrigins({
          systemSegments: record.input.systemSegments,
          promptSegments: record.input.promptSegments,
          historySegments: record.input.historySegments,
          origins,
        });
        record.input.origins = origins;
        record.input.systemSegments = linkedSegments.systemSegments;
        record.input.promptSegments = linkedSegments.promptSegments;
        record.input.historySegments = linkedSegments.historySegments;
        record.updatedAt = now();
        record.input.suggestions = buildOptimizationSuggestions({
          totalChars: record.input.chars,
          duplicateChars: record.input.duplicateChars,
          systemSegments: record.input.systemSegments,
          historySegments: record.input.historySegments,
          contextStages: record.input.contextStages,
          origins: record.input.origins,
          report: record.input.report as PromptReportLike | null | undefined,
        });
        record.input.cutFirst = buildCutFirstRecommendations({
          origins: record.input.origins,
          historySegments: record.input.historySegments,
          contextStages: record.input.contextStages,
        });
        return record;
      });
    });
  }

  private async ensureSummariesLoaded(): Promise<void> {
    if (this.summariesLoaded) {
      return;
    }
    if (!this.summaryLoadPromise) {
      this.summaryLoadPromise = (async () => {
        const entries = await fs.promises
          .readdir(this.runsDir, { withFileTypes: true })
          .catch(() => []);
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith(".json")) {
            continue;
          }
          const record = readJsonFile<ContextInspectorRunRecord>(
            path.join(this.runsDir, entry.name),
          );
          if (record) {
            this.rememberRun(record);
          }
        }
        this.summariesLoaded = true;
      })().finally(() => {
        this.summaryLoadPromise = null;
      });
    }
    await this.summaryLoadPromise;
  }

  async listRuns(limit = 50): Promise<ContextInspectorRunSummary[]> {
    await this.ensureSummariesLoaded();
    return sortByUpdatedAtDesc([...this.summaryCache.values()]).slice(0, limit);
  }

  async listRunsDetailed(): Promise<ContextInspectorRunRecord[]> {
    const entries = await fs.promises
      .readdir(this.runsDir, { withFileTypes: true })
      .catch(() => []);
    const diskRecords = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readJsonFile<ContextInspectorRunRecord>(path.join(this.runsDir, entry.name)))
      .filter((entry): entry is ContextInspectorRunRecord => Boolean(entry));
    const recordsByRunId = new Map<string, ContextInspectorRunRecord>();
    for (const record of diskRecords) {
      recordsByRunId.set(record.runId, record);
      this.rememberRun(record);
    }
    for (const record of this.runCache.values()) {
      recordsByRunId.set(record.runId, record);
    }
    this.summariesLoaded = true;
    return [...recordsByRunId.values()];
  }

  async getRun(runId: string): Promise<ContextInspectorRunRecord | null> {
    return this.readRun(runId);
  }

  async getRunDiff(
    runId: string,
    baseRunId?: string,
  ): Promise<{
    current: ContextInspectorRunRecord;
    base: ContextInspectorRunRecord | null;
    metrics: {
      charsDelta: number;
      tokenDelta: number;
      noiseDelta: number;
      duplicateDelta: number;
    };
  } | null> {
    const current = this.readRun(runId);
    if (!current) {
      return null;
    }

    let base = baseRunId ? this.readRun(baseRunId) : null;
    if (!base) {
      const records = sortByUpdatedAtDesc(await this.listRunsDetailed()).filter(
        (record) =>
          record.runId !== current.runId &&
          (current.sessionKey
            ? record.sessionKey === current.sessionKey
            : record.sessionId === current.sessionId),
      );
      base = records[0] ?? null;
    }

    return {
      current,
      base,
      metrics: {
        charsDelta: current.input.chars - (base?.input.chars ?? 0),
        tokenDelta: current.input.estimatedTokens - (base?.input.estimatedTokens ?? 0),
        noiseDelta: current.input.noiseScore - (base?.input.noiseScore ?? 0),
        duplicateDelta: current.input.duplicateChars - (base?.input.duplicateChars ?? 0),
      },
    };
  }

  async exportDiagnostics(): Promise<{
    host: string;
    runCount: number;
    summaries: ContextInspectorRunSummary[];
    performance: {
      degraded: boolean;
      dirtyRuns: number;
      backgroundTasks: number;
      flushCycles: number;
      flushedRuns: number;
      lastFlushAt?: number;
      droppedBeforeToolCallEvents: number;
      droppedAfterToolCallEvents: number;
      droppedCompactionEvents: number;
      skippedBootstrapEnrichments: number;
    };
  }> {
    const summaries = await this.listRuns(30);
    return {
      host: os.hostname(),
      runCount: summaries.length,
      summaries: jsonClone(summaries),
      performance: {
        degraded: this.isInDegradedMode(),
        dirtyRuns: this.dirtyRunIds.size,
        backgroundTasks: this.backgroundTasks.size,
        flushCycles: this.diagnostics.flushCycles,
        flushedRuns: this.diagnostics.flushedRuns,
        lastFlushAt: this.diagnostics.lastFlushAt,
        droppedBeforeToolCallEvents: this.diagnostics.droppedBeforeToolCallEvents,
        droppedAfterToolCallEvents: this.diagnostics.droppedAfterToolCallEvents,
        droppedCompactionEvents: this.diagnostics.droppedCompactionEvents,
        skippedBootstrapEnrichments: this.diagnostics.skippedBootstrapEnrichments,
      },
    };
  }

  async flushForTesting(): Promise<void> {
    while (
      this.writeQueue.size > 0 ||
      this.backgroundTasks.size > 0 ||
      this.dirtyRunIds.size > 0 ||
      this.flushPromise
    ) {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
      if (this.dirtyRunIds.size > 0 && !this.flushPromise) {
        await this.flushDirtyRuns();
      }
      await Promise.allSettled([
        ...this.writeQueue.values(),
        ...this.backgroundTasks,
        ...(this.flushPromise ? [this.flushPromise] : []),
      ]);
    }
  }
}
