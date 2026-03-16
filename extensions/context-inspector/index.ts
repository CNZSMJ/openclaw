import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { resolveContextInspectorConfig } from "./src/config.js";
import { createContextInspectorHttpHandler } from "./src/http.js";
import { ContextInspectorStore } from "./src/store.js";

const plugin = {
  id: "context-inspector",
  name: "Context Inspector",
  description: "Observe, analyze, and inspect real model context in a browser.",
  register(api: OpenClawPluginApi) {
    const cfg = resolveContextInspectorConfig(api.pluginConfig);
    const stateDir = api.runtime.state.resolveStateDir();
    const store = new ContextInspectorStore({
      rootDir: path.join(stateDir, "context-inspector"),
      logger: api.logger,
      config: cfg,
      openClawConfig: api.config,
    });

    api.on("llm_input", (event, ctx) => store.recordLlmInput(event, ctx));
    api.on("llm_output", (event, ctx) => store.recordLlmOutput(event, ctx));
    api.on("before_tool_call", (event, ctx) => store.recordBeforeToolCall(event, ctx));
    api.on("after_tool_call", (event, ctx) => store.recordAfterToolCall(event, ctx));
    api.on("before_compaction", (event, ctx) => store.recordBeforeCompaction(event, ctx));
    api.on("after_compaction", (event, ctx) => store.recordAfterCompaction(event, ctx));

    api.registerHttpRoute({
      path: "/plugins/context-inspector",
      auth: "plugin",
      match: "prefix",
      handler: createContextInspectorHttpHandler({
        store,
        logger: api.logger,
        allowRemoteViewer: cfg.security.allowRemoteViewer,
      }),
    });
  },
};

export default plugin;
