/**
 * Session memory hook handler
 *
 * Saves session context to memory when /new or /reset command is triggered
 * Creates a new dated memory file with LLM-generated slug
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  resolveAgentIdByWorkspacePath,
  resolveAgentWorkspaceDir,
} from "../../../agents/agent-scope.js";
import { normalizeTimestamp } from "../../../agents/date-time.js";
import type { OpenClawConfig } from "../../../config/config.js";
import { resolveStateDir } from "../../../config/paths.js";
import {
  formatHumanDayKey,
  formatHumanTime,
  resolveHumanTimezone,
} from "../../../infra/format-time/human-day.js";
import { writeFileWithinRoot } from "../../../infra/fs-safe.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";
import {
  parseAgentSessionKey,
  resolveAgentIdFromSessionKey,
  toAgentStoreSessionKey,
} from "../../../routing/session-key.js";
import { hasInterSessionUserProvenance } from "../../../sessions/input-provenance.js";
import { resolveHookConfig } from "../../config.js";
import type { HookHandler } from "../../hooks.js";
import { generateSlugViaLLM } from "../../llm-slug-generator.js";

const log = createSubsystemLogger("hooks/session-memory");

type SessionTranscriptExcerpt = {
  content: string | null;
  lastMessageTimestampMs?: number;
};

function resolveDisplaySessionKey(params: {
  cfg?: OpenClawConfig;
  workspaceDir?: string;
  sessionKey: string;
}): string {
  if (!params.cfg || !params.workspaceDir) {
    return params.sessionKey;
  }
  const workspaceAgentId = resolveAgentIdByWorkspacePath(params.cfg, params.workspaceDir);
  const parsed = parseAgentSessionKey(params.sessionKey);
  if (!workspaceAgentId || !parsed || workspaceAgentId === parsed.agentId) {
    return params.sessionKey;
  }
  return toAgentStoreSessionKey({
    agentId: workspaceAgentId,
    requestKey: parsed.rest,
  });
}

/**
 * Read recent messages from session file for slug generation
 */
