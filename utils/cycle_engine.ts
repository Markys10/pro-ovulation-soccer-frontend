// cycle_engine.ts - Motor bayesiano para predicción del ciclo menstrual
// Versión corregida con:
// 1) 100% regla en días entre observaciones reales
// 2) 100% regla en días observados
// 3) Lógica principal bayesiana intacta

// Priors (ajustables)
const P_K: { [key: number]: number } = {
  26: 0.10, 27: 0.12, 28: 0.30, 29: 0.20, 30: 0.15, 31: 0.08, 32: 0.05
};

const P_L: { [key: number]: number } = {
  2: 0.05, 3: 0.30, 4: 0.35, 5: 0.20, 6: 0.07, 7: 0.03
};

// Base desire curve (template 28 days)
const BASE_28: { [key: number]: number } = {
  1: 0.05, 2: 0.05, 3: 0.05, 4: 0.05, 5: 0.05,
  6: 0.05, 7: 0.12, 8: 0.18, 9: 0.26, 10: 0.34,
  11: 0.44, 12: 0.55, 13: 0.64, 14: 0.70, 15: 0.63,
  16: 0.52, 17: 0.40
};

// Rellenar 18..28 lineal
const _start = 0.22;
const _end = 0.12;
for (let i = 0, day = 18; day <= 28; i++, day++) {
  BASE_28[day] = _start + (_end - _start) * (i / (28 - 18));
}

// Thresholds
const T_PERRISIMA = 0.75;
const T_HORNY = 0.40;

// Likelihood constants
const P_BLEED = 0.95;
const P_FALSE = 0.05;

function interpCurve(K: number): number[] {
  const old_x = Array.from({ length: 28 }, (_, i) => i / 27);
  const old_y = Array.from({ length: 28 }, (_, i) => BASE_28[i + 1]);
  const new_x = Array.from({ length: K }, (_, i) => (K > 1 ? i / (K - 1) : 0));
  const sK: number[] = [];

  for (const nx of new_x) {
    let s = old_y[0];
    if (nx <= old_x[0]) s = old_y[0];
    else if (nx >= old_x[27]) s = old_y[27];
    else {
      for (let j = 0; j < 27; j++) {
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

function likelihood(obs: Date[], K: number, L: number, r: number, t0: Date): number {
  let prod = 1.0;
  for (const t of obs) {
    const d = Math.floor((t.getTime() - t0.getTime()) / 86400000);
    const cd = ((r + d - 1) % K) + 1;

    if (1 <= cd && cd <= L) prod *= P_BLEED;
    else prod *= P_FALSE;
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

function buildPosterior(obs_dates: Date[]) {
  if (obs_dates.length === 0) return { rows: [], t0: null };

  const t0 = obs_dates[obs_dates.length - 1];
  const rows: PosteriorRow[] = [];

  for (const [Kstr, pk] of Object.entries(P_K)) {
    const K = parseInt(Kstr);
    const sK = interpCurve(K);
    for (const [Lstr, pl] of Object.entries(P_L)) {
      const L = parseInt(Lstr);

      for (let r = 1; r <= L; r++) {
        const prior = pk * pl * (1 / L);
        const like = likelihood(obs_dates, K, L, r, t0);
        const w = prior * like;

        rows.push({ K, L, r, w, w_norm: 0, sK });
      }
    }
  }

  const total = rows.reduce((s, x) => s + x.w, 0);
  if (total > 0) {
    for (const row of rows) row.w_norm = row.w / total;
  } else {
    const unif = 1 / rows.length;
    for (const row of rows) row.w_norm = unif;
  }

  return { rows, t0 };
}

export interface PredictionScore {
  regla: number;
  perrisima: number;
  horny: number;
  nifunifa: number;
}

// -------------------------------------------------------------
//  🔥 ***CORRECCIÓN CRUCIAL***
//  Si target_date coincide con observación → 100% regla
//  Si está entre dos obs con gap ≤7 días → 100% regla
// -------------------------------------------------------------
export function scoreForTarget(
  obs_dates_raw: (Date | string)[],
  target_date: Date
): PredictionScore | null {
  
  if (!obs_dates_raw || obs_dates_raw.length === 0) return null;

  // Parse + limpiar fechas
  const obs_dates = obs_dates_raw
    .map(d => {
      if (typeof d === "string")
        return new Date(d.includes("T") ? d : `${d}T12:00:00`);
      return d;
    })
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (obs_dates.length === 0) return null;

  const target = target_date.getTime();

  // 1) Si el día es EXACTAMENTE una observación → 100%
  for (const o of obs_dates) {
    if (Math.abs(o.getTime() - target) < 86400000) {
      return {
        regla: 1,
        perrisima: 0,
        horny: 0,
        nifunifa: 0
      };
    }
  }

  // 2) Si target está entre dos observaciones con gap <= 7 → 100%
  for (let i = 0; i < obs_dates.length - 1; i++) {
    const d1 = obs_dates[i];
    const d2 = obs_dates[i + 1];

    const diff = Math.floor((d2.getTime() - d1.getTime()) / 86400000);
    if (diff <= 7) {
      if (target >= d1.getTime() && target <= d2.getTime()) {
        return {
          regla: 1,
          perrisima: 0,
          horny: 0,
          nifunifa: 0
        };
      }
    }
  }

  // 3) Si no es una certeza → modelo bayesiano normal
  const { rows, t0 } = buildPosterior(obs_dates);
  if (!t0) return null;

  const d = Math.floor((target - t0.getTime()) / 86400000);
  const cats = { regla: 0, perrisima: 0, horny: 0, nifunifa: 0 };

  for (const row of rows) {
    const cd = ((row.r + d - 1) % row.K) + 1;
    const desire = row.sK[cd - 1];

    if (cd <= row.L) cats.regla += row.w_norm;
    else if (desire >= T_PERRISIMA) cats.perrisima += row.w_norm;
    else if (desire >= T_HORNY) cats.horny += row.w_norm;
    else cats.nifunifa += row.w_norm;
  }

  const s = cats.regla + cats.perrisima + cats.horny + cats.nifunifa;
  if (s > 0) {
    cats.regla /= s;
    cats.perrisima /= s;
    cats.horny /= s;
    cats.nifunifa /= s;
  }

  return cats;
}
