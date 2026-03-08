<p align="center">
  <img width="100" height="150" alt="Image" src="https://github.com/user-attachments/assets/7523dee8-1926-40ac-a203-2d2e8b67d173" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1.6-000000?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/OpenClaw-LLM_Mode-4F46E5" alt="OpenClaw Mode" />
</p>

# Meerkat Workshop - Distributed Decision Demo

<p align="center">
  <a href="https://test-test-fawn-phi.vercel.app/">Demo</a> ·
  <a href="https://www.canva.com/design/DAHDV65RocE/PGRWN6F9yRFBjp5mtmKfkA/edit">Pitch</a> ·
  <a href="https://notebooklm.google.com/notebook/337a5e10-1137-4a0f-89a2-4b50802a5cd9">Movie</a>
</p>

Meerkat Workshop is a single-screen simulation that visualizes distributed decision-making in a workshop.
Each agent only reads local area conditions, emits `support/attack` signals, and decisions are confirmed when:

`score = support - attack >= threshold`

## What This Demo Shows

- No central commander logic for final decision confirmation.
- Continuous local sensing by agents (`load/risk` per area).
- Explainable decision process via:
  - per-agent contribution chips,
  - system logs,
  - reason trace (in OpenClaw mode).

## Modes

1. `Rule Mode`
   - Deterministic local thresholds produce agent signals.
2. `OpenClaw Mode`
   - Each agent builds a local context packet and asks OpenClaw inference.
   - Output is schema-validated (`candidate/support/attack/reason`).
   - If inference fails or output is invalid, it falls back to rule signals.

## How It Works

1. Trigger events (`Broken Tools`, `Rush Order`, `Tunnel Collapse`).
2. Area state updates (`load`, `risk`) per event.
3. Every tick (1.4s), each agent emits local signal.
4. Signals accumulate and evaporate over time.
5. `Decision Confirmed` appears when threshold is exceeded.

## UI Guide

- `Top Summary`: Confirmed count, leading candidate, top score.
- `Area Cards`: Current load/risk and stress level (`LOW/MED/HIGH`).
- `Decision Board`: Score, status, progress, per-agent support/attack.
- `Controls`: Mode switch, warmup, scenario, manual events.
- `System Logs`: Time-ordered signal and confirmation trail.
- `Reason Trace`: OpenClaw rationale snippets per tick.

## Tech Stack

| Category | Tech | Version |
|---|---|---|
| Framework | Next.js | 16.1.6 |
| UI | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Lint | ESLint | 9.x |

## Setup

### Prerequisites

- Node.js 20+
- npm

### Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## OpenClaw Endpoint (Optional)

If you want remote inference instead of local mock fallback, set:

```bash
NEXT_PUBLIC_OPENCLAW_ENDPOINT=https://your-openclaw-endpoint.example/api/infer
```

The app sends each agent's local context packet and expects structured JSON output.

## Demo Flow (40s)

1. Click `Load Warmup`.
2. Switch to `OpenClaw Mode`.
3. Click `Run Scenario`.
4. Show `Decision Board`, `Reason Trace`, and `System Logs`.

## Notes

- This repository focuses on demo clarity and explainability, not production orchestration.
- Build behavior may vary by local environment and workspace layout.




