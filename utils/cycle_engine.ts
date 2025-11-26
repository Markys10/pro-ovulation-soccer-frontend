// frontend/utils/cycle_engine.ts
// Portado desde cycle_engine.py -> mantuve la lógica y constantes originales.

type Row = {
  K: number;
  L: number;
  r: number;
  w: number;
  sK: number[];
  w_norm?: number;
};

export type ScoreResult = {
  cats: {
    regla: number;
    perrisima: number;
    horny: number;
    nifunifa: number;
    sexual_prob?: number;
    dominance_gap?: number;
    dominant_sex?: string | null;
  };
  reliability: number;
  reliability_pct: number;
  reliability_color: string;
  t0: Date | null;
  used_obs: Date[];
};

// ---------------------------
// Priors (igual que en Python)
// ---------------------------
const P_K: Record<number, number> = { 26: 0.10, 27: 0.12, 28: 0.30, 29: 0.20, 30: 0.15, 31: 0.08, 32: 0.05 };
const P_L: Record<number, number> = { 2: 0.05, 3: 0.30, 4: 0.35, 5: 0.20, 6: 0.07, 7: 0.03 };

// Base 28-day template (days 1..28)
const BASE_28: Record<number, number> = {
  1: 0.05, 2: 0.05, 3: 0.05, 4: 0.05, 5: 0.05, 6: 0.05,
  7: 0.12, 8: 0.18, 9: 0.26, 10: 0.34, 11: 0.44, 12: 0.55,
  13: 0.64, 14: 0.70, 15: 0.63, 16: 0.52, 17: 0.40
};
{
  const _start = 0.22; const _end = 0.12;
  for (let i = 0, day = 18; day <= 28; i++, day++) {
    BASE_28[day] = _start + (_end - _start) * (i / (28 - 18));
  }
}

// thresholds
const T_PERRISIMA = 0.75;
const T_HORNY = 0.40;

// likelihood constants
const P_BLEED = 0.95;
const P_FALSE = 0.05;

// reliability thresholds (pct)
const RELIABILITY_THRESHOLDS: Record<string, number> = { green: 75.0, yellow: 50.0, red: 0.0 };

// ---------------------------
// Utils: parse date (accept Date or ISO string)
// ---------------------------
function toDate(d: Date | string): Date {
  if (d instanceof Date) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // parse iso -> keep date part (ignore timezone time-of-day)
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

function daysBetween(a: Date, b: Date): number {
  // returns (a - b) in days, integer
  const msPerDay = 24 * 60 * 60 * 1000;
  // use UTC midnight to avoid DST issues
  const au = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bu = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((au - bu) / msPerDay);
}

function uniqueDates(arr: Date[]): Date[] {
  const seen = new Set<string>();
  const out: Date[] = [];
  for (const d of arr) {
    const key = d.toISOString().slice(0, 10);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(d);
    }
  }
  return out;
}

