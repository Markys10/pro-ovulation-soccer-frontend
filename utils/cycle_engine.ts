// cycle_engine.ts - Motor bayesiano para predicción del ciclo menstrual
// Traducido desde Python a TypeScript

// Priors (ajustables)
const P_K: { [key: number]: number } = {
  26: 0.10, 27: 0.12, 28: 0.30, 29: 0.20, 30: 0.15, 31: 0.08, 32: 0.05
};

const P_L: { [key: number]: number } = {
  2: 0.05, 3: 0.30, 4: 0.35, 5: 0.20, 6: 0.07, 7: 0.03
};

// Base desire curve (template 28 days)
const BASE_28: { [key: number]: number } = {
  1: 0.05, 2: 0.05, 3: 0.05, 4: 0.05, 5: 0.05, 6: 0.05,
  7: 0.12, 8: 0.18, 9: 0.26, 10: 0.34, 11: 0.44, 12: 0.55,
  13: 0.64, 14: 0.70, 15: 0.63, 16: 0.52, 17: 0.40
};

// Fill 18..28 linearly
const _start = 0.22;
const _end = 0.12;
for (let i = 0, day = 18; day <= 28; i++, day++) {
  BASE_28[day] = _start + (_end - _start) * (i / (28 - 18));
}

// Thresholds (ajustables)
const T_PERRISIMA = 0.75;
const T_HORNY = 0.40;
const T_REG = 0.15;

// Likelihood constants
const P_BLEED = 0.95;
const P_FALSE = 0.05;

// Helpers
function interpCurve(K: number): number[] {
  /**
   * Rescale/interpolate BASE_28 (28 points) to K days.
   * Return array of length K indexed 0..K-1 with desire scores in [0,1].
   */
  const old_x = Array.from({ length: 28 }, (_, i) => i / 27);
  const old_y = Array.from({ length: 28 }, (_, i) => BASE_28[i + 1]);
  const new_x = Array.from({ length: K }, (_, i) => (K > 1 ? i / (K - 1) : 0));
  const sK: number[] = [];

  for (const nx of new_x) {
    let s: number;
    if (nx <= old_x[0]) {
      s = old_y[0];
    } else if (nx >= old_x[old_x.length - 1]) {
      s = old_y[old_y.length - 1];
    } else {
      s = old_y[0]; // default
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

function likelihood(
  obs_dates: Date[],
  K: number,
  L: number,
  r: number,
  t0: Date
): number {
  /**
   * obs_dates: array of Date objects
   * K: cycle length
   * L: bleed length
   * r: offset (1..L) indicating that t0 corresponds to day r of rule
   * t0: reference date (last observed bleed date)
   * Returns product of P(obs | theta) over obs_dates.
   */
  let prod = 1.0;
  for (const t of obs_dates) {
    const d = Math.floor((t.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24));
    // compute cycle day of that observation given reference r and cycle K
    const cd = ((r + d - 1) % K) + 1;
    if (1 <= cd && cd <= L) {
      prod *= P_BLEED;
    } else {
      prod *= P_FALSE;
    }
  }
  return prod;
}

interface PosteriorRow {
  K: number;
  L: number;
  r: number;
  w: number;
  w_norm: number;
  sK: number[];
}

function buildPosterior(obs_dates: Date[]): { rows: PosteriorRow[]; t0: Date | null } {
  /**
   * obs_dates: array of Date objects (must be sorted ascending)
   * returns {rows, t0}
   *   rows: array of objects {K, L, r, w, w_norm, sK}
   *   t0: last observation date used as reference
   */
  if (obs_dates.length === 0) {
    return { rows: [], t0: null };
  }

  const t0 = obs_dates[obs_dates.length - 1];
  const rows: PosteriorRow[] = [];

  for (const [K, pk] of Object.entries(P_K)) {
    const Knum = parseInt(K);
    const sK = interpCurve(Knum);
    for (const [L, pl] of Object.entries(P_L)) {
      const Lnum = parseInt(L);
      for (let r = 1; r <= Lnum; r++) {
        const prior = pk * pl * (1.0 / Lnum);
        const like = likelihood(obs_dates, Knum, Lnum, r, t0);
        const w = prior * like;
        rows.push({ K: Knum, L: Lnum, r, w, w_norm: 0, sK });
      }
    }
  }

  const total = rows.reduce((sum, x) => sum + x.w, 0);
  if (total <= 0) {
    // fallback: uniform if likelihood underflows
    const n = rows.length;
    for (const x of rows) {
      x.w_norm = 1.0 / n;
    }
  } else {
    for (const x of rows) {
      x.w_norm = x.w / total;
    }
  }

  return { rows, t0 };
}

export interface PredictionScore {
  regla: number;
  perrisima: number;
  horny: number;
  nifunifa: number;
}

export function scoreForTarget(
  obs_dates: (Date | string)[],
  target_date: Date
): PredictionScore | null {
  /**
   * obs_dates: array of Date objects or ISO strings
   * target_date: Date
   * returns: object with keys {regla, perrisima, horny, nifunifa} with normalized probabilities
   */
  // Handle empty or invalid inputs
  if (!obs_dates || obs_dates.length === 0) {
    return null;
  }

  // ensure Date objects and filter invalid dates
  const dates = obs_dates
    .map(d => {
      try {
        if (typeof d === 'string') {
          // Handle YYYY-MM-DD format properly
          const dateStr = d.includes('T') ? d : `${d}T12:00:00`;
          return new Date(dateStr);
        }
        return d;
      } catch (e) {
        return null;
      }
    })
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

  if (dates.length === 0) {
    return null;
  }

  const { rows, t0 } = buildPosterior(dates);
  if (t0 === null) {
    return null;
  }

  const d = Math.floor((target_date.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24));
  const cats = { regla: 0.0, perrisima: 0.0, horny: 0.0, nifunifa: 0.0 };

  for (const row of rows) {
    const { K, L, r, w_norm, sK } = row;
    const cd = ((r + d - 1) % K) + 1;
    const desire = sK[cd - 1]; // sK indexed 0..K-1

    if (1 <= cd && cd <= L) {
      cats.regla += w_norm;
    } else if (desire >= T_PERRISIMA) {
      cats.perrisima += w_norm;
    } else if (desire >= T_HORNY) {
      cats.horny += w_norm;
    } else {
      cats.nifunifa += w_norm;
    }
  }

  const s = cats.regla + cats.perrisima + cats.horny + cats.nifunifa;
  if (s > 0) {
    cats.regla = Math.round((cats.regla / s) * 10000) / 10000;
    cats.perrisima = Math.round((cats.perrisima / s) * 10000) / 10000;
    cats.horny = Math.round((cats.horny / s) * 10000) / 10000;
    cats.nifunifa = Math.round((cats.nifunifa / s) * 10000) / 10000;
  }

  return cats;
}
