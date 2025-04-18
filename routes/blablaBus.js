const express = require("express");
const router = express.Router();
const { apiLimiter } = require("../middleware/rateLimiter");
const { getBusDepartures } = require("../controllers/blablaBus");

router.use(apiLimiter);

// Routes
router.get("/departures", getBusDepartures);

module.exports = router;
