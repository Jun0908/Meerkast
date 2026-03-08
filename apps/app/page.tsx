"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { WorkshopMap, AgentData } from './components/WorkshopMap';
import { AnimState } from './components/MeerkatAgent';
import { OpenClawContextPacket, OpenClawOutput, runOpenClawInference, validateOpenClawOutput } from './lib/openclaw';

const INITIAL_AGENTS: AgentData[] = [
  { id: 'a1', role: 'Digging Team', state: 'idle', areaId: 'digging', bubble: null },
  { id: 'a2', role: 'Crafter', state: 'working', areaId: 'crafting', bubble: null },
  { id: 'a3', role: 'Inspector', state: 'idle', areaId: 'inspection', bubble: null },
  { id: 'a4', role: 'Packer', state: 'working', areaId: 'storage', bubble: null },
  { id: 'a5', role: 'Manager', state: 'idle', areaId: 'restArea', bubble: null },
];

type CandidateKey = 'Fix Tunnel' | 'Speed Up Crafting' | 'Take a Break';
type AgentContribution = Record<string, number>;
type AreaKey = 'digging' | 'crafting' | 'inspection' | 'storage' | 'restArea';

type DecisionData = {
  support: number;
  attack: number;
  status: 'pending' | 'confirmed';
  byAgentSupport: AgentContribution;
  byAgentAttack: AgentContribution;
};

type AreaState = Record<AreaKey, { load: number; risk: number }>;

type EventDef = {
  id: string;
  label: string;
  type: 'danger' | 'warning' | 'success';
  target: string;
  effects: Partial<Record<AreaKey, { load?: number; risk?: number }>>;
};

type AgentSignal = {
  agentId: string;
  candidate: CandidateKey;
  support: number;
  attack: number;
  message: string;
  bubbleType: 'support' | 'attack' | 'normal';
  reason?: string;
  source: 'rule' | 'openclaw';
};

type InferenceMode = 'rule' | 'openclaw';

type TickDiagnostics = {
  provider: 'rule' | 'mock' | 'remote';
  avgLatencyMs: number;
  tokensUsed: number;
  fallbacks: number;
  validation: string;
};

const CANDIDATES: CandidateKey[] = ['Fix Tunnel', 'Speed Up Crafting', 'Take a Break'];
const THRESHOLD = 12;
const SIGNAL_EVAP_PER_TICK = 0.35;

const INITIAL_DECISIONS: Record<CandidateKey, DecisionData> = {
  'Fix Tunnel': { support: 0, attack: 0, status: 'pending', byAgentSupport: {}, byAgentAttack: {} },
  'Speed Up Crafting': { support: 0, attack: 0, status: 'pending', byAgentSupport: {}, byAgentAttack: {} },
  'Take a Break': { support: 0, attack: 0, status: 'pending', byAgentSupport: {}, byAgentAttack: {} },
};

const INITIAL_AREAS: AreaState = {
  digging: { load: 48, risk: 35 },
  crafting: { load: 56, risk: 32 },
  inspection: { load: 40, risk: 30 },
  storage: { load: 52, risk: 28 },
  restArea: { load: 30, risk: 20 },
};

const WARMUP_AREAS: AreaState = {
  digging: { load: 61, risk: 49 },
  crafting: { load: 66, risk: 44 },
  inspection: { load: 52, risk: 42 },
  storage: { load: 65, risk: 40 },
  restArea: { load: 38, risk: 24 },
};

const WARMUP_DECISIONS: Record<CandidateKey, DecisionData> = {
  'Fix Tunnel': {
    support: 7.6,
    attack: 1.4,
    status: 'pending',
    byAgentSupport: { a1: 3.2, a3: 3.1, a4: 1.3 },
    byAgentAttack: { a2: 0.9, a5: 0.5 },
  },
  'Speed Up Crafting': {
    support: 6.8,
    attack: 2.2,
    status: 'pending',
    byAgentSupport: { a2: 2.7, a4: 3.0, a1: 1.1 },
    byAgentAttack: { a3: 1.2, a5: 1.0 },
  },
  'Take a Break': {
    support: 3.6,
    attack: 1.4,
    status: 'pending',
    byAgentSupport: { a5: 2.2, a1: 1.4 },
    byAgentAttack: { a4: 0.8, a2: 0.6 },
  },
};

