const express = require("express");
const busRoutes = require("./bus");
const healthRoutes = require("./health");
const { apiLimiter, healthLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.use("/bus-departures-flixbus", apiLimiter);
router.use("/bus-departures-blablabus", apiLimiter);
router.use("/bus-departures-blablabus-night-data", apiLimiter);

router.use("/health", healthLimiter);

router.use("/", busRoutes);
router.use("/", healthRoutes);

module.exports = router;