export type ContextInspectorConfig = {
  capture: {
    maxRuns: number;
    maxStringChars: number;
  };
  security: {
    allowRemoteViewer: boolean;
  };
};

export const DEFAULT_CONTEXT_INSPECTOR_CONFIG: ContextInspectorConfig = {
  capture: {
    maxRuns: 300,
    maxStringChars: 250_000,
  },
  security: {
    allowRemoteViewer: false,
  },
};

export function resolveContextInspectorConfig(value: unknown): ContextInspectorConfig {
  const next = structuredClone(DEFAULT_CONTEXT_INSPECTOR_CONFIG);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return next;
  }
  const root = value as {
    capture?: { maxRuns?: unknown; maxStringChars?: unknown };
    security?: { allowRemoteViewer?: unknown };
  };
  if (typeof root.capture?.maxRuns === "number" && Number.isFinite(root.capture.maxRuns)) {
    next.capture.maxRuns = Math.max(10, Math.min(5000, Math.floor(root.capture.maxRuns)));
  }
  if (
    typeof root.capture?.maxStringChars === "number" &&
    Number.isFinite(root.capture.maxStringChars)
  ) {
    next.capture.maxStringChars = Math.max(
      1000,
      Math.min(1_000_000, Math.floor(root.capture.maxStringChars)),
    );
  }
  if (typeof root.security?.allowRemoteViewer === "boolean") {
    next.security.allowRemoteViewer = root.security.allowRemoteViewer;
  }
  return next;
}
