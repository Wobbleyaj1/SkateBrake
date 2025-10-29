/**
 * fuzzy/controller.ts
 * Implements a small Mamdani fuzzy controller: Speed + Distance -> BrakePercent (0..1)
 *
 * Exports:
 *  - getBrakePercent(speed: number, distance: number): number
 *  - getDefaultMFs(): to retrieve default MF parameters for UI
 *  - setMemberships(obj): apply MF changes from UI
 *
 * Membership functions are triangular or trapezoidal specified by parameter arrays.
 */

type MF =
  | { name: string; type: "tri"; params: [number, number, number] }
  | { name: string; type: "trap"; params: [number, number, number, number] };

// default MFs (numbers chosen for ranges: speed 0-10 m/s, distance 0-20 m, brake 0-1)
let speedMFs: MF[] = [
  { name: "Low", type: "tri", params: [0, 0, 4] },
  { name: "Medium", type: "tri", params: [2, 5, 8] },
  { name: "High", type: "tri", params: [6, 10, 10] },
];

let distanceMFs: MF[] = [
  { name: "Close", type: "tri", params: [0, 0, 5] },
  { name: "Medium", type: "tri", params: [3, 9, 15] },
  { name: "Far", type: "tri", params: [12, 20, 20] },
];

let brakeMFs: MF[] = [
  { name: "Soft", type: "tri", params: [0, 0, 0.4] },
  { name: "Moderate", type: "tri", params: [0.2, 0.5, 0.8] },
  { name: "Hard", type: "tri", params: [0.6, 1, 1] },
];

const rules = [
  { dist: "Close", speed: "High", brake: "Hard" },
  { dist: "Close", speed: "Medium", brake: "Hard" },
  { dist: "Close", speed: "Low", brake: "Moderate" },
  { dist: "Medium", speed: "High", brake: "Moderate" },
  { dist: "Medium", speed: "Medium", brake: "Moderate" },
  { dist: "Medium", speed: "Low", brake: "Soft" },
  { dist: "Far", speed: "High", brake: "Moderate" },
  { dist: "Far", speed: "Medium", brake: "Soft" },
  { dist: "Far", speed: "Low", brake: "Soft" },
];

// MF evaluation helpers
function tri(x: number, a: number, b: number, c: number) {
  if (x <= a || x >= c) return 0;
  if (x <= b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}
function trap(x: number, a: number, b: number, c: number, d: number) {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}
function evalMF(mf: MF, x: number) {
  if (mf.type === "tri") {
    const [a, b, c] = mf.params;
    return tri(x, a, b, c);
  } else {
    return trap(x, ...mf.params);
  }
}

// Provide accessors for UI
export function getDefaultMFs() {
  return {
    Speed: JSON.parse(JSON.stringify(speedMFs)),
    Distance: JSON.parse(JSON.stringify(distanceMFs)),
    Brake: JSON.parse(JSON.stringify(brakeMFs)),
  };
}
export function setMemberships(obj: any) {
  if (obj.Speed) speedMFs = obj.Speed;
  if (obj.Distance) distanceMFs = obj.Distance;
  if (obj.Brake) brakeMFs = obj.Brake;
}

/**
 * Compute brake percent:
 *  - fuzzify inputs
 *  - evaluate rule activations (min for AND)
 *  - aggregate (max) for each output MF
 *  - defuzzify via centroid on discrete resolution
 */
export function getBrakePercent(speed: number, distance: number) {
  // fuzzify
  const speedDegs = Object.fromEntries(
    speedMFs.map((m) => [m.name, evalMF(m, speed)])
  );
  const distDegs = Object.fromEntries(
    distanceMFs.map((m) => [m.name, evalMF(m, distance)])
  );

  // rule activations
  const brakeActivations: Record<string, number> = {};
  for (const r of rules) {
    const sd = speedDegs[r.speed] ?? 0;
    const dd = distDegs[r.dist] ?? 0;
    const degree = Math.min(sd, dd);
    brakeActivations[r.brake] = Math.max(
      brakeActivations[r.brake] ?? 0,
      degree
    );
  }

  // aggregate and defuzzify via centroid
  // discretize brake range 0..1
  const samples = 200;
  let num = 0;
  let den = 0;
  for (let i = 0; i <= samples; i++) {
    const x = i / samples;
    // aggregated membership at x is max over clipped base MF values
    let mu = 0;
    for (const bmf of brakeMFs) {
      const base = evalMF(bmf, x);
      const act = brakeActivations[bmf.name] ?? 0;
      mu = Math.max(mu, Math.min(base, act));
    }
    num += x * mu;
    den += mu;
  }
  if (den === 0) return 0;
  return num / den;
}

// compute brake percent from an explicit set of MFs (used by the tuner for live preview)
export function computeBrakeWithMFs(mfs: any, speed: number, distance: number) {
  const speedMFsLocal: MF[] = mfs.Speed;
  const distanceMFsLocal: MF[] = mfs.Distance;
  const brakeMFsLocal: MF[] = mfs.Brake;

  const speedDegs = Object.fromEntries(
    speedMFsLocal.map((m) => [m.name, evalMF(m, speed)])
  );
  const distDegs = Object.fromEntries(
    distanceMFsLocal.map((m) => [m.name, evalMF(m, distance)])
  );

  const brakeActivations: Record<string, number> = {};
  for (const r of rules) {
    const sd = speedDegs[r.speed] ?? 0;
    const dd = distDegs[r.dist] ?? 0;
    const degree = Math.min(sd, dd);
    brakeActivations[r.brake] = Math.max(
      brakeActivations[r.brake] ?? 0,
      degree
    );
  }

  const samples = 200;
  let num = 0;
  let den = 0;
  for (let i = 0; i <= samples; i++) {
    const x = i / samples;
    let mu = 0;
    for (const bmf of brakeMFsLocal) {
      const base = evalMF(bmf, x);
      const act = brakeActivations[bmf.name] ?? 0;
      mu = Math.max(mu, Math.min(base, act));
    }
    num += x * mu;
    den += mu;
  }
  if (den === 0) return 0;
  return num / den;
}
