# Fuzzy Skateboard Braking Simulation

This repository contains a compact React + TypeScript application built with Vite that simulates a skateboard rider braking using a small Mamdani fuzzy controller. The app is intended for experimentation and visualization of braking strategies and safety heuristics.

This README explains how to use the app, how to develop it locally, and how to recreate the project from scratch.

## Table of contents

- Project summary
- Quick start (run locally)
- Development workflow (build, lint, test)
- Project structure and key files
- How it works (architecture: physics, fuzzy controller, UI)
- Recreating the project from scratch
- Adding tests and CI
- Troubleshooting
- Contributing
- License

## Project summary

- Purpose: simulate single-degree-of-freedom motion of a skateboard+rider down an incline, apply a fuzzy braking controller, and visualize time-series results (velocity, acceleration, brake percent, distance).
- Key concepts: semi-implicit Euler physics stepper, Mamdani fuzzy controller (Speed + Distance -> Brake), circular-buffer logger for chart data.
- UI: React + TypeScript + MUI for controls and layout; Recharts for simple time-series charts.

## Quick start (run locally)

Prerequisites

- Node.js
- npm

Install and run

1. Clone the repository:

```bash
git clone https://github.com/Wobbleyaj1/SkateBrake.git && cd SkateBrake
```

2. Install dependencies:

```bash
npm install
```

3. Start the dev server with HMR (fast feedback):

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

5. Preview the production build locally:

```bash
npm run preview
```

Linting

```bash
npm run lint
```

## Development workflow

- `npm run dev` — start Vite dev server with fast refresh.
- `npm run build` — TypeScript build + Vite bundle for production.
- `npm run preview` — serve the built assets locally.
- `npm run lint` — run ESLint checks (config is present in `eslint.config.js`).

If you add new TypeScript paths or change `tsconfig` behavior, adjust `tsconfig.app.json` and `eslint.config.js` accordingly.

## Project structure

Top-level files and folders you will commonly use:

- `index.html` — app root used by Vite.
- `package.json` — scripts and dependencies.
- `src/` — application source.
  - `main.tsx` — React entry point.
  - `App.tsx` — main UI and wiring of simulation controls, canvas, charts, and snackbar.
  - `components/` — React components (ControlsPanel, FuzzyTuner, SimulationCanvas, GraphSelector, TimeSeriesChart).
  - `physics/engine.ts` — physics integrator, start/stop loop, and `SimulationState` type.
  - `fuzzy/controller.ts` — fuzzy membership functions, rule evaluation, and defuzzification.
  - `utils/logger.ts` — circular buffer logger for time-series samples and CSV export.
  - `tests/` — place for unit/integration tests (currently empty; recommended additions below).

## How it works (high level)

1. Simulation state (`SimulationState`) holds dynamic variables (`t, x, v, a`), physical parameters (mass, friction `mu`, incline `theta`, rolling resistance), and controller output (`lastBrakePercent`).

2. The app runs a RAF-based loop in `physics/startLoop` that accumulates real time and executes fixed `dt` physics substeps (semi-implicit Euler) to maintain deterministic integration.

3. `physicsStep` computes forces, brakes, rolling resistance, updates velocity/position, and checks for stop conditions:

   - `rest` — static equilibrium or speed dropped to zero.
   - `obstacle` — board reached obstacle position.
   - `eject` — deceleration exceeded `ejectAccelThreshold` (user-configurable).

4. The fuzzy controller (`fuzzy/controller.ts`) fuzzifies `Speed` and `Distance`, applies a small rule set, aggregates output activations for `Brake` MFs, and defuzzifies via centroid sampling to a brake percent (0..1).

5. `App.tsx` logs samples via `Logger` and renders `TimeSeriesChart` components for velocity, acceleration, brake percent, and distance.

## Recreate this project from scratch

1. Create a new Vite + React + TypeScript project:

```bash
npm create vite@latest my-skate-app -- --template react-ts
cd my-skate-app
npm install
```

2. Install UI and charting dependencies used here (MUI + Recharts):

```bash
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material recharts
```

3. Add TypeScript types for React if needed (dev):

```bash
npm install -D @types/react @types/react-dom
```

4. Create the folder layout used here:

```
src/
  components/
  physics/
  fuzzy/
  utils/
```

5. Implement a small physics stepper `physics/engine.ts` with:

   - `SimulationState` type
   - `createDefaultState()` factory
   - `physicsStep(state)` performing one fixed-dt update and returning a `StopReason | null`
   - `startLoop({stateRef, onStep, timeScale, uiCallback, rafRef, onEnd})` to run RAF + fixed-step substeps
   - `stopLoop(rafRef)` to cancel RAF

6. Implement a `fuzzy/controller.ts` with:

   - Membership function definitions for `Speed`, `Distance`, and `Brake`.
   - MF evaluation helpers (triangular/trapezoidal).
   - A small set of rules mapping `Speed`+`Distance` -> `Brake`.
   - A defuzzifier (centroid sampling) to convert aggregated output MF to brake percent.

7. Wire everything in `App.tsx`:

   - Manage parameters with React state and `ControlsPanel` sliders.
   - Keep a mutable `stateRef` for `SimulationState` and a `Logger` instance for samples.
   - On each physics step, compute `getBrakePercent(speed, distance)` and write `state.lastBrakePercent` before stepping.
   - Start/stop/reset handlers that control the RAF loop and clear logger/state when appropriate.

8. Add charts (`TimeSeriesChart`) using `recharts` and a simple `SimulationCanvas` for visual feedback.

This repo's files are a small, practical reference implementation you can adapt.

## Adding tests and CI

- Unit tests: add Jest or Vitest. For a Vite + React + TS project, `vitest` works well and integrates with Vite.

  - Example quick-start: `npm install -D vitest @testing-library/react @testing-library/jest-dom` and add `vitest` script.
  - Test ideas: unit tests for `physicsStep` (rest/obstacle/eject cases), fuzzy controller outputs for known inputs, and logger behavior.

- CI: Add a simple workflow that checks out code, installs deps, runs `npm run build`, and runs tests/lint.

## Troubleshooting

- Build errors after editing TS files: run `npm run build` to see TypeScript compile errors. Fix types or update `tsconfig`.
- HMR not updating: ensure `npm run dev` is running; sometimes clearing the browser cache helps.
