const express = require("express");
const router = express.Router();
const { apiLimiter } = require("../middleware/rateLimiter");
const { getBusDepartures } = require("../controllers/blablaBus");
const { saveNightData, deletePreviousNightData } = require("../controllers/blablaBusNightData");


router.use(apiLimiter);

// Routes
router.get("/departures", getBusDepartures);
router.get("/save-night-data", saveNightData);
router.get("/delete-night-data", deletePreviousNightData);

module.exports = router;
