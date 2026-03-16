import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { redactSensitiveText } from "../../../src/logging/redact.js";
import type {
  ContextStageRecord,
  InspectorOrigin,
  InspectorSegment,
  OptimizationOpportunity,
  OptimizationSuggestion,
} from "./types.js";

const CHARS_PER_TOKEN_ESTIMATE = 4;
const SECTION_HEADING_RE = /^(#{1,3})\s+(.+?)\s*$/gm;
const WORD_RE = /[a-z0-9][a-z0-9_-]{2,}/gi;

export function estimateTokens(chars: number): number {
  return Math.ceil(Math.max(0, chars) / CHARS_PER_TOKEN_ESTIMATE);
}

function normalizeLine(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function computeDuplicateChars(text: string): number {
  const counts = new Map<string, number>();
  let duplicateChars = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeLine(rawLine);
    if (line.length < 24) {
      continue;
    }
    const seen = counts.get(line) ?? 0;
    if (seen >= 1) {
      duplicateChars += rawLine.length;
    }
    counts.set(line, seen + 1);
  }
  return duplicateChars;
}

export function computeNoiseScore(params: {
  totalChars: number;
  duplicateChars: number;
  oversizedSegments: number;
}): number {
  if (params.totalChars <= 0) {
    return 0;
  }
  const duplicateRatio = params.duplicateChars / params.totalChars;
  const oversizeRatio = Math.min(1, params.oversizedSegments / 6);
  return Math.min(100, Math.round(duplicateRatio * 70 + oversizeRatio * 30));
}

export function sanitizeUnknownValue(value: unknown, maxStringChars: number): unknown {
  return sanitizeUnknownValueInner(value, maxStringChars, 0);
}

function sanitizeUnknownValueInner(value: unknown, maxStringChars: number, depth: number): unknown {
  if (value == null) {
    return value;
  }
  if (typeof value === "string") {
    const safe = redactSensitiveText(value, { mode: "tools" });
    if (safe.length <= maxStringChars) {
      return safe;
    }
    return `${safe.slice(0, maxStringChars)}\n…[truncated by context-inspector]`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (depth >= 8) {
    return "[omitted: depth]";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeUnknownValueInner(entry, maxStringChars, depth + 1));
  }
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(input)) {
      if (
        (key === "data" || key === "image" || key === "thinkingSignature") &&
        typeof entry === "string"
      ) {
        output[key] = "[omitted binary or signature data]";
        continue;
      }
      output[key] = sanitizeUnknownValueInner(entry, maxStringChars, depth + 1);
    }
    return output;
  }
  return String(value);
}

function splitSections(text: string): Array<{ label: string; text: string }> {
  const matches = Array.from(text.matchAll(SECTION_HEADING_RE));
  if (matches.length === 0) {
    return [{ label: "Preamble", text }];
  }
  const sections: Array<{ label: string; text: string }> = [];
  let cursor = 0;
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const start = match.index ?? 0;
    if (start > cursor) {
      const preamble = text.slice(cursor, start).trim();
      if (preamble) {
        sections.push({ label: "Preamble", text: preamble });
      }
    }
    const nextStart = matches[i + 1]?.index ?? text.length;
    const label = match[2]?.trim() || `Section ${i + 1}`;
    const block = text.slice(start, nextStart).trim();
    if (block) {
      sections.push({ label, text: block });
    }
    cursor = nextStart;
  }
  return sections;
}

function normalizeBlockText(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
}

function createSectionFingerprint(value: string): string {
  const normalized = normalizeBlockText(value);
  return `${normalized.length}:${normalized.slice(0, 200)}`;
}