async function getRecentSessionContent(
  sessionFilePath: string,
  messageCount: number = 15,
): Promise<SessionTranscriptExcerpt> {
  try {
    const content = await fs.readFile(sessionFilePath, "utf-8");
    const lines = content.trim().split("\n");

    // Parse JSONL and extract user/assistant messages first
    const allMessages: string[] = [];
    let lastMessageTimestampMs: number | undefined;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        // Session files have entries with type="message" containing a nested message object
        if (entry.type === "message" && entry.message) {
          const msg = entry.message;
          const role = msg.role;
          if ((role === "user" || role === "assistant") && msg.content) {
            if (role === "user" && hasInterSessionUserProvenance(msg)) {
              continue;
            }
            // Extract text content
            const text = Array.isArray(msg.content)
              ? // oxlint-disable-next-line typescript/no-explicit-any
                msg.content.find((c: any) => c.type === "text")?.text
              : msg.content;
            if (text && !text.startsWith("/")) {
              allMessages.push(`${role}: ${text}`);
              const normalizedTimestamp = normalizeTimestamp(entry.timestamp ?? msg.timestamp);
              if (normalizedTimestamp) {
                lastMessageTimestampMs = normalizedTimestamp.timestampMs;
              }
            }
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    // Then slice to get exactly messageCount messages
    const recentMessages = allMessages.slice(-messageCount);
    return {
      content: recentMessages.length > 0 ? recentMessages.join("\n") : null,
      lastMessageTimestampMs,
    };
  } catch {
    return { content: null };
  }
}

/**
 * Try the active transcript first; if /new already rotated it,
 * fallback to the latest .jsonl.reset.* sibling.
 */
async function getRecentSessionContentWithResetFallback(
  sessionFilePath: string,
  messageCount: number = 15,
): Promise<SessionTranscriptExcerpt> {
  const primary = await getRecentSessionContent(sessionFilePath, messageCount);
  if (primary.content) {
    return primary;
  }

  try {
    const dir = path.dirname(sessionFilePath);
    const base = path.basename(sessionFilePath);
    const resetPrefix = `${base}.reset.`;
    const files = await fs.readdir(dir);
    const resetCandidates = files.filter((name) => name.startsWith(resetPrefix)).toSorted();

    if (resetCandidates.length === 0) {
      return primary;
    }

    const latestResetPath = path.join(dir, resetCandidates[resetCandidates.length - 1]);
    const fallback = await getRecentSessionContent(latestResetPath, messageCount);

    if (fallback.content) {
      log.debug("Loaded session content from reset fallback", {
        sessionFilePath,
        latestResetPath,
      });
    }

    return fallback.content ? fallback : primary;
  } catch {
    return primary;
  }
}

function stripResetSuffix(fileName: string): string {
  const resetIndex = fileName.indexOf(".reset.");
  return resetIndex === -1 ? fileName : fileName.slice(0, resetIndex);
}

async function findPreviousSessionFile(params: {
  sessionsDir: string;
  currentSessionFile?: string;
  sessionId?: string;
}): Promise<string | undefined> {
  try {
    const files = await fs.readdir(params.sessionsDir);
    const fileSet = new Set(files);

    const baseFromReset = params.currentSessionFile
      ? stripResetSuffix(path.basename(params.currentSessionFile))
      : undefined;
    if (baseFromReset && fileSet.has(baseFromReset)) {
      return path.join(params.sessionsDir, baseFromReset);
    }

    const trimmedSessionId = params.sessionId?.trim();
    if (trimmedSessionId) {
      const canonicalFile = `${trimmedSessionId}.jsonl`;
      if (fileSet.has(canonicalFile)) {
        return path.join(params.sessionsDir, canonicalFile);
      }

      const topicVariants = files
        .filter(
          (name) =>
            name.startsWith(`${trimmedSessionId}-topic-`) &&
            name.endsWith(".jsonl") &&
            !name.includes(".reset."),
        )
        .toSorted()
        .toReversed();
      if (topicVariants.length > 0) {
        return path.join(params.sessionsDir, topicVariants[0]);
      }
    }

    if (!params.currentSessionFile) {
      return undefined;
    }

    const nonResetJsonl = files
      .filter((name) => name.endsWith(".jsonl") && !name.includes(".reset."))
      .toSorted()
      .toReversed();
    if (nonResetJsonl.length > 0) {
      return path.join(params.sessionsDir, nonResetJsonl[0]);
    }
  } catch {
    // Ignore directory read errors.
  }
  return undefined;
}

/**
 * Save session context to memory when /new or /reset command is triggered
 */
const saveSessionToMemory: HookHandler = async (event) => {
  // Only trigger on reset/new commands
  const isResetCommand = event.action === "new" || event.action === "reset";
  if (event.type !== "command" || !isResetCommand) {
    return;
  }

  try {
    log.debug("Hook triggered for reset/new command", { action: event.action });

    const context = event.context || {};
    const cfg = context.cfg as OpenClawConfig | undefined;
    const contextWorkspaceDir =
      typeof context.workspaceDir === "string" && context.workspaceDir.trim().length > 0
        ? context.workspaceDir
        : undefined;
    const agentId = resolveAgentIdFromSessionKey(event.sessionKey);
    const workspaceDir =
      contextWorkspaceDir ||
      (cfg
        ? resolveAgentWorkspaceDir(cfg, agentId)
        : path.join(resolveStateDir(process.env, os.homedir), "workspace"));
    const displaySessionKey = resolveDisplaySessionKey({
      cfg,
      workspaceDir: contextWorkspaceDir,
      sessionKey: event.sessionKey,
    });
    const memoryDir = path.join(workspaceDir, "memory");
    await fs.mkdir(memoryDir, { recursive: true });

    // Generate descriptive slug from session using LLM
    // Prefer previousSessionEntry (old session before /new) over current (which may be empty)
    const sessionEntry = (context.previousSessionEntry || context.sessionEntry || {}) as Record<
      string,
      unknown
    >;
    const currentSessionId = sessionEntry.sessionId as string;
    let currentSessionFile = (sessionEntry.sessionFile as string) || undefined;

    // If sessionFile is empty or looks like a new/reset file, try to find the previous session file.
    if (!currentSessionFile || currentSessionFile.includes(".reset.")) {
      const sessionsDirs = new Set<string>();
      if (currentSessionFile) {
        sessionsDirs.add(path.dirname(currentSessionFile));
      }
      sessionsDirs.add(path.join(workspaceDir, "sessions"));

      for (const sessionsDir of sessionsDirs) {
        const recoveredSessionFile = await findPreviousSessionFile({
          sessionsDir,
          currentSessionFile,
          sessionId: currentSessionId,
        });
        if (!recoveredSessionFile) {
          continue;
        }
        currentSessionFile = recoveredSessionFile;
        log.debug("Found previous session file", { file: currentSessionFile });
        break;
      }
    }

    log.debug("Session context resolved", {
      sessionId: currentSessionId,
      sessionFile: currentSessionFile,
      hasCfg: Boolean(cfg),
    });

    const sessionFile = currentSessionFile || undefined;
    const eventTimestampMs = event.timestamp.getTime();

    // Read message count from hook config (default: 15)
    const hookConfig = resolveHookConfig(cfg, "session-memory");
    const messageCount =
      typeof hookConfig?.messages === "number" && hookConfig.messages > 0
        ? hookConfig.messages
        : 15;

    let slug: string | null = null;
    let sessionContent: string | null = null;
    let lastMessageTimestampMs: number | undefined;

    if (sessionFile) {
      // Get recent conversation content, with fallback to rotated reset transcript.
      const transcriptExcerpt = await getRecentSessionContentWithResetFallback(
        sessionFile,
        messageCount,
      );
      sessionContent = transcriptExcerpt.content;
      lastMessageTimestampMs = transcriptExcerpt.lastMessageTimestampMs;
      log.debug("Session content loaded", {
        length: sessionContent?.length ?? 0,
        messageCount,
      });

      // Avoid calling the model provider in unit tests; keep hooks fast and deterministic.
      const isTestEnv =
        process.env.OPENCLAW_TEST_FAST === "1" ||
        process.env.VITEST === "true" ||
        process.env.VITEST === "1" ||
        process.env.NODE_ENV === "test";
      const allowLlmSlug = !isTestEnv && hookConfig?.llmSlug !== false;

      if (sessionContent && cfg && allowLlmSlug) {
        log.debug("Calling generateSlugViaLLM...");
        // Use LLM to generate a descriptive slug
        slug = await generateSlugViaLLM({ sessionContent, cfg });
        log.debug("Generated slug", { slug });
      }
    }

    const sessionTimestampMs =
      lastMessageTimestampMs ??
      (typeof sessionEntry.updatedAt === "number" && Number.isFinite(sessionEntry.updatedAt)
        ? Math.floor(sessionEntry.updatedAt)
        : eventTimestampMs);
    const dateStr = formatHumanDayKey(sessionTimestampMs, cfg);
    const timeStr = formatHumanTime(sessionTimestampMs, cfg, { includeSeconds: true });
    const timeZone = resolveHumanTimezone(cfg);

    // If no slug, use timestamp
    if (!slug) {
      slug = formatHumanTime(eventTimestampMs, cfg, { compact: true });
      log.debug("Using fallback timestamp slug", { slug });
    }

    // Create filename with date and slug
    const filename = `${dateStr}-${slug}.md`;
    const memoryFilePath = path.join(memoryDir, filename);
    log.debug("Memory file path resolved", {
      filename,
      path: memoryFilePath.replace(os.homedir(), "~"),
    });

    // Extract context details
    const sessionId = (sessionEntry.sessionId as string) || "unknown";
    const source = (context.commandSource as string) || "unknown";

    // Build Markdown entry
    const entryParts = [
      `# Session: ${dateStr} ${timeStr} (${timeZone})`,
      "",
      `- **Session Key**: ${displaySessionKey}`,
      `- **Session ID**: ${sessionId}`,
      `- **Source**: ${source}`,
      "",
    ];

    // Include conversation content if available
    if (sessionContent) {
      entryParts.push("## Conversation Summary", "", sessionContent, "");
    }

    const entry = entryParts.join("\n");

    // Write under memory root with alias-safe file validation.
    await writeFileWithinRoot({
      rootDir: memoryDir,
      relativePath: filename,
      data: entry,
      encoding: "utf-8",
    });
    log.debug("Memory file written successfully");

    // Log completion (but don't send user-visible confirmation - it's internal housekeeping)
    const relPath = memoryFilePath.replace(os.homedir(), "~");
    log.info(`Session context saved to ${relPath}`);
  } catch (err) {
    if (err instanceof Error) {
      log.error("Failed to save session memory", {
        errorName: err.name,
        errorMessage: err.message,
        stack: err.stack,
      });
    } else {
      log.error("Failed to save session memory", { error: String(err) });
    }
  }
};

export default saveSessionToMemory;
