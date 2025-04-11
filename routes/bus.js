const express = require("express");
const flixbusController = require("../controllers/flixBus");
const blablabusController = require("../controllers/blablaBus");

const router = express.Router();

router.get("/bus-departures-flixbus", flixbusController.getBusDepartures);
router.get("/bus-departures-blablabus", blablabusController.getBusDepartures);

module.exports = router;