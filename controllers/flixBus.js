const axios = require("axios");

/**
 * Récupère les départs de bus FlixBus
 */
const getBusDepartures = async (req, res) => {
  try {
    const { from, to } = req.query;

    const apiUrl = `https://global.api.flixbus.com/gis/v2/timetable/${process.env.FLIXBUS_STATION_ID}/departures?from=${from}&to=${to}&apiKey=${process.env.FLIXBUS_API_KEY}`;

    const response = await axios.get(apiUrl);

    res.json(response.data);
  } catch (error) {
    console.error("Erreur API FlixBus:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des données de bus",
      error: error.message,
    });
  }
};

module.exports = {
  getBusDepartures,
};