function asText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => asText(entry))
      .filter(Boolean)
      .join("\n");
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const input = value as Record<string, unknown>;
  if (typeof input.text === "string") {
    return input.text;
  }
  if (typeof input.thinking === "string") {
    return input.thinking;
  }
  if (typeof input.content === "string") {
    return input.content;
  }
  if (Array.isArray(input.content)) {
    return input.content
      .map((entry) => asText(entry))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function buildSystemSegments(systemPrompt: string): InspectorSegment[] {
  return splitSections(systemPrompt).map((section, index) => {
    const chars = section.text.length;
    return {
      id: `system-${index}`,
      lane: "system",
      label: section.label,
      originId: `origin-system-${index}`,
      chars,
      estimatedTokens: estimateTokens(chars),
      text: section.text,
      duplicateChars: computeDuplicateChars(section.text),
    };
  });
}

export function buildPromptSegments(prompt: string): InspectorSegment[] {
  const chars = prompt.length;
  return [
    {
      id: "prompt-0",
      lane: "prompt",
      label: "User Prompt",
      originId: "origin-prompt-0",
      chars,
      estimatedTokens: estimateTokens(chars),
      text: prompt,
      duplicateChars: computeDuplicateChars(prompt),
    },
  ];
}

export function buildHistorySegments(historyMessages: unknown[]): InspectorSegment[] {
  return historyMessages.map((message, index) => {
    const role =
      message &&
      typeof message === "object" &&
      typeof (message as Record<string, unknown>).role === "string"
        ? String((message as Record<string, unknown>).role)
        : "message";
    const text = asText(message);
    const chars = text.length;
    return {
      id: `history-${index}`,
      lane: "history",
      label: `${role} ${index + 1}`,
      originId: `origin-history-${index}`,
      chars,
      estimatedTokens: estimateTokens(chars),
      text,
      duplicateChars: computeDuplicateChars(text),
      metadata: message && typeof message === "object" ? { role } : undefined,
    };
  });
}

export function buildOrigins(params: {
  systemSegments: InspectorSegment[];
  promptSegments: InspectorSegment[];
  historySegments: InspectorSegment[];
  bootstrapFiles?: Array<{
    name: string;
    path: string;
    rawChars: number;
    injectedChars: number;
    truncated: boolean;
    missing?: boolean;
  }>;
  skillEntries?: Array<{
    name: string;
    blockChars: number;
  }>;
  toolListChars?: number;
  toolEntries?: Array<{
    name: string;
    summaryChars: number;
    schemaChars: number;
    propertiesCount?: number | null;
  }>;
  thinkingTexts?: string[];
  usageTotal?: number;
}): InspectorOrigin[] {
  const origins: InspectorOrigin[] = [];
  for (const [index, segment] of params.systemSegments.entries()) {
    origins.push({
      id: `origin-system-${index}`,
      kind: "system-section",
      label: segment.label,
      chars: segment.chars,
      estimatedTokens: segment.estimatedTokens,
      metadata: { lane: "system" },
    });
  }
  for (const [index, segment] of params.promptSegments.entries()) {
    origins.push({
      id: `origin-prompt-${index}`,
      kind: "user-prompt",
      label: segment.label,
      chars: segment.chars,
      estimatedTokens: segment.estimatedTokens,
    });
  }
  for (const [index, segment] of params.historySegments.entries()) {
    origins.push({
      id: `origin-history-${index}`,
      kind: "history-message",
      label: segment.label,
      chars: segment.chars,
      estimatedTokens: segment.estimatedTokens,
      metadata: segment.metadata,
    });
  }
  for (const file of params.bootstrapFiles ?? []) {
    origins.push({
      id: `origin-file-${file.path}`,
      kind: "bootstrap-file",
      label: file.name,
      path: file.path,
      chars: file.injectedChars,
      estimatedTokens: estimateTokens(file.injectedChars),
      truncated: file.truncated,
      metadata: {
        rawChars: file.rawChars,
        injectedChars: file.injectedChars,
        missing: file.missing === true,
      },
    });
  }
  for (const [index, skill] of (params.skillEntries ?? []).entries()) {
    origins.push({
      id: `origin-skill-${index}`,
      kind: "skill",
      label: skill.name,
      chars: skill.blockChars,
      estimatedTokens: estimateTokens(skill.blockChars),
      metadata: {
        blockChars: skill.blockChars,
      },
    });
  }
  if ((params.toolListChars ?? 0) > 0) {
    origins.push({
      id: "origin-tool-list",
      kind: "tool-list",
      label: "Tool list",
      chars: params.toolListChars ?? 0,
      estimatedTokens: estimateTokens(params.toolListChars ?? 0),
    });
  }
  for (const [index, tool] of (params.toolEntries ?? []).entries()) {
    const chars = tool.schemaChars + tool.summaryChars;
    origins.push({
      id: `origin-tool-schema-${index}`,
      kind: "tool-schema",
      label: tool.name,
      chars,
      estimatedTokens: estimateTokens(chars),
      metadata: {
        summaryChars: tool.summaryChars,
        schemaChars: tool.schemaChars,
        propertiesCount: tool.propertiesCount,
      },
    });
  }
  for (const [index, text] of (params.thinkingTexts ?? []).entries()) {
    origins.push({
      id: `origin-thinking-${index}`,
      kind: "thinking",
      label: `Thinking ${index + 1}`,
      chars: text.length,
      estimatedTokens: estimateTokens(text.length),
    });
  }
  if (typeof params.usageTotal === "number") {
    origins.push({
      id: "origin-usage",
      kind: "usage",
      label: "Provider Usage",
      chars: params.usageTotal,
      estimatedTokens: params.usageTotal,
    });
  }
  return origins;
}

export function buildBootstrapSectionOrigins(
  contextFiles: Array<{
    path: string;
    content: string;
  }>,
): InspectorOrigin[] {
  const origins: InspectorOrigin[] = [];
  for (const file of contextFiles) {
    const filePath = typeof file.path === "string" ? file.path.trim() : "";
    const content = typeof file.content === "string" ? file.content : "";
    if (!filePath || !content) {
      continue;
    }
    const sections = splitSections(content).filter((section) => section.text.trim().length > 0);
    for (const [index, section] of sections.entries()) {
      const chars = section.text.length;
      origins.push({
        id: `origin-file-section-${filePath}-${index}`,
        kind: "bootstrap-file-section",
        label: section.label,
        path: filePath,
        chars,
        estimatedTokens: estimateTokens(chars),
        metadata: {
          filePath,
          sectionIndex: index,
          sectionLabel: section.label,
          fingerprint: createSectionFingerprint(section.text),
        },
      });
    }
  }
  return origins;
}

export function linkSegmentsToOrigins(params: {
  systemSegments: InspectorSegment[];
  promptSegments: InspectorSegment[];
  historySegments: InspectorSegment[];
  origins: InspectorOrigin[];
}): {
  systemSegments: InspectorSegment[];
  promptSegments: InspectorSegment[];
  historySegments: InspectorSegment[];
} {
  const originById = new Map<string, InspectorOrigin>(
    params.origins.map((origin) => [origin.id, origin] as const),
  );
  const bootstrapSectionEntries = params.origins
    .filter((origin): origin is InspectorOrigin => origin.kind === "bootstrap-file-section")
    .map((origin) => {
      const fingerprint = String(
        (origin.metadata as Record<string, unknown> | undefined)?.fingerprint ?? "",
      );
      return [fingerprint, origin] as const;
    })
    .filter((entry) => entry[0].length > 0);
  const bootstrapSectionByText = new Map<string, InspectorOrigin>(bootstrapSectionEntries);
  const bootstrapByLabel = new Map(
    params.origins
      .filter(
        (origin) => origin.kind === "bootstrap-file" || origin.kind === "bootstrap-file-section",
      )
      .flatMap((origin) => {
        const keys = [origin.label, origin.path].filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        );
        return keys.map((key) => [key, origin] as const);
      }),
  );

  const applyOriginMetadata = (segment: InspectorSegment, fallbackOriginId?: string) => {
    const bootstrapSectionOrigin =
      segment.lane === "system"
        ? bootstrapSectionByText.get(createSectionFingerprint(segment.text))
        : undefined;
    const bootstrapOrigin =
      segment.lane === "system" ? bootstrapByLabel.get(segment.label) : undefined;
    const originId =
      bootstrapSectionOrigin?.id ?? bootstrapOrigin?.id ?? segment.originId ?? fallbackOriginId;
    const origin = originId ? originById.get(originId) : bootstrapOrigin;
    if (!origin) {
      return segment;
    }
    return {
      ...segment,
      originId: origin.id,
      metadata: {
        ...(segment.metadata ?? {}),
        originKind: origin.kind,
        originLabel: origin.label,
        originPath: origin.path,
      },
    };
  };

  return {
    systemSegments: params.systemSegments.map((segment, index) =>
      applyOriginMetadata(segment, `origin-system-${index}`),
    ),
    promptSegments: params.promptSegments.map((segment, index) =>
      applyOriginMetadata(segment, `origin-prompt-${index}`),
    ),
    historySegments: params.historySegments.map((segment, index) =>
      applyOriginMetadata(segment, `origin-history-${index}`),
    ),
  };
}

