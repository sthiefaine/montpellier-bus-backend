/**
 * Configuration centralisée de l'application
 */
const config = {
  port: process.env.PORT || 5000,
  flixbus: {
    apiKey: process.env.FLIXBUS_API_KEY,
    stationId: process.env.FLIXBUS_STATION_ID
  },
  blablabus: {
    url: process.env.BLABLABUS_URL,
    stationId: process.env.BLABLABUS_STATION_ID || "default-station-id",
    stationName: "Montpellier - Sabines Bus Station"
  }
};

module.exports = config;