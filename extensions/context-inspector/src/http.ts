import type { IncomingMessage, ServerResponse } from "node:http";
import type { PluginLogger } from "openclaw/plugin-sdk/core";
import type { ContextInspectorStore } from "./store.js";
import { buildContextInspectorHtml } from "./ui.js";

const API_PREFIX = "/plugins/context-inspector/api";
const APP_PREFIX = "/plugins/context-inspector";

export function createContextInspectorHttpHandler(params: {
  store: ContextInspectorStore;
  logger?: PluginLogger;
  allowRemoteViewer?: boolean;
}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = parseUrl(req.url);
    if (!url) {
      return false;
    }
    if (!url.pathname.startsWith(APP_PREFIX)) {
      return false;
    }

    const localRequest = isLoopbackRequest(req);
    if (!localRequest && params.allowRemoteViewer !== true) {
      respondText(res, 404, "Not found");
      return true;
    }

    if (url.pathname === APP_PREFIX || url.pathname === `${APP_PREFIX}/`) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        respondText(res, 405, "Method not allowed");
        return true;
      }
      const html = buildContextInspectorHtml();
      res.statusCode = 200;
      setSharedHeaders(res, "text/html; charset=utf-8");
      res.setHeader(
        "content-security-policy",
        [
          "default-src 'none'",
          "script-src 'unsafe-inline'",
          "style-src 'unsafe-inline'",
          "img-src 'self' data:",
          "connect-src 'self'",
          "base-uri 'none'",
          "frame-ancestors 'self'",
        ].join("; "),
      );
      if (req.method === "HEAD") {
        res.end();
      } else {
        res.end(html);
      }
      return true;
    }

    if (!url.pathname.startsWith(API_PREFIX)) {
      respondText(res, 404, "Not found");
      return true;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      respondText(res, 405, "Method not allowed");
      return true;
    }

    try {
      if (url.pathname === `${API_PREFIX}/runs`) {
        const limit = Number(url.searchParams.get("limit") ?? 50);
        return await respondJson(
          res,
          await params.store.listRuns(Number.isFinite(limit) ? limit : 50),
          req.method === "HEAD",
        );
      }

      if (url.pathname === `${API_PREFIX}/diagnostics`) {
        return await respondJson(
          res,
          await params.store.exportDiagnostics(),
          req.method === "HEAD",
        );
      }

      const runMatch = url.pathname.match(/^\/plugins\/context-inspector\/api\/runs\/([^/]+)$/);
      if (runMatch?.[1]) {
        const run = await params.store.getRun(decodeURIComponent(runMatch[1]));
        if (!run) {
          respondText(res, 404, "Run not found");
          return true;
        }
        return await respondJson(res, run, req.method === "HEAD");
      }

      const diffMatch = url.pathname.match(
        /^\/plugins\/context-inspector\/api\/runs\/([^/]+)\/diff$/,
      );
      if (diffMatch?.[1]) {
        const diff = await params.store.getRunDiff(
          decodeURIComponent(diffMatch[1]),
          url.searchParams.get("base") ?? undefined,
        );
        if (!diff) {
          respondText(res, 404, "Run not found");
          return true;
        }
        return await respondJson(res, diff, req.method === "HEAD");
      }
    } catch (error) {
      params.logger?.warn(`context-inspector http failed: ${String(error)}`);
      respondText(res, 500, "Internal error");
      return true;
    }

    respondText(res, 404, "Not found");
    return true;
  };
}

function parseUrl(rawUrl?: string): URL | null {
  if (!rawUrl) {
    return null;
  }
  try {
    return new URL(rawUrl, "http://127.0.0.1");
  } catch {
    return null;
  }
}

async function respondJson(
  res: ServerResponse,
  value: unknown,
  headOnly: boolean,
): Promise<boolean> {
  res.statusCode = 200;
  setSharedHeaders(res, "application/json; charset=utf-8");
  if (headOnly) {
    res.end();
  } else {
    res.end(JSON.stringify(value, null, 2));
  }
  return true;
}

function respondText(res: ServerResponse, statusCode: number, body: string) {
  res.statusCode = statusCode;
  setSharedHeaders(res, "text/plain; charset=utf-8");
  res.end(body);
}

function setSharedHeaders(res: ServerResponse, contentType: string) {
  res.setHeader("cache-control", "no-store, max-age=0");
  res.setHeader("content-type", contentType);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
}

function isLoopbackRequest(req: IncomingMessage): boolean {
  const remote = `${req.socket?.remoteAddress ?? ""}`.trim().toLowerCase();
  const normalized = remote.startsWith("::ffff:") ? remote.slice("::ffff:".length) : remote;
  return (normalized === "127.0.0.1" || normalized === "::1") && !hasProxyHeaders(req);
}

function hasProxyHeaders(req: IncomingMessage): boolean {
  const headers = req.headers ?? {};
  return Boolean(
    headers["x-forwarded-for"] ||
    headers["x-real-ip"] ||
    headers.forwarded ||
    headers["x-forwarded-host"] ||
    headers["x-forwarded-proto"],
  );
}
