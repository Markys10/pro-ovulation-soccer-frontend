export const COLORS = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceLight: '#2A2A2A',
  primary: '#BB86FC',
  
  // Categorías
  regla: '#FF5252',
  perrisima: '#E040FB',
  horny: '#FF6E40',
  nifunifa: '#757575',
  
  // Textos
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textDisabled: '#666666',
  
  // Otros
  border: '#333333',
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const FONTS = {
  regular: 'System',
  bold: 'System',
};

export function getCategoryColor(category: 'regla' | 'perrisima' | 'horny' | 'nifunifa'): string {
  return COLORS[category];
}

export function getCategoryName(category: 'regla' | 'perrisima' | 'horny' | 'nifunifa'): string {
  const names = {
    regla: 'Regla',
    perrisima: 'Perrísima',
    horny: 'Horny',
    nifunifa: 'Ni fu ni fa',
  };
  return names[category];
}