const EVENTS: EventDef[] = [
  {
    id: 'e1',
    label: '🌋 Tunnel Collapse!',
    type: 'danger',
    target: 'a1',
    effects: {
      digging: { risk: 34, load: 12 },
      inspection: { risk: 10 },
    },
  },
  {
    id: 'e2',
    label: '📦 Rush Order!',
    type: 'warning',
    target: 'a4',
    effects: {
      storage: { load: 30, risk: 8 },
      crafting: { load: 16 },
      inspection: { load: 10, risk: 5 },
    },
  },
  {
    id: 'e3',
    label: '🍎 Food Delivery',
    type: 'success',
    target: 'a5',
    effects: {
      restArea: { load: 20, risk: -12 },
      digging: { risk: -6 },
      crafting: { risk: -4 },
    },
  },
  {
    id: 'e4',
    label: '🔨 Broken Tools',
    type: 'danger',
    target: 'a2',
    effects: {
      crafting: { risk: 30, load: 10 },
      inspection: { risk: 8 },
    },
  },
];

const AREA_LABELS: Record<AreaKey, string> = {
  digging: 'Digging',
  crafting: 'Crafting',
  inspection: 'Inspection',
  storage: 'Storage',
  restArea: 'Rest',
};

const AGENT_NAMES: Record<string, string> = {
  a1: 'Digging Team',
  a2: 'Crafter',
  a3: 'Inspector',
  a4: 'Packer',
  a5: 'Manager',
};

const AGENT_SHORT: Record<string, string> = {
  a1: 'Dig',
  a2: 'Craft',
  a3: 'Inspect',
  a4: 'Pack',
  a5: 'Mgr',
};

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const clampMin = (v: number, min = 0) => Math.max(min, v);

const stabilizeAreas = (areas: AreaState): AreaState => {
  const next: AreaState = { ...areas };
  (Object.keys(next) as AreaKey[]).forEach((k) => {
    const prev = next[k];
    const loadDrift = prev.load > 45 ? -2 : 1;
    const riskDrift = prev.risk > 28 ? -2 : 1;
    next[k] = {
      load: clamp(prev.load + loadDrift),
      risk: clamp(prev.risk + riskDrift),
    };
  });
  return next;
};

const getBaseStateFromArea = (area: { load: number; risk: number }): AnimState => {
  if (area.risk >= 65) return 'panicked';
  if (area.load >= 45) return 'working';
  return 'idle';
};

const computeSignalsForAgent = (agent: AgentData, area: { load: number; risk: number }): AgentSignal[] => {
  if (agent.id === 'a1') {
    if (area.risk >= 55) {
      return [{ agentId: agent.id, candidate: 'Fix Tunnel', support: 2, attack: 0, message: 'Tunnel unstable!', bubbleType: 'support', source: 'rule' }];
    }
    if (area.load >= 65) {
      return [{ agentId: agent.id, candidate: 'Speed Up Crafting', support: 1, attack: 0, message: 'Keep digging!', bubbleType: 'normal', source: 'rule' }];
    }
  }

  if (agent.id === 'a2') {
    if (area.risk >= 58) {
      return [{ agentId: agent.id, candidate: 'Speed Up Crafting', support: 0, attack: 2, message: 'Tools are unsafe!', bubbleType: 'attack', source: 'rule' }];
    }
    if (area.load >= 60) {
      return [{ agentId: agent.id, candidate: 'Speed Up Crafting', support: 2, attack: 0, message: 'Boost production!', bubbleType: 'support', source: 'rule' }];
    }
  }

  if (agent.id === 'a3') {
    if (area.risk >= 50) {
      return [{ agentId: agent.id, candidate: 'Fix Tunnel', support: 2, attack: 0, message: 'Quality risk high!', bubbleType: 'support', source: 'rule' }];
    }
    if (area.load >= 70) {
      return [{ agentId: agent.id, candidate: 'Speed Up Crafting', support: 0, attack: 1, message: 'Too risky to rush!', bubbleType: 'attack', source: 'rule' }];
    }
  }

  if (agent.id === 'a4') {
    if (area.load >= 60) {
      return [{ agentId: agent.id, candidate: 'Speed Up Crafting', support: 2, attack: 0, message: 'Orders piling up!', bubbleType: 'support', source: 'rule' }];
    }
    if (area.risk >= 62) {
      return [{ agentId: agent.id, candidate: 'Take a Break', support: 0, attack: 1, message: 'No break now!', bubbleType: 'attack', source: 'rule' }];
    }
  }

  if (agent.id === 'a5') {
    if (area.load >= 45 && area.risk <= 38) {
      return [{ agentId: agent.id, candidate: 'Take a Break', support: 2, attack: 0, message: 'Give team a reset.', bubbleType: 'support', source: 'rule' }];
    }
    if (area.risk >= 55) {
      return [{ agentId: agent.id, candidate: 'Speed Up Crafting', support: 0, attack: 1, message: 'Slow down for safety.', bubbleType: 'attack', source: 'rule' }];
    }
  }

  return [];
};

