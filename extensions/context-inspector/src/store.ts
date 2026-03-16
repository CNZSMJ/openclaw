import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveBootstrapContextForRun } from "../../../src/agents/bootstrap-files.js";
import { buildSystemPromptReport } from "../../../src/agents/system-prompt-report.js";
import type { OpenClawConfig } from "../../../src/config/config.js";
import { resolveDefaultSessionStorePath } from "../../../src/config/sessions/paths.js";
import { loadSessionStore } from "../../../src/config/sessions/store.js";
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
  TimelineEventRecord,
} from "./types.js";

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

function collectRunSummaries(records: ContextInspectorRunRecord[]): ContextInspectorRunSummary[] {
  return records.map((record) => ({
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
  }));
}

export class ContextInspectorStore {
  private readonly runsDir: string;
  private readonly writeQueue = new Map<string, Promise<void>>();

  constructor(
    private readonly params: {
      rootDir: string;
      logger: PluginLogger;
      config: ContextInspectorConfig;
      openClawConfig: OpenClawConfig;
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

  private readRun(runId: string): ContextInspectorRunRecord | null {
    return readJsonFile<ContextInspectorRunRecord>(this.runPath(runId));
  }

  private async writeRun(record: ContextInspectorRunRecord): Promise<void> {
    await writeJsonAtomic(this.runPath(record.runId), record);
    await this.pruneOldRuns();
  }

  private async pruneOldRuns(): Promise<void> {
    const entries = await fs.promises.readdir(this.runsDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const fullPath = path.join(this.runsDir, entry.name);
          const stats = await fs.promises.stat(fullPath);
          return { fullPath, mtimeMs: stats.mtimeMs };
        }),
    );
    const overflow = files.length - this.params.config.capture.maxRuns;
    if (overflow <= 0) {
      return;
    }
    const victims = files.toSorted((a, b) => a.mtimeMs - b.mtimeMs).slice(0, overflow);
    await Promise.all(victims.map((victim) => fs.promises.unlink(victim.fullPath).catch(() => {})));
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
        await this.writeRun(next);
      }
    });
  }

  async recordLlmInput(event: PluginHookLlmInputEvent, ctx: PluginHookAgentContext): Promise<void> {
    const maxStringChars = this.params.config.capture.maxStringChars;
    const systemPrompt = String(sanitizeUnknownValue(event.systemPrompt ?? "", maxStringChars));
    const prompt = String(sanitizeUnknownValue(event.prompt, maxStringChars));
    const historyMessages = sanitizeUnknownValue(
      event.historyMessages,
      maxStringChars,
    ) as unknown[];

    const bootstrap = await resolveBootstrapContextForRun({
      workspaceDir: ctx.workspaceDir ?? process.cwd(),
      config: this.params.openClawConfig,
      sessionKey: ctx.sessionKey,
      sessionId: ctx.sessionId,
      agentId: ctx.agentId,
      warn: (message) => this.params.logger.warn(message),
    }).catch((error) => {
      this.params.logger.warn(`context-inspector bootstrap resolution failed: ${String(error)}`);
      return { bootstrapFiles: [], contextFiles: [] };
    });
    const contextFiles = sanitizeUnknownValue(bootstrap.contextFiles, maxStringChars) as Array<{
      path?: string;
      content?: string;
    }>;

    const estimatedReport = buildSystemPromptReport({
      source: "estimate",
      generatedAt: now(),
      sessionId: event.sessionId,
      sessionKey: ctx.sessionKey,
      provider: event.provider,
      model: event.model,
      workspaceDir: ctx.workspaceDir,
      bootstrapMaxChars: 0,
      bootstrapTotalMaxChars: 0,
      sandbox: undefined,
      systemPrompt,
      bootstrapFiles: bootstrap.bootstrapFiles,
      injectedFiles: bootstrap.contextFiles,
      skillsPrompt: "",
      tools: [],
    });
    const report =
      (sanitizeUnknownValue(event.systemPromptReport, maxStringChars) as
        | Record<string, unknown>
        | undefined) ?? (estimatedReport as unknown as Record<string, unknown>);

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
    const origins = buildOrigins({
      systemSegments,
      promptSegments,
      historySegments,
      bootstrapFiles:
        (
          report.injectedWorkspaceFiles as
            | Array<{
                name: string;
                path: string;
                rawChars: number;
                injectedChars: number;
                truncated: boolean;
                missing?: boolean;
              }>
            | undefined
        )?.map((file) => ({
          name: file.name,
          path: file.path,
          rawChars: file.rawChars,
          injectedChars: file.injectedChars,
          truncated: file.truncated,
          missing: file.missing,
        })) ?? [],
      skillEntries:
        (
          report.skills as
            | {
                entries?: Array<{
                  name: string;
                  blockChars: number;
                }>;
              }
            | undefined
        )?.entries ?? [],
      toolListChars:
        (
          report.tools as
            | {
                listChars?: number;
              }
            | undefined
        )?.listChars ?? 0,
      toolEntries:
        (
          report.tools as
            | {
                entries?: Array<{
                  name: string;
                  summaryChars: number;
                  schemaChars: number;
                  propertiesCount?: number | null;
                }>;
              }
            | undefined
        )?.entries ?? [],
    });
    origins.push(
      ...buildBootstrapSectionOrigins(
        contextFiles
          .map((file) => ({
            path: typeof file.path === "string" ? file.path : "",
            content: typeof file.content === "string" ? file.content : "",
          }))
          .filter((file) => file.path.length > 0 && file.content.length > 0),
      ),
    );
    const linkedSegments = linkSegmentsToOrigins({
      systemSegments,
      promptSegments,
      historySegments,
      origins,
    });
    systemSegments = linkedSegments.systemSegments;
    promptSegments = linkedSegments.promptSegments;
    historySegments = linkedSegments.historySegments;

    const timeline: TimelineEventRecord[] = [
      {
        id: timelineId("llm_input"),
        type: "llm_input",
        at: now(),
        title: "LLM input captured",
        summary: `${event.provider}/${event.model} · ${historySegments.length} history messages`,
        meta: {
          imagesCount: event.imagesCount,
          bytes: jsonUtf8Bytes(historyMessages),
        },
      },
    ];

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
      startedAt: now(),
      updatedAt: now(),
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
        report,
      },
      timeline,
      counters: {
        toolCalls: 0,
        compactions: 0,
      },
    };

    await this.withRun(event.runId, async () => record);
  }

  async recordLlmOutput(
    event: PluginHookLlmOutputEvent,
    ctx: PluginHookAgentContext,
  ): Promise<void> {
    await this.withRun(event.runId, async (record) => {
      if (!record) {
        return null;
      }
      const thinkingTexts = extractThinkingTexts(
        sanitizeUnknownValue(event.lastAssistant, this.params.config.capture.maxStringChars),
        event.assistantTexts,
      );
      const outputChars = event.assistantTexts.reduce((sum, text) => sum + text.length, 0);
      const output = {
        assistantTexts: [...event.assistantTexts],
        thinkingTexts,
        usage: event.usage,
        chars: outputChars,
        estimatedTokens: estimateTokens(outputChars),
      };
      const combinedSegments = [
        ...record.input.systemSegments,
        ...record.input.promptSegments,
        ...record.input.historySegments,
      ];
      record.input.systemSegments = applyAttentionProxy(
        record.input.systemSegments,
        event.assistantTexts,
      );
      record.input.promptSegments = applyAttentionProxy(
        record.input.promptSegments,
        event.assistantTexts,
      );
      record.input.historySegments = applyAttentionProxy(
        record.input.historySegments,
        event.assistantTexts,
      );
      record.output = output;
      record.updatedAt = now();
      record.completedAt = now();
      record.status = "complete";
      record.timeline.push({
        id: timelineId("llm_output"),
        type: "llm_output",
        at: now(),
        title: "LLM output captured",
        summary: `${event.assistantTexts.length} assistant blocks`,
        meta: {
          thinkingBlocks: thinkingTexts.length,
          outputChars,
          estimatedTokens: estimateTokens(outputChars),
          contextSegments: combinedSegments.length,
        },
      });

      const report = await this.tryLoadSystemPromptReport(ctx);
      if (report) {
        record.input.report = report as Record<string, unknown>;
      }
      record.input.suggestions = buildOptimizationSuggestions({
        totalChars: record.input.chars,
        duplicateChars: record.input.duplicateChars,
        systemSegments: record.input.systemSegments,
        historySegments: record.input.historySegments,
        contextStages: record.input.contextStages,
        origins: record.input.origins,
        report: record.input.report as {
          injectedWorkspaceFiles?: Array<{
            name?: string;
            path?: string;
            rawChars?: number;
            injectedChars?: number;
            truncated?: boolean;
            missing?: boolean;
          }>;
          tools?: { schemaChars?: number };
        },
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
    await this.withRun(ctx.runId, async (record) => {
      if (!record) {
        return null;
      }
      record.counters.toolCalls += 1;
      record.updatedAt = now();
      record.timeline.push({
        id: timelineId("before_tool_call"),
        type: "before_tool_call",
        at: now(),
        title: `Tool call: ${event.toolName}`,
        summary: getTimelineSummary(event.params),
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
    await this.withRun(ctx.runId, async (record) => {
      if (!record) {
        return null;
      }
      record.updatedAt = now();
      record.timeline.push({
        id: timelineId("after_tool_call"),
        type: "after_tool_call",
        at: now(),
        title: `Tool result: ${event.toolName}`,
        summary: event.error ? `Error: ${event.error}` : getTimelineSummary(event.result),
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
    const runId = await this.findLatestRunIdForSession(ctx.sessionId);
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
        at: now(),
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
    const runId = await this.findLatestRunIdForSession(ctx.sessionId);
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
        at: now(),
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

  private async tryLoadSystemPromptReport(
    ctx: PluginHookAgentContext,
  ): Promise<unknown | undefined> {
    if (!ctx.sessionKey) {
      return undefined;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      const storePath = resolveDefaultSessionStorePath(ctx.agentId);
      const store = loadSessionStore(storePath, { skipCache: true });
      return (store[ctx.sessionKey] as { systemPromptReport?: unknown } | undefined)
        ?.systemPromptReport;
    } catch (error) {
      this.params.logger.warn(`context-inspector session report lookup failed: ${String(error)}`);
      return undefined;
    }
  }

  private async findLatestRunIdForSession(sessionId: string): Promise<string | undefined> {
    const records = await this.listRunsDetailed();
    return sortByUpdatedAtDesc(records).find((record) => record.sessionId === sessionId)?.runId;
  }

  async listRuns(limit = 50): Promise<ContextInspectorRunSummary[]> {
    const records = await this.listRunsDetailed();
    return collectRunSummaries(sortByUpdatedAtDesc(records).slice(0, limit));
  }

  async listRunsDetailed(): Promise<ContextInspectorRunRecord[]> {
    const entries = await fs.promises
      .readdir(this.runsDir, { withFileTypes: true })
      .catch(() => []);
    const records = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readJsonFile<ContextInspectorRunRecord>(path.join(this.runsDir, entry.name)))
      .filter((entry): entry is ContextInspectorRunRecord => Boolean(entry));
    return records;
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
        (record) => record.sessionKey === current.sessionKey && record.runId !== current.runId,
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
  }> {
    const summaries = await this.listRuns(30);
    return {
      host: os.hostname(),
      runCount: summaries.length,
      summaries: jsonClone(summaries),
    };
  }
}
