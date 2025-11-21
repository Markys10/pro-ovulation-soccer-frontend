// API utilities for cycle engine predictions
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || 
                    'https://ovulation-app.preview.emergentagent.com';

export interface PredictionResult {
  cats: {
    regla: number;
    perrisima: number;
    horny: number;
    nifunifa: number;
    sexual_prob: number;
    dominance_gap: number;
    dominant_sex: string | null;
  };
  reliability: number;
  reliability_pct: number;
  reliability_color: 'green' | 'yellow' | 'red';
  t0: string | null;
  used_obs: string[];
}

export interface SuggestFillsResult {
  suggested_dates: string[];
}

export async function predictForDate(
  obs_dates: string[],
  target_date: string,
  certain_dates?: string[],
  auto_fill_clusters: boolean = true,
  max_L_fill: number = 7
): Promise<PredictionResult | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        obs_dates,
        target_date,
        certain_dates,
        auto_fill_clusters,
        max_L_fill,
      }),
    });

    if (!response.ok) {
      console.error('Error en predict:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling predict API:', error);
    return null;
  }
}

export async function suggestClusterFills(
  obs_dates: string[],
  max_L: number = 7
): Promise<string[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/suggest-fills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        obs_dates,
        max_L,
      }),
    });

    if (!response.ok) {
      console.error('Error en suggest-fills:', await response.text());
      return [];
    }

    const result: SuggestFillsResult = await response.json();
    return result.suggested_dates;
  } catch (error) {
    console.error('Error calling suggest-fills API:', error);
    return [];
  }
}
