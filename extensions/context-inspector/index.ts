import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { resolveContextInspectorConfig } from "./src/config.js";

type ContextInspectorStore = import("./src/store.js").ContextInspectorStore;
type ContextInspectorHttpHandler = ReturnType<
  typeof import("./src/http.js").createContextInspectorHttpHandler
>;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

const plugin = {
  id: "context-inspector",
  name: "Context Inspector",
  description: "Observe, analyze, and inspect real model context in a browser.",
  register(api: OpenClawPluginApi) {
    const cfg = resolveContextInspectorConfig(api.pluginConfig);
    const rootDir = path.join(api.runtime.state.resolveStateDir(), "context-inspector");

    let storePromise: Promise<ContextInspectorStore> | null = null;
    let httpHandlerPromise: Promise<ContextInspectorHttpHandler> | null = null;

    const getStore = async () => {
      if (!storePromise) {
        storePromise = import("./src/store.js")
          .then(
            ({ ContextInspectorStore }) =>
              new ContextInspectorStore({
                rootDir,
                logger: api.logger,
                config: cfg,
              }),
          )
          .catch((error) => {
            storePromise = null;
            throw error;
          });
      }
      return storePromise;
    };

    const runInBackground = (label: string, task: () => Promise<void>) => {
      void task().catch((error) => {
        api.logger.warn(`context-inspector ${label} failed: ${toErrorMessage(error)}`);
      });
    };

    // Observer hooks must never sit on the gateway's synchronous startup or compaction path.
    const capture =
      <TEvent, TContext>(
        label: string,
        fn: (store: ContextInspectorStore, event: TEvent, ctx: TContext) => Promise<void>,
      ) =>
      (event: TEvent, ctx: TContext) => {
        runInBackground(label, async () => {
          const store = await getStore();
          await fn(store, event, ctx);
        });
      };

    api.on(
      "llm_input",
      capture("llm_input", (store, event, ctx) => store.recordLlmInput(event, ctx)),
    );
    api.on(
      "llm_output",
      capture("llm_output", (store, event, ctx) => store.recordLlmOutput(event, ctx)),
    );
    api.on(
      "before_tool_call",
      capture("before_tool_call", (store, event, ctx) => store.recordBeforeToolCall(event, ctx)),
    );
    api.on(
      "after_tool_call",
      capture("after_tool_call", (store, event, ctx) => store.recordAfterToolCall(event, ctx)),
    );
    api.on(
      "before_compaction",
      capture("before_compaction", (store, event, ctx) => store.recordBeforeCompaction(event, ctx)),
    );
    api.on(
      "after_compaction",
      capture("after_compaction", (store, event, ctx) => store.recordAfterCompaction(event, ctx)),
    );

    api.registerHttpRoute({
      path: "/plugins/context-inspector",
      auth: "plugin",
      match: "prefix",
      handler: async (req, res) => {
        if (!httpHandlerPromise) {
          httpHandlerPromise = Promise.all([import("./src/http.js"), getStore()])
            .then(([httpModule, store]) =>
              httpModule.createContextInspectorHttpHandler({
                store,
                logger: api.logger,
                allowRemoteViewer: cfg.security.allowRemoteViewer,
              }),
            )
            .catch((error) => {
              httpHandlerPromise = null;
              throw error;
            });
        }
        const handler = await httpHandlerPromise;
        return handler(req, res);
      },
    });
  },
};

export default plugin;
