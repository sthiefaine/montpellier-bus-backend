const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Import du routeur principal
const routes = require("./routes/index");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", routes);

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});