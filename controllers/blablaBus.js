const axios = require("axios");
const AdmZip = require("adm-zip");
const { formatDate, getFrenchTimezoneOffset } = require("../utils/date");
const { head, list } = require('@vercel/blob');

/**
 * Liste tous les fichiers Blob disponibles
 */
const listBlobFiles = async () => {
  try {
    const { blobs } = await list();
    return blobs.map(blob => blob.url);
  } catch (error) {
    console.error("Erreur lors de la liste des fichiers:", error);
    return [];
  }
};

// Structure de cache
let cache = {
  data: null,
  lastUpdate: null,
};

let CACHE_DURATION;
if (new Date().getHours() >= 2 && new Date().getHours() <= 6) {
  CACHE_DURATION = 2 * 60 * 1000; // 2 minutes la nuit
} else {
  CACHE_DURATION = 60 * 1000; // 1 minute le jour
}

/**
 * Vérifie si le cache est valide
 */
const isCacheValid = () => {
  if (!cache.data || !cache.lastUpdate) return false;
  const now = Date.now();
  const cacheAge = now - cache.lastUpdate;
  return cacheAge < CACHE_DURATION;
};

/**
 * Récupère les données de nuit sauvegardées
 */
const getNightData = async () => {
  try {
    const { blobs } = await list();
    if (blobs.length > 0) {
      const response = await fetch(blobs[0].downloadUrl);
      const data = await response.json();
      return data;
    }
    console.log("Aucune donnée de nuit trouvée");
    return null;
  } catch (error) {
    if (error.name === 'BlobNotFoundError') {
      console.log("Aucune donnée de nuit trouvée");
      return null;
    }
    console.error("Erreur lors de la lecture des données de nuit:", error);
    return null;
  }
};

/**
 * Récupère les départs de bus BlaBlaBus
 */
