// Tipos de datos para la aplicación

export interface Observation {
  fecha: string; // ISO date string
  certain?: boolean; // Certeza del dato (por defecto true)
}

export interface Profile {
  id: string;
  nombre: string;
  edad?: number;
  notas?: string;
  foto?: string; // base64
  observaciones: Observation[];
  createdAt: string;
}

export interface PredictionResult {
  fecha: string;
  prob_regla: number;
  prob_perrisima: number;
  prob_horny: number;
  prob_nifunifa: number;
  expected_day: number;
  confidence: number;
  categoria_principal: 'regla' | 'perrisima' | 'horny' | 'nifunifa';
}

export interface ExportData {
  version: string;
  exportDate: string;
  profiles: Profile[];
}
