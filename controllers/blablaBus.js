const axios = require("axios");
const AdmZip = require("adm-zip");
const { formatDate, getFrenchTimezoneOffset } = require("../utils/date");

/**
 * Récupère les départs de bus BlaBlaBus
 */
const getBusDepartures = async (req, res) => {
  console.log("Récupération des données de BlaBlaBus...");
  try {
    const { from, to, tzOffset } = req.query;
    const frenchOffset = getFrenchTimezoneOffset();
    const effectiveOffset = tzOffset ? parseInt(tzOffset) : frenchOffset;

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

    const rides = jsonData.estimatedTimetableDelivery.flatMap((delivery) =>
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
              const deviationMs = expectedTime.getTime() - aimedTime.getTime();
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
              };
            } catch (error) {
              console.error("Erreur lors du traitement d'un trajet:", error);
              return null;
            }
          })
          .filter((journey) => journey !== null);
      })
    );

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
