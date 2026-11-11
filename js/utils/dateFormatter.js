/**
 * Utilidades para formateo seguro y accesible de fechas y horas.
 */
export function formatDateTime(isoString) {
  if (!isoString) return "--/--/---- --:--:--";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      // Intento de parseo de formato MySQL plano "YYYY-MM-DD HH:mm:ss"
      const parts = isoString.replace("T", " ").split(/[- :]/);
      if (parts.length >= 6) {
        return `${parts[2]}/${parts[1]}/${parts[0]} ${parts[3]}:${parts[4]}:${parts[5]}`;
      }
      return isoString;
    }

    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  } catch (e) {
    console.warn("Error al formatear fecha:", isoString, e);
    return isoString;
  }
}

export function formatTimeOnly(isoString) {
  if (!isoString) return "--:--:--";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  } catch (e) {
    return isoString;
  }
}
