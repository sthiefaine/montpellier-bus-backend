const express = require("express");
const cors = require("cors");
require("dotenv").config();

const routes = require("./routes");
const { apiLimiter } = require("./middleware/rateLimiter");
const blablaBusRoutes = require("./routes/blablaBus");
const { saveNightData, deletePreviousNightData } = require("./controllers/blablaBusNightData");

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration du proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());

// Protection globale contre les attaques
app.use("/api", apiLimiter);

// Routes BlaBlaBus spécifiques
app.use("/api/blablabus", blablaBusRoutes);

// Routes cron
app.get("/api/cron/save-night-data", saveNightData);
app.get("/api/cron/delete-night-data", deletePreviousNightData);

// Autres routes
app.use("/api", routes);

app.get("/", (req, res) => {
  res.json({ message: "API des Horaires de Bus - Serveur en ligne" });
});

// Middleware de gestion d'erreurs global
app.use((err, req, res, next) => {
  console.error(`Erreur: ${err.message}`);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: err.message || "Erreur interne du serveur",
  });
});

// Gestion des routes inconnues
app.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route introuvable",
  });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
}