export function extractThinkingTexts(lastAssistant: unknown, assistantTexts: string[]): string[] {
  const thinking: string[] = [];
  walkForThinking(lastAssistant, thinking);
  if (thinking.length === 0) {
    for (const text of assistantTexts) {
      if (text.toLowerCase().includes("thinking")) {
        thinking.push(text);
      }
    }
  }
  return thinking;
}

function walkForThinking(value: unknown, output: string[]) {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkForThinking(entry, output);
    }
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  const input = value as Record<string, unknown>;
  if (input.type === "thinking" && typeof input.thinking === "string") {
    output.push(input.thinking);
  }
  for (const entry of Object.values(input)) {
    walkForThinking(entry, output);
  }
}

function tokenize(text: string): string[] {
  return Array.from(text.toLowerCase().matchAll(WORD_RE), (match) => match[0] ?? "");
}

export function applyAttentionProxy(
  segments: InspectorSegment[],
  assistantTexts: string[],
): InspectorSegment[] {
  const answerTokens = new Set(tokenize(assistantTexts.join("\n")));
  if (answerTokens.size === 0) {
    return segments;
  }
  return segments.map((segment) => {
    const segmentTokens = tokenize(segment.text);
    if (segmentTokens.length === 0) {
      return segment;
    }
    let hits = 0;
    for (const token of segmentTokens) {
      if (answerTokens.has(token)) {
        hits += 1;
      }
    }
    return {
      ...segment,
      attentionProxyScore: Math.round((hits / segmentTokens.length) * 100),
    };
  });
}

