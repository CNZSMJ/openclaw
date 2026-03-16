export type InspectorUsage = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
};

export type InspectorOrigin = {
  id: string;
  kind:
    | "bootstrap-file"
    | "bootstrap-file-section"
    | "system-section"
    | "user-prompt"
    | "history-message"
    | "skill"
    | "tool-list"
    | "tool-schema"
    | "tool-call"
    | "tool-result"
    | "thinking"
    | "usage";
  label: string;
  path?: string;
  chars: number;
  estimatedTokens: number;
  truncated?: boolean;
  metadata?: Record<string, unknown>;
};

export type InspectorSegment = {
  id: string;
  lane: "system" | "prompt" | "history" | "thinking";
  label: string;
  originId?: string;
  chars: number;
  estimatedTokens: number;
  text: string;
  duplicateChars: number;
  attentionProxyScore?: number;
  metadata?: Record<string, unknown>;
};

export type ContextStageRecord = {
  stage:
    | "sanitized"
    | "validated"
    | "history-limited"
    | "tool-pair-repaired"
    | "context-engine-assembled"
    | "final";
  messageCount: number;
  estimatedTokens?: number;
  chars: number;
  duplicateChars: number;
  charsDelta: number;
  tokenDelta?: number;
  duplicateDelta: number;
  messages: unknown[];
};

export type TimelineEventRecord = {
  id: string;
  type:
    | "llm_input"
    | "before_tool_call"
    | "after_tool_call"
    | "before_compaction"
    | "after_compaction"
    | "llm_output";
  at: number;
  title: string;
  summary?: string;
  meta?: Record<string, unknown>;
};

export type OptimizationSuggestion = {
  id: string;
  severity: "info" | "warn" | "danger";
  title: string;
  detail: string;
  action?: string;
  evidence?: string;
};

export type OptimizationOpportunity = {
  id: string;
  kind:
    | "bootstrap-file"
    | "bootstrap-file-section"
    | "history-message"
    | "tool-schema"
    | "tool-list";
  title: string;
  chars: number;
  estimatedTokens: number;
  reason: string;
  action: string;
  originId?: string;
  path?: string;
};

export type ContextInspectorRunRecord = {
  schemaVersion: 1;
  runId: string;
  sessionId: string;
  sessionKey?: string;
  agentId?: string;
  workspaceDir?: string;
  trigger?: string;
  channelId?: string;
  provider: string;
  model: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  status: "capturing" | "complete";
  imagesCount: number;
  input: {
    systemPrompt: string;
    prompt: string;
    historyMessages: unknown[];
    systemSegments: InspectorSegment[];
    promptSegments: InspectorSegment[];
    historySegments: InspectorSegment[];
    contextStages: ContextStageRecord[];
    origins: InspectorOrigin[];
    chars: number;
    estimatedTokens: number;
    duplicateChars: number;
    noiseScore: number;
    suggestions: OptimizationSuggestion[];
    cutFirst: OptimizationOpportunity[];
    report?: Record<string, unknown>;
  };
  output?: {
    assistantTexts: string[];
    thinkingTexts: string[];
    usage?: InspectorUsage;
    chars: number;
    estimatedTokens: number;
  };
  timeline: TimelineEventRecord[];
  counters: {
    toolCalls: number;
    compactions: number;
  };
};

export type ContextInspectorRunSummary = {
  runId: string;
  sessionKey?: string;
  provider: string;
  model: string;
  startedAt: number;
  updatedAt: number;
  status: "capturing" | "complete";
  chars: number;
  estimatedTokens: number;
  noiseScore: number;
  duplicateChars: number;
  toolCalls: number;
  compactions: number;
};
