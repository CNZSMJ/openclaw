import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONTEXT_INSPECTOR_CONFIG } from "./config.js";
import { ContextInspectorStore } from "./store.js";

const tempDirs: string[] = [];

function makeStore() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "context-inspector-"));
  tempDirs.push(rootDir);
  return new ContextInspectorStore({
    rootDir,
    config: DEFAULT_CONTEXT_INSPECTOR_CONFIG,
    openClawConfig: {},
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("ContextInspectorStore", () => {
  it("captures llm input and llm output into a run record", async () => {
    const store = makeStore();
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "context-inspector-workspace-"));
    tempDirs.push(workspaceDir);
    const agentsPath = path.join(workspaceDir, "AGENTS.md");
    fs.writeFileSync(
      agentsPath,
      "# Repository Guidelines\nalpha\n## Section A\nKeep prompts focused.\n",
      "utf8",
    );

    await store.recordLlmInput(
      {
        runId: "run-1",
        sessionId: "session-1",
        provider: "openai",
        model: "gpt-5",
        systemPrompt:
          "# Project Context\nThe following project context files have been loaded:\n## " +
          agentsPath +
          "\n# Repository Guidelines\nalpha\n## Section A\nKeep prompts focused.\n## Skills (mandatory)\ncheck",
        prompt: "help me optimize",
        systemPromptReport: {
          source: "run",
          generatedAt: Date.now(),
          sessionId: "session-1",
          systemPrompt: {
            chars: 48,
            projectContextChars: 22,
            nonProjectContextChars: 26,
          },
          injectedWorkspaceFiles: [
            {
              name: "AGENTS.md",
              path: agentsPath,
              missing: false,
              rawChars: 9_512,
              injectedChars: 6_256,
              truncated: true,
            },
          ],
          skills: {
            promptChars: 120,
            entries: [{ name: "checks", blockChars: 120 }],
          },
          tools: {
            listChars: 64,
            schemaChars: 2_300,
            entries: [
              {
                name: "read_file",
                summaryChars: 24,
                schemaChars: 2_300,
                propertiesCount: 2,
              },
            ],
          },
        },
        historyMessages: [
          { role: "user", content: [{ type: "text", text: "hello world" }] },
          { role: "assistant", content: [{ type: "text", text: "prior answer" }] },
        ],
        imagesCount: 0,
        contextStages: [
          {
            stage: "sanitized",
            messages: [{ role: "user", content: [{ type: "text", text: "hello world" }] }],
            messageCount: 1,
            estimatedTokens: 3,
          },
          {
            stage: "final",
            messages: [
              { role: "user", content: [{ type: "text", text: "hello world" }] },
              { role: "assistant", content: [{ type: "text", text: "prior answer" }] },
            ],
            messageCount: 2,
            estimatedTokens: 6,
          },
        ],
      },
      {
        sessionId: "session-1",
        sessionKey: "agent:default:main",
        workspaceDir,
      },
    );

    await store.recordLlmOutput(
      {
        runId: "run-1",
        sessionId: "session-1",
        provider: "openai",
        model: "gpt-5",
        assistantTexts: ["final answer"],
        lastAssistant: {
          content: [{ type: "thinking", thinking: "chain of thought excerpt" }],
        },
        usage: { total: 1234 },
      },
      {
        sessionId: "session-1",
        sessionKey: "agent:default:main",
      },
    );

    const run = await store.getRun("run-1");
    expect(run?.status).toBe("complete");
    expect(run?.input.systemSegments.length).toBeGreaterThan(0);
    expect(run?.input.contextStages).toHaveLength(2);
    expect(run?.input.contextStages[0]?.charsDelta).toBeGreaterThan(0);
    expect(run?.input.contextStages[1]?.tokenDelta).toBe(3);
    expect(run?.input.suggestions.length).toBeGreaterThan(0);
    expect(run?.input.origins.some((origin) => origin.kind === "skill")).toBe(true);
    expect(run?.input.origins.some((origin) => origin.kind === "tool-schema")).toBe(true);
    expect((run?.input.cutFirst.length ?? 0) > 0).toBe(true);
    expect(
      run?.input.systemSegments.some((segment) => segment.metadata?.originPath === agentsPath),
    ).toBe(true);
    expect(
      run?.input.origins.some(
        (origin) => origin.kind === "bootstrap-file-section" && origin.path === agentsPath,
      ),
    ).toBe(true);
    expect(run?.output?.thinkingTexts).toEqual(["chain of thought excerpt"]);
  });

  it("computes diff against the previous run in the same session", async () => {
    const store = makeStore();
    await store.recordLlmInput(
      {
        runId: "run-a",
        sessionId: "session-1",
        provider: "openai",
        model: "gpt-5",
        systemPrompt: "system a",
        prompt: "prompt a",
        historyMessages: [],
        imagesCount: 0,
      },
      { sessionId: "session-1", sessionKey: "same-session" },
    );
    await store.recordLlmInput(
      {
        runId: "run-b",
        sessionId: "session-1",
        provider: "openai",
        model: "gpt-5",
        systemPrompt: "system a plus more",
        prompt: "prompt b",
        historyMessages: [],
        imagesCount: 0,
      },
      { sessionId: "session-1", sessionKey: "same-session" },
    );

    const diff = await store.getRunDiff("run-b");
    expect(diff?.base?.runId).toBe("run-a");
    expect(diff?.metrics.charsDelta).toBeGreaterThan(0);
  });
});
