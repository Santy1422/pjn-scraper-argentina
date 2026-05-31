export function badgeClass(situacion) {
  if (!situacion) return 'badge otro';
  const s = situacion.toUpperCase();
  if (s.includes('LETRA')) return 'badge letra';
  if (s.includes('DESPACHO')) return 'badge despacho';
  if (s.includes('GIRO')) return 'badge giro';
  if (s.includes('CEDULA') || s === 'cedula') return 'badge cedula';
  return 'badge otro';
}

export function formatFecha(ts) {
  if (!ts) return '—';
  if (typeof ts === 'number') {
    const d = new Date(ts);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return ts;
}

export function formatFechaHora(ts) {
  if (!ts) return '—';
  if (typeof ts === 'number') {
    const d = new Date(ts);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return ts;
}