const getBusDepartures = async (req, res) => {
  try {
    const { from, to } = req.query;
    
    // URL du ZIP
    const zipUrl = process.env.BLABLABUS_URL;
    
    // Télécharger le ZIP
    const response = await axios.get(zipUrl, { responseType: "arraybuffer" });
    const zipBuffer = Buffer.from(response.data);
    
    // Extraire le contenu du ZIP
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    let jsonData;
    for (const entry of zipEntries) {
      if (entry.entryName.endsWith(".json")) {
        jsonData = JSON.parse(zip.readAsText(entry));
        break;
      }
    }

    if (!jsonData) {
      throw new Error("Aucun fichier JSON trouvé dans le ZIP");
    }

    // Récupérer les données de nuit de la veille si elles existent
    let nightData = null;
    try {
      nightData = await getNightData();
    } catch (error) {
      console.log("Pas de données de nuit disponibles:", error.message);
    }

    if (nightData) {
      // Fusionner les données en mettant les trajets de nuit en premier
      jsonData.estimatedTimetableDelivery = [
        ...nightData.estimatedTimetableDelivery,
        ...jsonData.estimatedTimetableDelivery
      ];
    };

    let rides = jsonData.estimatedTimetableDelivery.flatMap((delivery) =>
      delivery.estimatedJourneyVersionFrame.flatMap((frame) => {
        // Filtrer les trajets qui passent par Montpellier
        const filteredJourneys = frame.estimatedVehicleJourney.filter(
          (journey) =>
            journey.estimatedCalls?.estimatedCall?.some((call) =>
              call.stopPointName?.some((name) =>
                name.value.toLowerCase().includes("montpellier") &&
                name.value.toLowerCase().includes("sabine")
              )
            )
        );

        return filteredJourneys
          .map((journey) => {
            try {
              if (
                !journey.estimatedCalls ||
                !journey.estimatedCalls.estimatedCall
              ) {
                return null;
              }

              // Récupérer tous les arrêts
              const calls = journey.estimatedCalls.estimatedCall.map(
                (call) => ({
                  sequence: call.order || 0,
                  stop: {
                    id: call.stopPointRef?.value || "unknown",
                    name: call.stopPointName[0].value,
                    type: null,
                    timezone: null,
                    description: null,
                    city: null,
                    location: null,
                  },
                  arrival: null,
                  departure: null,
                })
              );

              // Trouver l'arrêt de Montpellier Sabines
              let montpellierStop = journey.estimatedCalls.estimatedCall.find(
                (call) =>
                  call.stopPointName.some(
                    (name) =>
                      name.value.toLowerCase().includes("montpellier") &&
                      name.value.toLowerCase().includes("sabine")
                  )
              );

              if (!montpellierStop) {
                console.warn(
                  "Arrêt Montpellier Sabines non trouvé dans le trajet:",
                  journey.publishedLineName?.[0]?.value
                );
                return null;
              }

              // Récupérer le temps de départ s'il existe, sinon le temps d'arrivée
              const aimedTimeStr =
                montpellierStop.aimedDepartureTime ||
                montpellierStop.aimedArrivalTime;
              const expectedTimeStr =
                montpellierStop.expectedDepartureTime ||
                montpellierStop.expectedArrivalTime ||
                aimedTimeStr;

              if (!aimedTimeStr) {
                console.warn(
                  "Aucun temps trouvé pour l'arrêt:",
                  montpellierStop.stopPointName?.[0]?.value
                );
                return null;
              }

              // Convertir et calculer la déviation
              const aimedTime = new Date(formatDate(aimedTimeStr));
              const expectedTime = new Date(formatDate(expectedTimeStr));
              const deviationMs =
                expectedTime.getTime() - aimedTime.getTime();
              const deviationSeconds = Math.floor(deviationMs / 1000);

              // Vérifier si c'est un trajet de nuit (entre 23h et 5h59)
              const hour = aimedTime.getHours();
              const isNightTime = (hour >= 23 || hour < 6);

              // a X minutes de retard en secondes
              const isLate = deviationSeconds > 300;
              const status = isLate ? "LATE" : "ON_TIME";

              return {
                id:
                  journey.datedVehicleJourneyRef?.value ||
                  `blabla-${Date.now()}-${Math.random()}`,
                status: {
                  segment: null,
                  progress: null,
                  scheduled_timestamp: formatDate(aimedTimeStr),
                  deviation: {
                    deviation_timestamp: formatDate(expectedTimeStr),
                    deviation_seconds: deviationSeconds,
                    reason: null,
                    deviation_class: status,
                    deviation_type: "ESTIMATED",
                    updated_at: new Date().toISOString(),
                  },
                },
                platform: null,
                line: {
                  code: journey.publishedLineName?.[0]?.value || "UNKNOWN",
                  name: null,
                  brand: {
                    id: "blablabus-id",
                    name: "BlaBlaBus",
                  },
                },
                location: null,
                calls: calls,
                vehicle: null,
                theoretical_schedule: {
                  is_theoretical: isNightTime,
                  source: isNightTime ? "night_data" : null,
                  schedule_type: isNightTime ? "THEORETICAL" : "REAL_TIME",
                  last_updated: isNightTime ? new Date().toISOString() : null,
                },
              };
            } catch (error) {
              console.error("Erreur lors du traitement d'un trajet:", error);
              return null;
            }
          })
          .filter((journey) => journey !== null);
      })
    );

    let filteredRides = rides;
    if (from) {
      const fromDate = new Date(from);
      filteredRides = filteredRides.filter((ride) => {
        try {
          if (!ride || !ride.status || !ride.status.scheduled_timestamp) {
            return false;
          }
          const rideTimestamp = ride.status.scheduled_timestamp;
          const rideDate = new Date(rideTimestamp);

          return rideDate >= fromDate;
        } catch (error) {
          console.error("Erreur lors du filtrage 'from':", error);
          return false;
        }
      });
    }

    if (to) {
      const toDate = new Date(to);
      filteredRides = filteredRides.filter((ride) => {
        try {
          if (!ride || !ride.status || !ride.status.scheduled_timestamp) {
            return false;
          }
          const rideTimestamp = ride.status.scheduled_timestamp;
          const rideDate = new Date(rideTimestamp);

          return rideDate <= toDate;
        } catch (error) {
          console.error("Erreur lors du filtrage 'to':", error);
          return false;
        }
      });
    }

    const formattedResponse = {
      rides: filteredRides,
      station: {
        id: process.env.BLABLABUS_STATION_ID || "montpellier-1",
        name: "Montpellier - Sabines Bus Station",
        timezone: "Europe/Paris",
      },
    };

    res.json(formattedResponse);
  } catch (error) {
    console.error("Erreur lors du traitement du ZIP/JSON:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des données",
      error: error.message,
    });
  }
};

module.exports = {
  getBusDepartures,
};
