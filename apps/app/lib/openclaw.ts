export type OpenClawContextPacket = {
  agentId: string;
  agentName: string;
  areaId: string;
  localArea: { load: number; risk: number };
  recentEvents: string[];
  recentLogs: string[];
  timestamp: string;
};

export type OpenClawOutput = {
  candidate: string;
  support: number;
  attack: number;
  reason: string;
  tokensUsed?: number;
};

type ValidationSuccess<T> = { ok: true; value: T };
type ValidationFailure = { ok: false; error: string };

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

type InferenceResult = {
  payload: unknown;
  provider: 'mock' | 'remote';
  latencyMs: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const heuristicOutput = (context: OpenClawContextPacket): OpenClawOutput => {
  const { load, risk } = context.localArea;
  const hasDangerEvent = context.recentEvents.some((ev) => /collapse|broken|danger|崩落|故障/i.test(ev));
  const hasRushEvent = context.recentEvents.some((ev) => /rush|order|受注/i.test(ev));

  if (risk >= 58 || hasDangerEvent) {
    return {
      candidate: 'Fix Tunnel',
      support: 2,
      attack: 0,
      reason: `${context.agentName} sees risk ${risk}, prioritizing safety recovery.`,
      tokensUsed: 42,
    };
  }

  if (load >= 64 || hasRushEvent) {
    return {
      candidate: 'Speed Up Crafting',
      support: 2,
      attack: risk >= 52 ? 1 : 0,
      reason: `${context.agentName} sees load ${load}, pushing throughput with caution.`,
      tokensUsed: 44,
    };
  }

  if (load <= 42 && risk <= 34) {
    return {
      candidate: 'Take a Break',
      support: 1.5,
      attack: 0,
      reason: `${context.agentName} sees low pressure; short recovery keeps quality stable.`,
      tokensUsed: 40,
    };
  }

  return {
    candidate: 'Speed Up Crafting',
    support: 0.8,
    attack: 0.3,
    reason: `${context.agentName} proposes controlled progress while monitoring local risk.`,
    tokensUsed: 38,
  };
};

export const runOpenClawInference = async (
  context: OpenClawContextPacket
): Promise<InferenceResult> => {
  const startedAt = Date.now();
  const endpoint = process.env.NEXT_PUBLIC_OPENCLAW_ENDPOINT;

  if (endpoint) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    });

    if (!response.ok) {
      throw new Error(`OpenClaw endpoint returned ${response.status}`);
    }

    const payload = await response.json();
    return {
      payload,
      provider: 'remote',
      latencyMs: Date.now() - startedAt,
    };
  }

  // Deterministic local fallback for demos when no endpoint is configured.
  const payload = heuristicOutput(context);
  return {
    payload,
    provider: 'mock',
    latencyMs: Date.now() - startedAt,
  };
};

export const validateOpenClawOutput = (
  payload: unknown,
  candidates: readonly string[]
): ValidationResult<OpenClawOutput> => {
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, error: 'output is not an object' };
  }

  const record = payload as Record<string, unknown>;
  const { candidate, support, attack, reason, tokensUsed } = record;

  if (typeof candidate !== 'string' || !candidates.includes(candidate)) {
    return { ok: false, error: 'candidate is missing or out of allowed set' };
  }
  if (typeof support !== 'number' || Number.isNaN(support)) {
    return { ok: false, error: 'support must be a number' };
  }
  if (typeof attack !== 'number' || Number.isNaN(attack)) {
    return { ok: false, error: 'attack must be a number' };
  }
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    return { ok: false, error: 'reason must be a non-empty string' };
  }
  if (tokensUsed !== undefined && (typeof tokensUsed !== 'number' || Number.isNaN(tokensUsed))) {
    return { ok: false, error: 'tokensUsed must be a number when provided' };
  }

  return {
    ok: true,
    value: {
      candidate,
      support: clamp(support, 0, 3),
      attack: clamp(attack, 0, 3),
      reason: reason.trim(),
      tokensUsed: typeof tokensUsed === 'number' ? Math.max(0, Math.round(tokensUsed)) : undefined,
    },
  };
};
