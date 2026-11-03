export const formatTimeSaved = (totalMinutes: number): string => {
  const safeMinutes = Math.max(0, totalMinutes);

  if (safeMinutes < 60) {
    return `${safeMinutes} ${safeMinutes === 1 ? "minuto" : "minuti"}`;
  }

  const formatValue = (value: number) => {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(1).replace(".", ",");
  };

  const isSingular = (value: number) => Math.abs(value - 1) < Number.EPSILON;

  if (safeMinutes >= 7 * 24 * 60) {
    const weeks = safeMinutes / (7 * 24 * 60);
    return `${formatValue(weeks)} ${isSingular(weeks) ? "settimana" : "settimane"}`;
  }

  if (safeMinutes >= 24 * 60) {
    const days = safeMinutes / (24 * 60);
    return `${formatValue(days)} ${isSingular(days) ? "giorno" : "giorni"}`;
  }

  const hours = safeMinutes / 60;
  return `${formatValue(hours)} ${isSingular(hours) ? "ora" : "ore"}`;
};

