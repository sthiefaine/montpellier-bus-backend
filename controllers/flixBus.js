const axios = require("axios");

let cache = {
  data: null,
  lastUpdate: null,
};

const CACHE_DURATION = 60 * 1000;

/**
 * Vérifie si le cache est valide
 * @param {string} from - Station de départ
 * @param {string} to - Station d'arrivée
 * @returns {boolean}
 */
const isCacheValid = () => {
  if (!cache.data || !cache.lastUpdate) return false;

  const now = Date.now();
  const cacheAge = now - cache.lastUpdate;

  return cacheAge < CACHE_DURATION;
};

/**
 * Récupère les données depuis l'API FlixBus
 */
const fetchFlixBusData = async (from, to) => {
  const apiUrl = `https://global.api.flixbus.com/gis/v2/timetable/${process.env.FLIXBUS_STATION_ID}/departures?from=${from}&to=${to}&apiKey=${process.env.FLIXBUS_API_KEY}`;
  const response = await axios.get(apiUrl);

  // Mise à jour du cache
  cache = {
    data: {
      from,
      to,
      ...response.data,
    },
    lastUpdate: Date.now(),
  };

  return response.data;
};

/**
 * Récupère les départs de bus FlixBus
 */
const getBusDepartures = async (req, res) => {
  try {
    const { from, to } = req.query;

    // Vérification du cache
    if (isCacheValid()) {
      console.log("Utilisation des données en cache");
      return res.json(cache.data);
    }

    // Si le cache n'est pas valide, on fait un nouvel appel API
    console.log("Récupération de nouvelles données");
    const data = await fetchFlixBusData(from, to);
    res.json(data);
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
