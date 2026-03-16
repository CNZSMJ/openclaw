import { describe, expect, it, vi } from "vitest";
import { createContextInspectorHttpHandler } from "./http.js";

function makeReq(url: string, method = "GET") {
  return {
    url,
    method,
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as import("node:http").IncomingMessage;
}

function makeRes() {
  const headers = new Map<string, string>();
  return {
    statusCode: 0,
    body: "",
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    end(value = "") {
      this.body = String(value);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
  };
}

describe("createContextInspectorHttpHandler", () => {
  it("serves html for the root viewer path", async () => {
    const handler = createContextInspectorHttpHandler({
      allowRemoteViewer: false,
      store: {
        listRuns: vi.fn(),
        getRun: vi.fn(),
        getRunDiff: vi.fn(),
        exportDiagnostics: vi.fn(),
      } as never,
    });
    const res = makeRes();
    const handled = await handler(makeReq("/plugins/context-inspector"), res as never);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Context Inspector");
  });

  it("serves run summaries from the api", async () => {
    const handler = createContextInspectorHttpHandler({
      allowRemoteViewer: false,
      store: {
        listRuns: vi.fn(async () => [{ runId: "run-1" }]),
        getRun: vi.fn(),
        getRunDiff: vi.fn(),
        exportDiagnostics: vi.fn(),
      } as never,
    });
    const res = makeRes();
    const handled = await handler(makeReq("/plugins/context-inspector/api/runs"), res as never);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("run-1");
  });
});
