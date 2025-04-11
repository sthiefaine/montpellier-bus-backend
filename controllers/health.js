/**
 * Vérifie l'état de santé du serveur
 */
const checkHealth = (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
};

module.exports = {
  checkHealth
};