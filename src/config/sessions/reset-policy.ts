import {
  resolveHumanResetBoundaryMs,
  resolveHumanResetCycleKey,
} from "../../infra/format-time/human-day.js";
import type { OpenClawConfig } from "../config.js";
import type { SessionConfig, SessionResetConfig } from "../types.base.js";
import { DEFAULT_IDLE_MINUTES } from "./types.js";

export type SessionResetMode = "daily" | "idle";
export type SessionResetType = "direct" | "group" | "thread";

export type SessionResetPolicy = {
  mode: SessionResetMode;
  atHour: number;
  idleMinutes?: number;
};

export type SessionFreshness = {
  fresh: boolean;
  dailyResetAt?: number;
  idleExpiresAt?: number;
};

export const DEFAULT_RESET_MODE: SessionResetMode = "daily";
export const DEFAULT_RESET_AT_HOUR = 4;

export function resolveDailyResetAtMs(
  now: number,
  atHour: number,
  cfg?: OpenClawConfig,
): number | undefined {
  return resolveHumanResetBoundaryMs(now, normalizeResetAtHour(atHour), cfg);
}

export function resolveSessionResetPolicy(params: {
  sessionCfg?: SessionConfig;
  resetType: SessionResetType;
  resetOverride?: SessionResetConfig;
}): SessionResetPolicy {
  const sessionCfg = params.sessionCfg;
  const baseReset = params.resetOverride ?? sessionCfg?.reset;
  // Backward compat: accept legacy "dm" key as alias for "direct"
  const typeReset = params.resetOverride
    ? undefined
    : (sessionCfg?.resetByType?.[params.resetType] ??
      (params.resetType === "direct"
        ? (sessionCfg?.resetByType as { dm?: SessionResetConfig } | undefined)?.dm
        : undefined));
  const hasExplicitReset = Boolean(baseReset || sessionCfg?.resetByType);
  const legacyIdleMinutes = params.resetOverride ? undefined : sessionCfg?.idleMinutes;
  const mode =
    typeReset?.mode ??
    baseReset?.mode ??
    (!hasExplicitReset && legacyIdleMinutes != null ? "idle" : DEFAULT_RESET_MODE);
  const atHour = normalizeResetAtHour(
    typeReset?.atHour ?? baseReset?.atHour ?? DEFAULT_RESET_AT_HOUR,
  );
  const idleMinutesRaw = typeReset?.idleMinutes ?? baseReset?.idleMinutes ?? legacyIdleMinutes;

  let idleMinutes: number | undefined;
  if (idleMinutesRaw != null) {
    const normalized = Math.floor(idleMinutesRaw);
    if (Number.isFinite(normalized)) {
      idleMinutes = Math.max(normalized, 0);
    }
  } else if (mode === "idle") {
    idleMinutes = DEFAULT_IDLE_MINUTES;
  }

  return { mode, atHour, idleMinutes };
}

export function evaluateSessionFreshness(params: {
  updatedAt?: number | null;
  now: number;
  policy: SessionResetPolicy;
  cfg?: OpenClawConfig;
}): SessionFreshness {
  const dailyResetAt =
    params.policy.mode === "daily"
      ? resolveDailyResetAtMs(params.now, params.policy.atHour, params.cfg)
      : undefined;
  const updatedAt = resolveSessionActivityTimestamp(params.updatedAt);
  if (updatedAt === undefined) {
    // Session stores are persisted JSON and may contain legacy/manual entries
    // without a usable activity timestamp. Treat those as stale instead of
    // feeding invalid dates into the human-day helpers.
    return {
      fresh: false,
      dailyResetAt,
    };
  }
  const idleExpiresAt =
    params.policy.idleMinutes != null && params.policy.idleMinutes > 0
      ? updatedAt + params.policy.idleMinutes * 60_000
      : undefined;
  const staleDaily =
    params.policy.mode === "daily"
      ? resolveHumanResetCycleKey(updatedAt, params.policy.atHour, params.cfg) <
        resolveHumanResetCycleKey(params.now, params.policy.atHour, params.cfg)
      : false;
  const staleIdle = idleExpiresAt != null && params.now > idleExpiresAt;
  return {
    fresh: !(staleDaily || staleIdle),
    dailyResetAt,
    idleExpiresAt,
  };
}

function resolveSessionActivityTimestamp(updatedAt?: number | null): number | undefined {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) {
    return undefined;
  }
  return updatedAt;
}

function normalizeResetAtHour(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_RESET_AT_HOUR;
  }
  const normalized = Math.floor(value);
  if (!Number.isFinite(normalized)) {
    return DEFAULT_RESET_AT_HOUR;
  }
  if (normalized < 0) {
    return 0;
  }
  if (normalized > 23) {
    return 23;
  }
  return normalized;
}