const stripTimestamp = (line: string) => line.replace(/^\[[0-9]{2}:[0-9]{2}:[0-9]{2}\]\s*/, '');

const toBubbleMessage = (reason: string) => {
  if (reason.length <= 32) return reason;
  return `${reason.slice(0, 29)}...`;
};

const openClawDecisionToSignal = (
  agentId: string,
  output: OpenClawOutput
): AgentSignal | null => {
  const support = clampMin(output.support);
  const attack = clampMin(output.attack);
  if (support <= 0 && attack <= 0) return null;

  return {
    agentId,
    candidate: output.candidate as CandidateKey,
    support,
    attack,
    message: toBubbleMessage(output.reason),
    bubbleType: support >= attack ? 'support' : 'attack',
    reason: output.reason,
    source: 'openclaw',
  };
};

export default function Home() {
  const [agents, setAgents] = useState<AgentData[]>(INITIAL_AGENTS);
  const [logs, setLogs] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<CandidateKey, DecisionData>>(INITIAL_DECISIONS);
  const [areas, setAreas] = useState<AreaState>(INITIAL_AREAS);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [inferenceMode, setInferenceMode] = useState<InferenceMode>('rule');
  const [recentEvents, setRecentEvents] = useState<string[]>([]);
  const [reasonFeed, setReasonFeed] = useState<string[]>(['Rule mode: deterministic local thresholds.']);
  const [diagnostics, setDiagnostics] = useState<TickDiagnostics>({
    provider: 'rule',
    avgLatencyMs: 0,
    tokensUsed: 0,
    fallbacks: 0,
    validation: 'n/a',
  });

  const agentsRef = useRef(agents);
  const areasRef = useRef(areas);
  const logsRef = useRef(logs);
  const recentEventsRef = useRef(recentEvents);
  const tickBusyRef = useRef(false);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    areasRef.current = areas;
  }, [areas]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    recentEventsRef.current = recentEvents;
  }, [recentEvents]);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 12));
  }, []);

  const switchInferenceMode = useCallback((mode: InferenceMode) => {
    setInferenceMode(mode);
    if (mode === 'rule') {
      setReasonFeed(['Rule mode: deterministic local thresholds.']);
      setDiagnostics({
        provider: 'rule',
        avgLatencyMs: 0,
        tokensUsed: 0,
        fallbacks: 0,
        validation: 'n/a',
      });
      addLog('Inference Mode switched to Rule');
      return;
    }
    setReasonFeed(['OpenClaw mode: each agent requests LLM inference on local context.']);
    addLog('Inference Mode switched to OpenClaw');
  }, [addLog]);

  const buildContextPacket = useCallback(
    (agent: AgentData, area: { load: number; risk: number }): OpenClawContextPacket => ({
      agentId: agent.id,
      agentName: AGENT_NAMES[agent.id],
      areaId: agent.areaId,
      localArea: { load: Math.round(area.load), risk: Math.round(area.risk) },
      recentEvents: recentEventsRef.current.slice(0, 4),
      recentLogs: logsRef.current.slice(0, 4).map(stripTimestamp),
      timestamp: new Date().toISOString(),
    }),
    []
  );

  const inferOpenClawSignal = useCallback(
    async (agent: AgentData, area: { load: number; risk: number }) => {
      const context = buildContextPacket(agent, area);
      try {
        const inference = await runOpenClawInference(context);
        const validation = validateOpenClawOutput(inference.payload, CANDIDATES);

        if (!validation.ok) {
          return {
            signals: computeSignalsForAgent(agent, area),
            reasonLine: `${AGENT_SHORT[agent.id]} fallback: ${validation.error}`,
            provider: inference.provider,
            latencyMs: inference.latencyMs,
            tokensUsed: 0,
            fallback: 1,
            validation: validation.error,
          };
        }

        const signal = openClawDecisionToSignal(agent.id, validation.value);
        return {
          signals: signal ? [signal] : [],
          reasonLine: `${AGENT_SHORT[agent.id]}: ${validation.value.reason}`,
          provider: inference.provider,
          latencyMs: inference.latencyMs,
          tokensUsed: validation.value.tokensUsed ?? 0,
          fallback: 0,
          validation: 'ok',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown inference error';
        return {
          signals: computeSignalsForAgent(agent, area),
          reasonLine: `${AGENT_SHORT[agent.id]} fallback: ${message}`,
          provider: 'rule' as const,
          latencyMs: 0,
          tokensUsed: 0,
          fallback: 1,
          validation: message,
        };
      }
    },
    [buildContextPacket]
  );

  const applySignalsToDecisions = useCallback((signals: AgentSignal[]) => {
    if (signals.length === 0) return;

    const confirmed: CandidateKey[] = [];
    setDecisions(prev => {
      const next: Record<CandidateKey, DecisionData> = {
        'Fix Tunnel': { ...prev['Fix Tunnel'], byAgentSupport: { ...prev['Fix Tunnel'].byAgentSupport }, byAgentAttack: { ...prev['Fix Tunnel'].byAgentAttack } },
        'Speed Up Crafting': { ...prev['Speed Up Crafting'], byAgentSupport: { ...prev['Speed Up Crafting'].byAgentSupport }, byAgentAttack: { ...prev['Speed Up Crafting'].byAgentAttack } },
        'Take a Break': { ...prev['Take a Break'], byAgentSupport: { ...prev['Take a Break'].byAgentSupport }, byAgentAttack: { ...prev['Take a Break'].byAgentAttack } },
      };

      signals.forEach((signal) => {
        const target = next[signal.candidate];
        target.support += signal.support;
        target.attack += signal.attack;
        if (signal.support > 0) {
          target.byAgentSupport[signal.agentId] = (target.byAgentSupport[signal.agentId] ?? 0) + signal.support;
        }
        if (signal.attack > 0) {
          target.byAgentAttack[signal.agentId] = (target.byAgentAttack[signal.agentId] ?? 0) + signal.attack;
        }
      });

      CANDIDATES.forEach((candidate) => {
        const score = next[candidate].support - next[candidate].attack;
        if (score >= THRESHOLD && next[candidate].status !== 'confirmed') {
          next[candidate].status = 'confirmed';
          confirmed.push(candidate);
        }
      });

      return next;
    });

    confirmed.forEach((name) => addLog(`Decision Confirmed: ${name}`));
  }, [addLog]);

  const evaporateSignals = useCallback(() => {
    setDecisions((prev) => {
      const next: Record<CandidateKey, DecisionData> = {
        'Fix Tunnel': { ...prev['Fix Tunnel'], byAgentSupport: { ...prev['Fix Tunnel'].byAgentSupport }, byAgentAttack: { ...prev['Fix Tunnel'].byAgentAttack } },
        'Speed Up Crafting': { ...prev['Speed Up Crafting'], byAgentSupport: { ...prev['Speed Up Crafting'].byAgentSupport }, byAgentAttack: { ...prev['Speed Up Crafting'].byAgentAttack } },
        'Take a Break': { ...prev['Take a Break'], byAgentSupport: { ...prev['Take a Break'].byAgentSupport }, byAgentAttack: { ...prev['Take a Break'].byAgentAttack } },
      };

      CANDIDATES.forEach((candidate) => {
        const target = next[candidate];
        if (target.status === 'confirmed') return;
        target.support = clampMin(target.support - SIGNAL_EVAP_PER_TICK);
        target.attack = clampMin(target.attack - SIGNAL_EVAP_PER_TICK);

        Object.keys(target.byAgentSupport).forEach((agentId) => {
          const decayed = clampMin(target.byAgentSupport[agentId] - SIGNAL_EVAP_PER_TICK);
          if (decayed <= 0.01) {
            delete target.byAgentSupport[agentId];
          } else {
            target.byAgentSupport[agentId] = decayed;
          }
        });

        Object.keys(target.byAgentAttack).forEach((agentId) => {
          const decayed = clampMin(target.byAgentAttack[agentId] - SIGNAL_EVAP_PER_TICK);
          if (decayed <= 0.01) {
            delete target.byAgentAttack[agentId];
          } else {
            target.byAgentAttack[agentId] = decayed;
          }
        });
      });

      return next;
    });
  }, []);

  // Distributed loop: each agent reads local context and emits support/attack signals.
  useEffect(() => {
    let cancelled = false;

    const tick = setInterval(() => {
      if (tickBusyRef.current) return;
      tickBusyRef.current = true;

      const runTick = async () => {
        const nextAreas = stabilizeAreas(areasRef.current);
        areasRef.current = nextAreas;
        if (!cancelled) setAreas(nextAreas);
        evaporateSignals();

        let signals: AgentSignal[] = [];

        if (inferenceMode === 'openclaw') {
          const results = await Promise.all(
            agentsRef.current.map(async (agent) => {
              const area = nextAreas[agent.areaId as AreaKey];
              return inferOpenClawSignal(agent, area);
            })
          );

          signals = results.flatMap((result) => result.signals);
          const reasonLines = results.map((result) => result.reasonLine).slice(0, 4);
          const avgLatencyMs = results.length > 0
            ? results.reduce((sum, result) => sum + result.latencyMs, 0) / results.length
            : 0;
          const tokensUsed = results.reduce((sum, result) => sum + result.tokensUsed, 0);
          const fallbacks = results.reduce((sum, result) => sum + result.fallback, 0);
          const validation = results.find((result) => result.validation !== 'ok')?.validation ?? 'ok';
          const provider: TickDiagnostics['provider'] =
            results.some((result) => result.provider === 'remote')
              ? 'remote'
              : results.some((result) => result.provider === 'mock')
                ? 'mock'
                : 'rule';

          if (!cancelled) {
            setReasonFeed(reasonLines);
            setDiagnostics({
              provider,
              avgLatencyMs,
              tokensUsed,
              fallbacks,
              validation,
            });
          }
        } else {
          signals = agentsRef.current.flatMap((agent) => {
            const area = nextAreas[agent.areaId as AreaKey];
            return computeSignalsForAgent(agent, area);
          });
        }

        if (signals.length > 0) {
          applySignalsToDecisions(signals);

          signals.slice(0, 3).forEach((signal) => {
            const impact = signal.support > 0 ? `support +${signal.support}` : `attack +${signal.attack}`;
            const sourceTag = signal.source === 'openclaw' ? '[OpenClaw]' : '[Rule]';
            addLog(`${sourceTag} ${AGENT_NAMES[signal.agentId]} -> ${signal.candidate} ${impact}`);
          });

          if (inferenceMode === 'openclaw') {
            const firstReason = signals.find((signal) => signal.reason)?.reason;
            if (firstReason) addLog(`Reason: ${firstReason}`);
          }
        }

        const firstSignalByAgent = new Map<string, AgentSignal>();
        signals.forEach((signal) => {
          if (!firstSignalByAgent.has(signal.agentId)) {
            firstSignalByAgent.set(signal.agentId, signal);
          }
        });

        if (!cancelled) {
          setAgents((prev) =>
            prev.map((agent) => {
              const localArea = nextAreas[agent.areaId as AreaKey];
              const localSignal = firstSignalByAgent.get(agent.id);
              const nextState = getBaseStateFromArea(localArea);

              if (!localSignal) {
                return { ...agent, state: nextState };
              }

              return {
                ...agent,
                state: nextState,
                bubble: { message: localSignal.message, type: localSignal.bubbleType },
              };
            })
          );
        }
      };

      runTick().finally(() => {
        tickBusyRef.current = false;
      });
    }, 1400);

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [addLog, applySignalsToDecisions, evaporateSignals, inferOpenClawSignal, inferenceMode]);

  const clearBubble = useCallback((agentId: string) => {
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, bubble: null } : a));
  }, []);

  const applyEventEffects = useCallback((ev: EventDef) => {
    setAreas(prev => {
      const next: AreaState = { ...prev };
      (Object.keys(ev.effects) as AreaKey[]).forEach((key) => {
        const effect = ev.effects[key];
        if (!effect) return;
        const current = next[key];
        next[key] = {
          load: clamp(current.load + (effect.load ?? 0)),
          risk: clamp(current.risk + (effect.risk ?? 0)),
        };
      });
      areasRef.current = next;
      return next;
    });
  }, []);

  const triggerEvent = useCallback((eventId: string) => {
    const ev = EVENTS.find(e => e.id === eventId);
    if (!ev) return;

    addLog(`Event: ${ev.label} occurred`);
    setRecentEvents(prev => [ev.label, ...prev].slice(0, 8));
    applyEventEffects(ev);

    setAgents(prev => {
      return prev.map(a => {
        if (a.id === ev.target) {
          if (ev.type === 'danger') {
            return {
              ...a,
              state: 'panicked',
              bubble: { message: 'We need help!!', type: 'attack' }
            };
          } else if (ev.type === 'warning') {
            return {
              ...a,
              state: 'working',
              bubble: { message: 'Hurry up!!', type: 'normal' }
            };
          } else {
            return {
              ...a,
              state: 'idle',
              bubble: { message: 'Yum!', type: 'support' }
            };
          }
        }

        if (a.id !== ev.target && Math.random() > 0.5) {
          if (ev.type === 'danger') {
            return { ...a, bubble: { message: 'I will support!', type: 'support' } };
          }
        }

        return a;
      });
    });
  }, [addLog, applyEventEffects]);

  const runDemoScenario = useCallback(() => {
    if (scenarioRunning) return;
    setScenarioRunning(true);
    addLog('Scenario: electricity -> rush order -> defect');

    triggerEvent('e4');
    setTimeout(() => triggerEvent('e2'), 1600);
    setTimeout(() => triggerEvent('e1'), 3200);
    setTimeout(() => setScenarioRunning(false), 4200);
  }, [addLog, scenarioRunning, triggerEvent]);

  const runWarmup = useCallback(() => {
    if (scenarioRunning) return;

    setAreas(WARMUP_AREAS);
    areasRef.current = WARMUP_AREAS;
    setDecisions(WARMUP_DECISIONS);
    setRecentEvents(['Warmup Seed']);
    setAgents(prev => prev.map(agent => ({ ...agent, bubble: null })));
    addLog('Warmup loaded: pre-accumulated distributed signals');
  }, [addLog, scenarioRunning]);

  const decisionEntries = useMemo(
    () => (Object.entries(decisions) as Array<[CandidateKey, DecisionData]>),
    [decisions]
  );

  const confirmedCount = useMemo(
    () => decisionEntries.filter(([, data]) => data.status === 'confirmed').length,
    [decisionEntries]
  );

  const leadingDecision = useMemo(() => {
    return decisionEntries.reduce(
      (best, current) => {
        const score = current[1].support - current[1].attack;
        return score > best.score ? { name: current[0], score } : best;
      },
      { name: decisionEntries[0]?.[0] ?? 'Fix Tunnel', score: -Infinity }
    );
  }, [decisionEntries]);

  const areaStressLabel = (area: { load: number; risk: number }) => {
    const stress = area.load + area.risk;
    if (stress >= 130) return { label: 'HIGH', tone: 'text-red-800 bg-red-100 border-red-200' };
    if (stress >= 95) return { label: 'MED', tone: 'text-orange-800 bg-orange-100 border-orange-200' };
    return { label: 'LOW', tone: 'text-emerald-800 bg-emerald-100 border-emerald-200' };
  };

  return (
    <div className="min-h-screen lg:h-[100dvh] lg:overflow-hidden bg-[#f4e1c1] text-gray-800">
      <div className="mx-auto h-full min-h-0 max-w-[1500px] p-2 lg:p-3 flex flex-col gap-2">
        <header className="shrink-0 rounded-2xl border border-amber-300 bg-white/90 backdrop-blur-sm px-4 py-3 shadow-md">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-amber-900 leading-tight">Meerkat Workshop</h1>
              <p className="text-xs lg:text-sm text-amber-800 font-semibold">
                1) Event -&gt; 2) Agent signals -&gt; 3) Decision confirmed -&gt; 4) Log
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] lg:text-xs">
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                <div className="text-gray-500">Confirmed</div>
                <div className="font-extrabold text-amber-900">{confirmedCount} / {CANDIDATES.length}</div>
              </div>
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
                <div className="text-gray-500">Leading</div>
                <div className="font-extrabold text-emerald-800">{leadingDecision.name}</div>
              </div>
              <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                <div className="text-gray-500">Top Score</div>
                <div className="font-extrabold text-slate-800">{leadingDecision.score.toFixed(1)}</div>
              </div>
            </div>
          </div>
        </header>

        <section className="shrink-0 grid grid-cols-2 md:grid-cols-5 gap-2">
          {(Object.keys(areas) as AreaKey[]).map((areaId) => {
            const area = areas[areaId];
            const stress = areaStressLabel(area);
            return (
              <div key={areaId} className="rounded-xl border border-amber-300 bg-white/85 px-3 py-2 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-amber-900">{AREA_LABELS[areaId]}</div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${stress.tone}`}>{stress.label}</span>
                </div>
                <div className="mt-1 text-[11px] text-gray-700">
                  load {Math.round(area.load)} / risk {Math.round(area.risk)}
                </div>
              </div>
            );
          })}
        </section>

        <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-2">
          <section className="min-h-0 rounded-2xl border border-amber-300 bg-white/85 p-2 shadow-md">
            <WorkshopMap agents={agents} onBubbleComplete={clearBubble} className="h-full" />
          </section>

          <section className="min-h-0 grid grid-rows-[minmax(0,1fr)_auto_minmax(0,0.72fr)] gap-2">
            <div className="min-h-0 rounded-2xl border border-amber-300 bg-white/90 p-2 shadow-md flex flex-col">
              <h2 className="text-sm font-black text-amber-900 uppercase tracking-wide mb-2">Decision Board</h2>
              <div className="flex-1 min-h-0 space-y-2 overflow-auto pr-1">
                {decisionEntries.map(([name, data]) => {
                  const score = data.support - data.attack;
                  const progress = Math.max(Math.min((score / THRESHOLD) * 100, 100), 0);
                  const contributors = (Object.keys(AGENT_NAMES) as Array<keyof typeof AGENT_NAMES>)
                    .map((agentId) => ({
                      agentId,
                      sp: data.byAgentSupport[agentId] ?? 0,
                      at: data.byAgentAttack[agentId] ?? 0,
                    }))
                    .filter(({ sp, at }) => sp > 0 || at > 0);

                  return (
                    <div key={name} className={`rounded-lg border p-2 ${data.status === 'confirmed' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-800">{name}</div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${score >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {score >= 0 ? '+' : ''}{score.toFixed(1)}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${data.status === 'confirmed' ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'}`}>
                            {data.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-700">
                        <span className="text-emerald-700 font-semibold">S {data.support.toFixed(1)}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="text-red-700 font-semibold">A {data.attack.toFixed(1)}</span>
                        <span className="text-slate-500"> / T {THRESHOLD}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-1.5 rounded-full transition-all ${data.status === 'confirmed' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {contributors.length === 0 && (
                          <span className="text-[10px] text-slate-500">no agent signal yet</span>
                        )}
                        {contributors.map(({ agentId, sp, at }) => (
                          <span key={`${name}-${agentId}`} className="text-[10px] rounded border border-slate-300 bg-white px-1.5 py-0.5">
                            {AGENT_SHORT[agentId]} <span className="text-emerald-700">+{sp.toFixed(1)}</span>/<span className="text-red-700">-{at.toFixed(1)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-300 bg-white/90 p-2 shadow-md">
              <h2 className="text-sm font-black text-amber-900 uppercase tracking-wide mb-2">Controls</h2>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => switchInferenceMode('rule')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border ${
                    inferenceMode === 'rule'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  Rule Mode
                </button>
                <button
                  onClick={() => switchInferenceMode('openclaw')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border ${
                    inferenceMode === 'openclaw'
                      ? 'bg-indigo-700 text-white border-indigo-700'
                      : 'bg-indigo-50 text-indigo-800 border-indigo-300'
                  }`}
                >
                  OpenClaw Mode
                </button>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded border border-slate-300 bg-slate-50 px-2 py-1">
                  <div className="text-slate-500">provider</div>
                  <div className="font-bold text-slate-700">{diagnostics.provider}</div>
                </div>
                <div className="rounded border border-slate-300 bg-slate-50 px-2 py-1">
                  <div className="text-slate-500">latency avg</div>
                  <div className="font-bold text-slate-700">{diagnostics.avgLatencyMs.toFixed(0)} ms</div>
                </div>
                <div className="rounded border border-slate-300 bg-slate-50 px-2 py-1">
                  <div className="text-slate-500">tokens</div>
                  <div className="font-bold text-slate-700">{diagnostics.tokensUsed}</div>
                </div>
                <div className="rounded border border-slate-300 bg-slate-50 px-2 py-1">
                  <div className="text-slate-500">fallbacks</div>
                  <div className="font-bold text-slate-700">{diagnostics.fallbacks}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={runDemoScenario}
                  disabled={scenarioRunning}
                  className="py-2 px-2 rounded-lg font-bold text-xs border border-amber-400 bg-amber-200 text-amber-900 disabled:opacity-60"
                >
                  {scenarioRunning ? 'Running...' : 'Run Scenario'}
                </button>
                <button
                  onClick={runWarmup}
                  disabled={scenarioRunning}
                  className="py-2 px-2 rounded-lg font-bold text-xs border border-sky-400 bg-sky-100 text-sky-900 disabled:opacity-60"
                >
                  Load Warmup
                </button>
                {EVENTS.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => triggerEvent(ev.id)}
                    className={`py-2 px-2 rounded-lg font-semibold text-[11px] border
                      ${ev.type === 'danger'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : ev.type === 'warning'
                          ? 'bg-orange-100 text-orange-800 border-orange-300'
                          : 'bg-green-100 text-green-800 border-green-300'
                      }`}
                  >
                    {ev.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 rounded border border-indigo-200 bg-indigo-50/60 p-2">
                <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Reason Trace</div>
                <div className="mt-1 space-y-1">
                  {reasonFeed.slice(0, 3).map((line, idx) => (
                    <div key={idx} className="text-[10px] text-indigo-900 leading-snug">{line}</div>
                  ))}
                  {reasonFeed.length === 0 && (
                    <div className="text-[10px] text-indigo-700/80">No reason yet.</div>
                  )}
                  {diagnostics.validation !== 'ok' && diagnostics.validation !== 'n/a' && (
                    <div className="text-[10px] text-red-700">validation: {diagnostics.validation}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="min-h-0 rounded-2xl border border-slate-700 bg-[#1f2328] p-2 shadow-inner flex flex-col">
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-slate-400">System Logs</h2>
              <div className="mt-2 space-y-1 overflow-auto pr-1">
                {logs.map((log, i) => (
                  <div key={i} className="text-green-300 font-mono text-[11px] leading-snug">
                    {log}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-slate-500 font-mono text-[11px] italic">Awaiting events...</div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
