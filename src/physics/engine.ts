/**
 * physics/engine.ts
 * Basic physics stepper for single DOF motion of skateboard+rider along an incline.
 * Uses a fixed timestep semi-implicit Euler integrator.
 *
 * Exports:
 *  - SimulationState type
 *  - createDefaultState()
 *  - startLoop({ stateRef, onStep, timeScale, uiCallback, rafRef })
 *  - stopLoop(rafRef)
 *
 * The loop calls onStep(state) each physics step **after** updating state and applying fuzzy brake
 * (the app provides brake percent by writing state.lastBrakePercent before or during step).
 */

export type SimulationState = {
  // dynamic
  t: number; // seconds
  dt: number; // physics timestep
  x: number; // position (m)
  v: number; // velocity (m/s)
  a: number; // acceleration (m/s^2)
  // physical params
  mass: number; // kg
  mu: number; // friction coefficient
  theta: number; // incline (radians)
  c_roll: number; // rolling resistance coefficient
  obstaclePosition: number; // m
  lastBrakePercent: number; // 0..1 (written by controller)
};

export function createDefaultState(): SimulationState {
  return {
    t: 0,
    dt: 1 / 120, // physics substeps: 120Hz default for stability
    x: 0,
    v: 6,
    a: 0,
    mass: 70,
    mu: 0.7,
    theta: 0,
    c_roll: 0.01,
    obstaclePosition: 20,
    lastBrakePercent: 0,
  };
}

/**
 * physics step: reads state.lastBrakePercent for brake decision
 */
export function physicsStep(state: SimulationState) {
  const g = 9.81;
  const m = Math.max(0.1, state.mass);
  const theta = state.theta;
  const N = m * g * Math.cos(theta);
  // downslope gravitational force (positive downhill)
  const F_gravity = m * g * Math.sin(theta);
  const F_roll = state.c_roll * N; // rolling resistance approx (magnitude)
  const F_maxBrake = state.mu * N;

  // braking: clipped by F_maxBrake, magnitude only here
  const brakePercent = Math.max(0, Math.min(1, state.lastBrakePercent ?? 0));
  const F_brake_mag = Math.min(F_maxBrake, brakePercent * F_maxBrake);



  // define net force along slope with positive direction toward increasing x (toward obstacle)
  // gravity acts downhill which we assume pushes toward positive x if theta>0.
  let F_net = 0;

  const v = state.v;
  // use a slightly larger velocity tolerance to avoid numeric sign-flipping
  // and chattering when the skateboard is effectively stopped
  const velTol = 1e-3;

  

  // If nearly stopped, apply a simple static-friction-like check: the combination of
  // driving forces (gravity) must overcome resistive forces (rolling + braking) to start motion.
  if (Math.abs(v) <= velTol) {
    // driving (positive = toward +x/downhill)
    const drive = F_gravity;
    const resist = F_roll + F_brake_mag;
    if (drive > resist) {
      // will start moving toward +x
      F_net = drive - resist;
    } else if (drive < -resist) {
      // will start moving toward -x (unlikely in normal config but handle symmetry)
      F_net = drive + resist;
    } else {
      // static equilibrium: nothing moves
      state.a = 0;
      state.v = 0;
      state.t += state.dt;
      return;
    }
  } else {
    // when moving, resistive forces oppose the direction of motion
    // gravity always acts as F_gravity (positive downhill)
    F_net += F_gravity;
    // rolling resistance opposes motion
    F_net -= Math.sign(v) * F_roll;
    // braking opposes motion
    F_net -= Math.sign(v) * F_brake_mag;
  }

  // acceleration
  const a = F_net / m;

  // semi-implicit Euler
  const dt = state.dt;
  state.v = state.v + a * dt;

  // avoid tiny oscillations / sign flips around zero velocity
  if (Math.abs(state.v) < velTol) {
    state.v = 0;
    state.a = 0;
  } else {
    // if sign flipped across the update and the new velocity is still small,
    // clamp to zero to prevent chattering
    if (Math.sign(state.v) !== Math.sign(v) && Math.abs(state.v) < 5 * velTol) {
      state.v = 0;
      state.a = 0;
    } else {
      state.a = a;
    }
  }

  state.x = state.x + state.v * dt;
  state.t += dt;

  // collision with obstacle
  if (state.x >= state.obstaclePosition) {
    state.x = state.obstaclePosition;
    state.v = 0;
    state.a = 0;
  }
}

/**
 * Start the RAF-based loop with a fixed physics timestep. The loop performs physics substeps
 * to compensate for variable RAF timing.
 *
 * params:
 *  - stateRef: React ref containing SimulationState (mutated in place)
 *  - onStep: callback(state) after each physics step (for logging & controller)
 *  - timeScale: multiplier for dt (1 = real time)
 *  - uiCallback: optional callback invoked occasionally to trigger UI refresh
 *  - rafRef: a ref to store RAF id for cancellation
 */
export function startLoop({
  stateRef,
  onStep,
  timeScale = 1,
  uiCallback,
  rafRef,
}: {
  stateRef: React.RefObject<SimulationState>;
  onStep?: (s: SimulationState) => void;
  timeScale?: number;
  uiCallback?: () => void;
  rafRef: React.MutableRefObject<number | null>;
}) {
  let lastTime = performance.now();
  let accumulator = 0;
  const maxAccum = 0.1;

  function frame(now: number) {
    const s = stateRef.current!;
    const elapsed = (now - lastTime) / 1000;
    lastTime = now;
    accumulator += elapsed * timeScale;
    if (accumulator > maxAccum) accumulator = maxAccum; // avoid spiral of death

    // run physics in fixed dt units
    while (accumulator >= s.dt) {
      // call controller via state.lastBrakePercent if host set it prior to step
      physicsStep(s);
      if (onStep) onStep(s);
      accumulator -= s.dt;
    }

    // occasional UI callback
    if (uiCallback) uiCallback();

    rafRef.current = requestAnimationFrame(frame);
  }

  rafRef.current = requestAnimationFrame(frame);
}

/**
 * Stop the RAF loop (if running)
 */
export function stopLoop(rafRef: React.MutableRefObject<number | null>) {
  if (rafRef.current !== null) {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }
}
