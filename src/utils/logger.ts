/**
 * Simple circular buffer logger for time series samples
 */

export type Sample = {
  t: number;
  x: number;
  v: number;
  a: number;
  brake: number; // 0..1 or percent as used by caller
  distance: number;
};

export class Logger {
  private buf: Sample[];
  private capacity: number;
  private idx: number;
  private size: number;

  constructor(capacity = 5000) {
    this.capacity = capacity;
    this.buf = new Array(capacity);
    this.idx = 0;
    this.size = 0;
  }

  push(s: Sample) {
    this.buf[this.idx] = s;
    this.idx = (this.idx + 1) % this.capacity;
    if (this.size < this.capacity) this.size++;
  }

  clear() {
    this.buf = new Array(this.capacity);
    this.idx = 0;
    this.size = 0;
  }

  // returns ordered data from oldest to newest
  getAll(): Sample[] {
    const out: Sample[] = [];
    if (this.size === 0) return out;
    const start = (this.idx - this.size + this.capacity) % this.capacity;
    for (let i = 0; i < this.size; i++) {
      const j = (start + i) % this.capacity;
      out.push(this.buf[j]);
    }
    return out;
  }

  toCSV(): string {
    const rows = this.getAll();
    const header = "t,x,v,a,brake,distance\n";
    const lines = rows.map(
      (r) => `${r.t},${r.x},${r.v},${r.a},${r.brake},${r.distance}`
    );
    return header + lines.join("\n");
  }
}
