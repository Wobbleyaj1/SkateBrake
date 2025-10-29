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
  // threshold acceleration magnitude (m/s^2) above which the rider is considered thrown
  ejectAccelThreshold?: number;
  // threshold jerk magnitude (m/s^3) above which the rider may be thrown
  ejectJerkThreshold?: number;
  // rider center-of-mass height above board (m)
  riderCOMHeight?: number;
  // wheelbase length (m) between front and rear contact points
  wheelbase?: number;
  // tipping factor (0..1) fraction of the static resisting moment required to tip
  tippingFactor?: number;
  // details about why the sim stopped (populated on eject)
  stopDetails?: StopDetails | null;
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
    ejectAccelThreshold: 8,
    ejectJerkThreshold: 20,
    riderCOMHeight: 1.0,
    wheelbase: 0.6,
    tippingFactor: 0.8,
  };
}

/**
 * physics step: reads state.lastBrakePercent for brake decision
 */
/**
 * Perform one physics step. Returns true when the simulation should stop
 * (e.g. reached static equilibrium or collided with obstacle).
 */
export type StopReason = "rest" | "obstacle" | "eject";
export type StopCause = "decel";

export type StopDetails = {
  cause: StopCause;
  decel: number;
  decelThreshold: number;
};

/**
 * Perform one physics step. Returns a StopReason when the simulation should stop
 * (e.g. reached static equilibrium, collided with obstacle, or rider ejected),
 * otherwise returns null.
 */
export function physicsStep(state: SimulationState): StopReason | null {
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
      // static equilibrium: nothing moves -> signal to stop simulation
      state.a = 0;
      state.v = 0;
      state.t += state.dt;
      return "rest";
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

  // compute timestep
  const dt = state.dt;

  // Ejection checks (more physically informed). Skip aggressive ejection checks on the
  // first step to avoid false positives caused by initial transients. We evaluate
  // ejection at any speed (no minimum speed gate), but require the sim to have
  // advanced at least one timestep (state.t > 0).
  if (state.t > 0) {
    // Simple deceleration-only ejection: trigger when measured decel exceeds
    // the configured ejectAccelThreshold. Use only the deceleration rate as
    // requested; geometry/jerk/tipping are ignored.
    const decel = v > 0 && a < 0 ? -a : 0;
    const decelThreshold = state.ejectAccelThreshold ?? 8;

    if (decel >= decelThreshold) {
      state.stopDetails = {
        cause: "decel",
        decel,
        decelThreshold,
      };
      state.a = a;
      state.v = 0;
      state.t += dt;
      return "eject";
    }
  }

  // semi-implicit Euler with an early-stop when velocity crosses zero.
  const prevV = state.v;
  const prevX = state.x;

  state.v = state.v + a * dt;

  // If velocity has effectively reached zero or crossed sign, stop the sim immediately.
  // We do this because this simulation's purpose is to determine whether the board
  // comes to rest before hitting the obstacle; we don't need to simulate reverse motion.
  if (state.v <= velTol || Math.sign(state.v) !== Math.sign(prevV)) {
    // clamp to zero and restore position to previous step (no reverse travel)
    state.v = 0;
    state.a = 0;
    state.x = prevX;
    state.t += dt;
    return "rest";
  }

  // otherwise accept updated velocity and advance position/time
  state.a = a;
  state.x = state.x + state.v * dt;
  state.t += dt;

  // collision with obstacle
  if (state.x >= state.obstaclePosition) {
    state.x = state.obstaclePosition;
    state.v = 0;
    state.a = 0;
    return "obstacle";
  }

  return null;
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
  onEnd,
}: {
  stateRef: React.RefObject<SimulationState>;
  onStep?: (s: SimulationState) => void;
  timeScale?: number;
  uiCallback?: () => void;
  rafRef: React.MutableRefObject<number | null>;
  onEnd?: (reason: StopReason) => void;
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
      const shouldStop = physicsStep(s);
      if (onStep) onStep(s);
      accumulator -= s.dt;

      if (shouldStop) {
        // mark RAF ref as stopped and exit frame so we don't schedule another RAF
        rafRef.current = null;
        // call uiCallback one last time so UI can reflect final state
        if (uiCallback) uiCallback();
        if (onEnd && shouldStop) onEnd(shouldStop);
        return;
      }
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