export function summarizeHistoryMessages(messages: unknown[]): AgentMessage[] {
  return messages as AgentMessage[];
}

export function buildContextStages(
  stages: Array<{
    stage: ContextStageRecord["stage"];
    messages: unknown[];
    messageCount: number;
    estimatedTokens?: number;
  }> = [],
): ContextStageRecord[] {
  let previousChars = 0;
  let previousTokens = 0;
  let previousDuplicateChars = 0;

  return stages.map((stage) => {
    const historySegments = buildHistorySegments(stage.messages);
    const chars = historySegments.reduce((sum, segment) => sum + segment.chars, 0);
    const duplicateChars = historySegments.reduce(
      (sum, segment) => sum + segment.duplicateChars,
      0,
    );
    const tokenCount = stage.estimatedTokens;
    const record: ContextStageRecord = {
      stage: stage.stage,
      messageCount: stage.messageCount,
      estimatedTokens: tokenCount,
      chars,
      duplicateChars,
      charsDelta: chars - previousChars,
      tokenDelta: typeof tokenCount === "number" ? tokenCount - previousTokens : undefined,
      duplicateDelta: duplicateChars - previousDuplicateChars,
      messages: stage.messages,
    };
    previousChars = chars;
    previousTokens = typeof tokenCount === "number" ? tokenCount : previousTokens;
    previousDuplicateChars = duplicateChars;
    return record;
  });
}

type PromptReportLike = {
  injectedWorkspaceFiles?: Array<{
    name?: string;
    path?: string;
    rawChars?: number;
    injectedChars?: number;
    truncated?: boolean;
    missing?: boolean;
  }>;
  tools?: {
    schemaChars?: number;
  };
};

