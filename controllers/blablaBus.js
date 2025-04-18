const axios = require("axios");
const AdmZip = require("adm-zip");
const { formatDate, getFrenchTimezoneOffset } = require("../utils/date");
const fs = require("fs");
const path = require("path");

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
const getNightData = () => {
  try {
    const dataDir = path.join(__dirname, "../data");
    if (!fs.existsSync(dataDir)) {
      return null;
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const fileName = `blablabus_night_${yesterday.getFullYear()}-${(
      yesterday.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}-${yesterday
      .getDate()
      .toString()
      .padStart(2, "0")}.json`;
    const filePath = path.join(dataDir, fileName);

    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return data;
    }
    return null;
  } catch (error) {
    console.error("Erreur lors de la lecture des données de nuit:", error);
    return null;
  }
};

/**
 * Récupère les départs de bus BlaBlaBus
 */
const getBusDepartures = async (req, res) => {
  console.log("Traitement de la requête BlaBlaBus...");
  try {
    const { from, to, tzOffset } = req.query;
    const frenchOffset = getFrenchTimezoneOffset();
    const effectiveOffset = tzOffset ? parseInt(tzOffset) : frenchOffset;

    let rides;

    // Vérifier le cache
    if (isCacheValid()) {
      console.log("Utilisation des données en cache");
      rides = cache.data;
    } else {
      console.log("Récupération de nouvelles données");
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

      // Récupérer les données de nuit si nécessaire
      const nightData = getNightData();
      if (nightData) {
        console.log("Fusion des données de jour et de nuit");
        // Fusionner les données de nuit avec les données du jour
        jsonData.estimatedTimetableDelivery = [
          ...nightData.estimatedTimetableDelivery,
          ...jsonData.estimatedTimetableDelivery,
        ];
      }

      rides = jsonData.estimatedTimetableDelivery.flatMap((delivery) =>
        delivery.estimatedJourneyVersionFrame.flatMap((frame) => {
          // Filtrer les trajets qui passent par Montpellier
          const filteredJourneys = frame.estimatedVehicleJourney.filter(
            (journey) =>
              journey.estimatedCalls?.estimatedCall?.some((call) =>
                call.stopPointName?.some(
                  (name) =>
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
                  console.log("Structure de journey invalide:", journey);
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
                    is_theoretical: nightData ? true : false,
                    source: nightData ? "night_data" : null,
                    schedule_type: nightData ? "THEORETICAL" : "REAL_TIME",
                    last_updated: nightData ? new Date().toISOString() : null,
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

      // Mise à jour du cache
      cache = {
        data: rides,
        lastUpdate: Date.now(),
      };
    }

    console.log("Trajets disponibles avant filtrage:", rides.length);

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

          const result = rideDate >= fromDate;
          return result;
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

          const result = rideDate <= toDate;
          if (!result) {
            const now = new Date();
            const diffMinutes = Math.round((rideDate - toDate) / (1000 * 60));
            const formatDate = (date) => {
              return `${date.getDate().toString().padStart(2, "0")}/${(
                date.getMonth() + 1
              )
                .toString()
                .padStart(2, "0")} ${date
                .getHours()
                .toString()
                .padStart(2, "0")}:${date
                .getMinutes()
                .toString()
                .padStart(2, "0")}`;
            };
            console.log(
              `Trajet rejeté - Heure actuelle: ${formatDate(
                now
              )}, Heure limite: ${formatDate(
                toDate
              )}, Heure du trajet: ${formatDate(
                rideDate
              )}, Différence: ${diffMinutes} minutes`
            );
          }
          return result;
        } catch (error) {
          console.error("Erreur lors du filtrage 'to':", error);
          return false;
        }
      });
    }

    console.log(
      "Nombre total de trajets après filtrage:",
      filteredRides.length
    );

    const formattedResponse = {
      rides: filteredRides,
      station: {
        id: process.env.BLABLABUS_STATION_ID || "default-station-id",
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
