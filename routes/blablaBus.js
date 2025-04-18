const express = require("express");
const router = express.Router();
const { getBusDepartures } = require("../controllers/blablaBus");
const { saveNightData } = require("../controllers/blablaBusNightData");

router.get("/departures", getBusDepartures);
router.post("/save-night-data", saveNightData);

module.exports = router;