export function buildOptimizationSuggestions(params: {
  totalChars: number;
  duplicateChars: number;
  systemSegments: InspectorSegment[];
  historySegments: InspectorSegment[];
  contextStages?: ContextStageRecord[];
  origins?: InspectorOrigin[];
  report?: PromptReportLike | null;
}): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  const duplicateRatio = params.totalChars > 0 ? params.duplicateChars / params.totalChars : 0;
  const workspaceFiles = params.report?.injectedWorkspaceFiles ?? [];
  const truncatedFiles = workspaceFiles.filter((file) => file.truncated);
  const largestHistory = [...params.historySegments].sort((a, b) => b.chars - a.chars)[0];
  const largestBootstrapOrigin = [...(params.origins ?? [])]
    .filter((origin) => origin.kind === "bootstrap-file")
    .sort((a, b) => b.chars - a.chars)[0];
  const historyLimitedStage = params.contextStages?.find(
    (stage) => stage.stage === "history-limited",
  );
  const contextEngineStage = params.contextStages?.find(
    (stage) => stage.stage === "context-engine-assembled",
  );
  const projectContextSegment = params.systemSegments.find((segment) =>
    segment.label.toLowerCase().includes("project context"),
  );
  const projectContextChars = projectContextSegment?.chars ?? 0;
  const toolSchemaChars =
    typeof params.report?.tools?.schemaChars === "number" ? params.report.tools.schemaChars : 0;

  if (truncatedFiles.length > 0) {
    const file = truncatedFiles[0];
    suggestions.push({
      id: "truncated-bootstrap",
      severity: "danger",
      title: "Bootstrap context is already truncating",
      detail: `${truncatedFiles.length} injected workspace file(s) are truncated before the model sees them.`,
      action:
        "Cut the largest bootstrap markdown files first or raise bootstrap limits intentionally.",
      evidence: `${file.name ?? "file"} · raw ${file.rawChars ?? 0} chars -> injected ${file.injectedChars ?? 0} chars`,
    });
  }

  if (duplicateRatio >= 0.08) {
    suggestions.push({
      id: "duplication",
      severity: duplicateRatio >= 0.16 ? "danger" : "warn",
      title: "Repeated instructions or history are inflating context",
      detail: `${Math.round(duplicateRatio * 100)}% of the captured text looks duplicated at the line level.`,
      action:
        "Deduplicate repeated policy blocks, repeated tool output, and repeated session reminders.",
      evidence: `${params.duplicateChars} duplicate chars across the captured context`,
    });
  }

  if (largestHistory && largestHistory.chars >= 12_000) {
    suggestions.push({
      id: "oversized-history",
      severity: "warn",
      title: "One history message is disproportionately large",
      detail:
        "The largest history segment is much bigger than a normal turn and likely dominates attention.",
      action:
        "Trim oversized tool results or summarize older long turns before they re-enter context.",
      evidence: `${largestHistory.label} · ${largestHistory.chars} chars`,
    });
  }

  if (
    largestBootstrapOrigin &&
    largestBootstrapOrigin.chars >= 8_000 &&
    largestBootstrapOrigin.chars / Math.max(1, params.totalChars) >= 0.2
  ) {
    suggestions.push({
      id: "largest-bootstrap-origin",
      severity: largestBootstrapOrigin.truncated ? "danger" : "warn",
      title: "One injected workspace file is dominating static context",
      detail:
        "A single bootstrap file is taking a large share of the prompt budget before conversation turns are considered.",
      action:
        "Split this file into always-on guidance versus on-demand reference material, or reduce the injected section size.",
      evidence: `${largestBootstrapOrigin.path ?? largestBootstrapOrigin.label} · ${largestBootstrapOrigin.chars} chars`,
    });
  }

  if (projectContextChars > 0 && projectContextChars / Math.max(1, params.totalChars) >= 0.35) {
    suggestions.push({
      id: "heavy-project-context",
      severity: "warn",
      title: "Project context dominates the prompt budget",
      detail:
        "Static workspace context is taking a large share of the prompt before conversation history is considered.",
      action:
        "Split always-needed rules from optional reference material and load the optional material on demand.",
      evidence: `Project Context section ≈ ${projectContextChars} chars`,
    });
  }

  if (toolSchemaChars >= 20_000) {
    suggestions.push({
      id: "heavy-tool-schema",
      severity: "info",
      title: "Tool schema overhead is noticeable",
      detail: "Tool JSON schema size is large enough to materially affect context cost.",
      action:
        "Hide rarely used tools from default sessions or move bulky tools behind narrower activation rules.",
      evidence: `Tool schema payload ≈ ${toolSchemaChars} chars`,
    });
  }

  if (
    historyLimitedStage &&
    (historyLimitedStage.charsDelta <= -6_000 || (historyLimitedStage.tokenDelta ?? 0) <= -1_500)
  ) {
    suggestions.push({
      id: "history-limit-hit",
      severity: "warn",
      title: "History limiting is doing heavy last-second trimming",
      detail:
        "A large amount of transcript was removed immediately before the model call, which usually means earlier compaction or summarization should happen sooner.",
      action:
        "Trim oversized tool results earlier, summarize stale turns, or lower the retained turn budget for this session type.",
      evidence: `${prettySignedNumber(historyLimitedStage.charsDelta)} chars · ${prettySignedNumber(historyLimitedStage.tokenDelta ?? 0)} tok at history limit stage`,
    });
  }

  if (
    contextEngineStage &&
    (contextEngineStage.charsDelta >= 4_000 || (contextEngineStage.tokenDelta ?? 0) >= 1_000)
  ) {
    suggestions.push({
      id: "context-engine-growth",
      severity: "info",
      title: "Context engine additions materially increase prompt size",
      detail:
        "Retrieved or assembled context is adding a meaningful chunk of prompt budget late in the pipeline.",
      action:
        "Tighten retrieval gating, reduce broad project injections, or prefer narrower context-engine additions.",
      evidence: `+${contextEngineStage.charsDelta} chars · +${contextEngineStage.tokenDelta ?? 0} tok at context-engine stage`,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "healthy-default",
      severity: "info",
      title: "No acute prompt hygiene issue detected",
      detail:
        "The captured run does not show a dominant truncation, duplication, or oversized-history problem.",
      action: "Use diff mode across a few more real sessions before changing system prompt policy.",
    });
  }

  return suggestions;
}

