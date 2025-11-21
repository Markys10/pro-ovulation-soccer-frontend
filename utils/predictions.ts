// Modelo predictivo completo según especificaciones
import { Observation } from '../types';

// Distribución normal truncada
function normalTruncated(
  mean: number,
  sd: number,
  min: number,
  max: number
): Map<number, number> {
  const distribution = new Map<number, number>();
  let sum = 0;

  // Calcular probabilidades sin normalizar
  for (let x = min; x <= max; x++) {
    const z = (x - mean) / sd;
    const prob = Math.exp(-0.5 * z * z);
    distribution.set(x, prob);
    sum += prob;
  }

  // Normalizar
  for (const [key, value] of distribution.entries()) {
    distribution.set(key, value / sum);
  }

  return distribution;
}

// Distribución de duración del ciclo
function getCycleDistribution(observations: Observation[]): Map<number, number> {
  if (observations.length === 0) {
    return normalTruncated(28, 2.5, 24, 35);
  }

  const sortedObs = observations
    .map(o => new Date(o.fecha))
    .sort((a, b) => a.getTime() - b.getTime());

  if (sortedObs.length === 1) {
    return normalTruncated(28, 2.5, 24, 35);
  }

  if (sortedObs.length === 2) {
    const delta = Math.round(
      (sortedObs[1].getTime() - sortedObs[0].getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const baseDist = normalTruncated(28, 2.5, 24, 35);
    const distribution = new Map<number, number>();
    let sum = 0;

    for (let c = 24; c <= 35; c++) {
      const baseProb = baseDist.get(c) || 0;
      const z = (delta - c) / 1.5;
      const gaussianWeight = Math.exp(-0.5 * z * z);
      const prob = baseProb * gaussianWeight;
      distribution.set(c, prob);
      sum += prob;
    }

    // Normalizar
    for (const [key, value] of distribution.entries()) {
      distribution.set(key, value / sum);
    }

    return distribution;
  }

  // 3+ observaciones
  const deltas: number[] = [];
  for (let i = 1; i < sortedObs.length; i++) {
    const delta = Math.round(
      (sortedObs[i].getTime() - sortedObs[i - 1].getTime()) / (1000 * 60 * 60 * 24)
    );
    deltas.push(delta);
  }

  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance =
    deltas.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / deltas.length;
  const sd = Math.sqrt(variance);

  return normalTruncated(mean, Math.max(sd, 1.5), 24, 35);
}

// Distribución de duración de la regla
function getRuleDistribution(): Map<number, number> {
  return normalTruncated(4.5, 1.0, 2, 8);
}

// Curva base de deseo sexual según día del ciclo
function getBaseDesire(day: number): number {
  const baseDesireMap: { [key: number]: number } = {
    1: 0.05, 2: 0.05, 3: 0.05, 4: 0.05, 5: 0.05, 6: 0.05,
    7: 0.12,
    8: 0.18,
    9: 0.26,
    10: 0.34,
    11: 0.44,
    12: 0.55,
    13: 0.64,
    14: 0.70,
    15: 0.63,
    16: 0.52,
    17: 0.40,
  };

  if (day in baseDesireMap) {
    return baseDesireMap[day];
  }

  // Interpolación lineal para días 18-28+
  if (day >= 18) {
    const start = 18;
    const end = 28;
    const startValue = 0.22;
    const endValue = 0.12;
    
    if (day >= end) {
      return endValue;
    }
    
    const t = (day - start) / (end - start);
    return startValue + (endValue - startValue) * t;
  }

  return 0.05;
}

// Obtener la observación más reciente antes de una fecha
function getMostRecentObservation(
  observations: Observation[],
  targetDate: Date
): Date | null {
  const sorted = observations
    .map(o => new Date(o.fecha))
    .filter(d => d <= targetDate)
    .sort((a, b) => b.getTime() - a.getTime());

  return sorted.length > 0 ? sorted[0] : null;
}

// Función principal de predicción
export function predictForDate(
  targetDate: Date,
  observations: Observation[]
): {
  regla: number;
  perrisima: number;
  horny: number;
  nifunifa: number;
  expected_day: number;
} {
  if (observations.length === 0) {
    // Sin observaciones, usar probabilidades base
    return {
      regla: 0.15,
      perrisima: 0.15,
      horny: 0.35,
      nifunifa: 0.35,
      expected_day: 1,
    };
  }

  const P_C = getCycleDistribution(observations);
  const P_R = getRuleDistribution();

  const total = {
    regla: 0,
    perrisima: 0,
    horny: 0,
    nifunifa: 0,
  };

  let expectedDay = 0;
  let totalWeight = 0;

  // Obtener referencia
  const refObs = getMostRecentObservation(observations, targetDate);
  const S_ref = refObs || new Date(observations[0].fecha);

  // Calcular días desde la referencia
  const daysDiff = Math.round(
    (targetDate.getTime() - S_ref.getTime()) / (1000 * 60 * 60 * 24)
  );

  for (const [c, probC] of P_C.entries()) {
    for (const [r, probR] of P_R.entries()) {
      // Calcular día del ciclo
      let dayInCycle = (daysDiff % c) + 1;
      if (dayInCycle <= 0) {
        dayInCycle += c;
      }

      const desire = getBaseDesire(dayInCycle);
      const weight = probC * probR;

      expectedDay += dayInCycle * weight;
      totalWeight += weight;

      // Categorizar
      if (dayInCycle <= r) {
        total.regla += weight;
      } else if (desire >= 0.60) {
        total.perrisima += weight;
      } else if (desire >= 0.30) {
        total.horny += weight;
      } else {
        total.nifunifa += weight;
      }
    }
  }

  // Normalizar
  const sum = total.regla + total.perrisima + total.horny + total.nifunifa;
  if (sum > 0) {
    total.regla /= sum;
    total.perrisima /= sum;
    total.horny /= sum;
    total.nifunifa /= sum;
  }

  expectedDay = totalWeight > 0 ? Math.round(expectedDay / totalWeight) : 1;

  return {
    ...total,
    expected_day: expectedDay,
  };
}

// Obtener categoría principal
export function getMainCategory(probs: {
  regla: number;
  perrisima: number;
  horny: number;
  nifunifa: number;
}): 'regla' | 'perrisima' | 'horny' | 'nifunifa' {
  const entries = Object.entries(probs) as [
    'regla' | 'perrisima' | 'horny' | 'nifunifa',
    number
  ][];
  
  return entries.reduce((max, entry) => 
    entry[1] > max[1] ? entry : max
  )[0];
}

// Obtener confianza (máxima probabilidad)
export function getConfidence(probs: {
  regla: number;
  perrisima: number;
  horny: number;
  nifunifa: number;
}): number {
  return Math.max(probs.regla, probs.perrisima, probs.horny, probs.nifunifa);
}
