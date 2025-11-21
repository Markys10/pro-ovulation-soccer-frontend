// Utilidad simple para formatear fechas en español
export function formatDateES(date: Date): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const monthName = months[date.getMonth()].toLowerCase();
  const year = date.getFullYear();

  return `${dayName}, ${day} de ${monthName} de ${year}`;
}

export function formatDateShortES(date: Date): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const monthName = months[date.getMonth()].toLowerCase();

  return `${dayName}, ${day} de ${monthName}`;
}

export function formatDateFullES(date: Date): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const day = date.getDate();
  const monthName = months[date.getMonth()].toLowerCase();
  const year = date.getFullYear();

  return `${day} de ${monthName} de ${year}`;
}