function prettySignedNumber(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

export function buildCutFirstRecommendations(params: {
  origins: InspectorOrigin[];
  historySegments: InspectorSegment[];
  contextStages?: ContextStageRecord[];
}): OptimizationOpportunity[] {
  const opportunities: OptimizationOpportunity[] = [];
  const historyLimitedStage = params.contextStages?.find(
    (stage) => stage.stage === "history-limited",
  );

  for (const origin of params.origins) {
    if (origin.kind === "bootstrap-file-section" && origin.chars >= 1_500) {
      opportunities.push({
        id: `cut-${origin.id}`,
        kind: "bootstrap-file-section",
        title: `${origin.label}`,
        chars: origin.chars,
        estimatedTokens: origin.estimatedTokens,
        reason: "Large always-on section inside an injected workspace file.",
        action:
          "Move this section to on-demand context or compress it into shorter operating rules.",
        originId: origin.id,
        path: origin.path,
      });
    }
    if (origin.kind === "bootstrap-file" && origin.chars >= 4_000) {
      opportunities.push({
        id: `cut-${origin.id}`,
        kind: "bootstrap-file",
        title: origin.label,
        chars: origin.chars,
        estimatedTokens: origin.estimatedTokens,
        reason: origin.truncated
          ? "Large injected file is already being truncated before the model sees it."
          : "Large injected file consumes a notable share of prompt budget.",
        action: "Split always-needed guidance from archival reference material.",
        originId: origin.id,
        path: origin.path,
      });
    }
    if (origin.kind === "tool-schema" && origin.chars >= 1_500) {
      opportunities.push({
        id: `cut-${origin.id}`,
        kind: "tool-schema",
        title: origin.label,
        chars: origin.chars,
        estimatedTokens: origin.estimatedTokens,
        reason: "Tool schema overhead grows every run even when the tool is unused.",
        action: "Hide this tool behind narrower activation rules or a smaller default toolset.",
        originId: origin.id,
      });
    }
    if (origin.kind === "tool-list" && origin.chars >= 800) {
      opportunities.push({
        id: `cut-${origin.id}`,
        kind: "tool-list",
        title: origin.label,
        chars: origin.chars,
        estimatedTokens: origin.estimatedTokens,
        reason: "Tool list guidance is large enough to be noticeable in every run.",
        action:
          "Reduce always-visible tool guidance or group seldom-used tools out of the default list.",
        originId: origin.id,
      });
    }
  }

  for (const segment of params.historySegments) {
    if (segment.chars < 6_000) {
      continue;
    }
    opportunities.push({
      id: `cut-${segment.id}`,
      kind: "history-message",
      title: segment.label,
      chars: segment.chars,
      estimatedTokens: segment.estimatedTokens,
      reason:
        historyLimitedStage && historyLimitedStage.charsDelta < 0
          ? "History limiting later removed a large amount of transcript, so large turns are the first trimming target."
          : "Large historical turn likely competes with newer context for attention.",
      action: "Summarize or compact this turn earlier instead of replaying the full content.",
      originId: segment.originId,
      path:
        typeof segment.metadata?.originPath === "string"
          ? String(segment.metadata.originPath)
          : undefined,
    });
  }

  return opportunities
    .toSorted((a, b) => {
      if (b.chars !== a.chars) {
        return b.chars - a.chars;
      }
      return a.title.localeCompare(b.title);
    })
    .slice(0, 8);
}