function roundTo(n: number, decimals = 4) {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

// ---------------------------
// Interpolate base curve to K days
// ---------------------------
export function interp_curve(K: number): number[] {
  const old_x = Array.from({ length: 28 }, (_, i) => i / 27); // 0..1 with 28 points
  const old_y = Array.from({ length: 28 }, (_, i) => BASE_28[i + 1]);
  const new_x = Array.from({ length: K }, (_, i) => (K > 1 ? i / (K - 1) : 0));
  const sK: number[] = [];
  for (const nx of new_x) {
    let s: number = old_y[0];
    if (nx <= old_x[0]) {
      s = old_y[0];
    } else if (nx >= old_x[old_x.length - 1]) {
      s = old_y[old_y.length - 1];
    } else {
      for (let j = 0; j < old_x.length - 1; j++) {
        if (old_x[j] <= nx && nx <= old_x[j + 1]) {
          const t = (nx - old_x[j]) / (old_x[j + 1] - old_x[j]);
          s = old_y[j] + t * (old_y[j + 1] - old_y[j]);
          break;
        }
      }
    }
    sK.push(s);
  }
  return sK;
}

// ---------------------------
// Likelihood of observation set given (K,L,r,t0)
// ---------------------------
export function likelihood(obs_dates: (Date | string)[], K: number, L: number, r: number, t0: Date): number {
  let prod = 1.0;
  const t0d = toDate(t0);
  for (const tRaw of obs_dates) {
    const t = toDate(tRaw);
    const d = daysBetween(t, t0d);
    const cd = ((r + d - 1) % K + K) % K + 1; // ensure positive modulo
    if (1 <= cd && cd <= L) {
      prod *= P_BLEED;
    } else {
      prod *= P_FALSE;
    }
  }
  return prod;
}

// ---------------------------
// Cluster detection and expansion (suggestions)
// ---------------------------
export function get_suggested_cluster_fills(obs_dates: (Date | string)[], max_L = 7): Date[] {
  if (!obs_dates || obs_dates.length === 0) return [];
  const obs = obs_dates.map(toDate).sort((a, b) => a.getTime() - b.getTime());
  const clusters: Date[][] = [];
  let cur: Date[] = [obs[0]];
  for (const d of obs.slice(1)) {
    if (daysBetween(d, cur[cur.length - 1]) <= (max_L - 1)) {
      cur.push(d);
    } else {
      clusters.push(cur);
      cur = [d];
    }
  }
  clusters.push(cur);
  const suggested: Date[] = [];
  for (const cl of clusters) {
    if (cl.length <= 1) continue;
    const start = cl[0];
    const end = cl[cl.length - 1];
    const diff = daysBetween(end, start);
    for (let i = 0; i <= diff; i++) {
      const candidate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
      // if candidate not present in cl
      const present = cl.some(c => daysBetween(c, candidate) === 0);
      if (!present) suggested.push(candidate);
    }
  }
  return uniqueDates(suggested).sort((a, b) => a.getTime() - b.getTime());
}

export function apply_cluster_fill(obs_dates: (Date | string)[], max_L = 7): Date[] {
  if (!obs_dates || obs_dates.length === 0) return [];
  const obs = obs_dates.map(toDate).sort((a, b) => a.getTime() - b.getTime());
  const clusters: Date[][] = [];
  let cur: Date[] = [obs[0]];
  for (const d of obs.slice(1)) {
    if (daysBetween(d, cur[cur.length - 1]) <= (max_L - 1)) {
      cur.push(d);
    } else {
      clusters.push(cur);
      cur = [d];
    }
  }
  clusters.push(cur);
  const expanded: Date[] = [];
  for (const cl of clusters) {
    if (cl.length === 1) {
      expanded.push(cl[0]);
    } else {
      const start = cl[0];
      const end = cl[cl.length - 1];
      const diff = daysBetween(end, start);
      for (let i = 0; i <= diff; i++) {
        expanded.push(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i)));
      }
    }
  }
  return uniqueDates(expanded).sort((a, b) => a.getTime() - b.getTime());
}

// ---------------------------
// Build posterior over (K,L,r)
// ---------------------------
export function build_posterior(obs_dates: (Date | string)[]): [Row[], Date | null] {
  if (!obs_dates || obs_dates.length === 0) return [[], null];
  const obs = obs_dates.map(toDate).sort((a, b) => a.getTime() - b.getTime());
  const t0 = obs[obs.length - 1];
  const rows: Row[] = [];
  for (const Ks of Object.keys(P_K)) {
    const K = Number(Ks);
    const pk = P_K[K];
    const sK = interp_curve(K);
    for (const Ls of Object.keys(P_L)) {
      const L = Number(Ls);
      const pl = P_L[L];
      for (let r = 1; r <= L; r++) {
        const prior = pk * pl * (1.0 / L);
        const like = likelihood(obs, K, L, r, t0);
        const w = prior * like;
        rows.push({ K, L, r, w, sK });
      }
    }
  }
  const total = rows.reduce((acc, x) => acc + x.w, 0);
  if (total <= 0) {
    const n = rows.length;
    for (const x of rows) {
      x.w_norm = 1.0 / n;
    }
  } else {
    for (const x of rows) {
      x.w_norm = x.w / total;
    }
  }
  return [rows, t0];
}

// ---------------------------
// Reliability metric (entropy-based)
// ---------------------------
export function compute_reliability(cats: Record<string, number>): [number, number, string] {
  const keys = ['regla', 'perrisima', 'horny', 'nifunifa'];
  let probs = keys.map(k => Math.max(0.0, Number(cats[k] || 0.0)));
  const s = probs.reduce((a, b) => a + b, 0);
  let reliability = 0.0;
  if (s <= 0) {
    reliability = 0.0;
  } else {
    probs = probs.map(p => p / s);
    let H = 0.0;
    for (const p of probs) {
      if (p > 0) H -= p * Math.log2(p);
    }
    const max_H = Math.log2(4);
    const H_norm = max_H > 0 ? H / max_H : 1.0;
    reliability = Math.max(0.0, 1.0 - H_norm);
  }
  const pct = reliability * 100.0;
  let color = 'red';
  if (pct >= RELIABILITY_THRESHOLDS.green) color = 'green';
  else if (pct >= RELIABILITY_THRESHOLDS.yellow) color = 'yellow';
  else color = 'red';
  return [reliability, Math.round(pct * 10) / 10, color]; // round to 0.1 like Python round(...,1)
}

