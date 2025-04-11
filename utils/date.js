/**
 * Formate une chaîne de date pour assurer sa compatibilité
 * @param {string} dateStr - La chaîne de date à formater
 * @returns {string|null} - La chaîne de date formatée ou null si invalide
 */
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  if (typeof dateStr !== "string") {
    return dateStr;
  }
  // Gestion des dates au format "2025-04-11T20:05:00 +0200"
  if (dateStr.includes(" +0200")) {
    return dateStr.replace(" +0200", "+02:00");
  }
  if (dateStr.includes(" +0100")) {
    return dateStr.replace(" +0100", "+01:00");
  }
  return dateStr;
};

/**
 * Détecte le décalage horaire français actuel
 * @returns {number} - Le décalage horaire en heures
 */
const getFrenchTimezoneOffset = () => {
  const now = new Date();
  const frenchDate = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const frenchOffset = (frenchDate.getTime() - now.getTime()) / (60 * 60 * 1000);
  return Math.round(frenchOffset);
};

module.exports = {
  formatDate,
  getFrenchTimezoneOffset
};