// ---------------------------
// Main scoring API
// ---------------------------
export function score_for_target(
  obs_dates: (Date | string)[],
  target_date: Date | string,
  certain_dates: (Date | string)[] | null = null,
  auto_fill_clusters = true,
  max_L_fill = 7
): ScoreResult | null {
  const obs = (obs_dates || []).map(toDate).sort((a, b) => a.getTime() - b.getTime());
  const certainSet = new Set((certain_dates || []).map(d => toDate(d).toISOString().slice(0, 10)));
  const used_obs = auto_fill_clusters ? apply_cluster_fill(obs, max_L_fill) : obs;
  if (!used_obs || used_obs.length === 0) return null;

  const target = toDate(target_date);
  // if target explicitly marked certain -> return certainty immediately
  if (certainSet.has(target.toISOString().slice(0, 10))) {
    const cats = { regla: 1.0, perrisima: 0.0, horny: 0.0, nifunifa: 0.0 };
    const [reliability, pct, color] = compute_reliability(cats);
    return {
      cats,
      reliability,
      reliability_pct: pct,
      reliability_color: color,
      t0: used_obs.length ? used_obs[used_obs.length - 1] : null,
      used_obs
    };
  }

  const [rows, t0] = build_posterior(used_obs);
  if (t0 === null) return null;

  const d = daysBetween(target, t0);
  const cats: Record<string, number> = { regla: 0.0, perrisima: 0.0, horny: 0.0, nifunifa: 0.0 };
  for (const r of rows) {
    const K = r.K; const L = r.L; const rr = r.r; const w = r.w_norm || 0; const sK = r.sK;
    const cd = ((rr + d - 1) % K + K) % K + 1;
    const desire = sK[cd - 1];
    if (1 <= cd && cd <= L) {
      cats['regla'] += w;
    } else {
      if (desire >= T_PERRISIMA) cats['perrisima'] += w;
      else if (desire >= T_HORNY) cats['horny'] += w;
      else cats['nifunifa'] += w;
    }
  }
  const sSum = Object.values(cats).reduce((a, b) => a + b, 0);
  if (sSum > 0) {
    for (const k of Object.keys(cats)) cats[k] = cats[k] / sSum;
  } else {
    for (const k of Object.keys(cats)) cats[k] = 0.25;
  }
  const [reliability, pct, color] = compute_reliability(cats);
  const cats_rounded: any = {};
  for (const k of ['regla', 'perrisima', 'horny', 'nifunifa']) cats_rounded[k] = roundTo(cats[k], 4);
  cats_rounded['sexual_prob'] = roundTo((cats_rounded['horny'] || 0) + (cats_rounded['perrisima'] || 0), 4);

  const sorted_vals = (['regla', 'perrisima', 'horny', 'nifunifa'] as const)
    .map(k => [cats_rounded[k], k] as [number, string])
    .sort((a, b) => b[0] - a[0]);
  const p_max = sorted_vals[0][0];
  const top_cat = sorted_vals[0][1];
  const p2 = sorted_vals[1][0];
  cats_rounded['dominance_gap'] = roundTo(p_max - p2, 4);
  if (cats_rounded['sexual_prob'] > Math.max(cats_rounded['regla'], cats_rounded['nifunifa'])) {
    cats_rounded['dominant_sex'] = (cats_rounded['perrisima'] >= cats_rounded['horny']) ? 'perrisima' : 'horny';
  } else {
    cats_rounded['dominant_sex'] = null;
  }

  // build return object with types matching Python output
  const result: ScoreResult = {
    cats: {
      regla: cats_rounded['regla'],
      perrisima: cats_rounded['perrisima'],
      horny: cats_rounded['horny'],
      nifunifa: cats_rounded['nifunifa'],
      sexual_prob: cats_rounded['sexual_prob'],
      dominance_gap: cats_rounded['dominance_gap'],
      dominant_sex: cats_rounded['dominant_sex']
    } as any,
    reliability: roundTo(reliability, 4),
    reliability_pct: pct,
    reliability_color: color,
    t0,
    used_obs
  };
  return result;
}
