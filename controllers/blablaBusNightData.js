const axios = require("axios");
const AdmZip = require("adm-zip");
const { formatDate, getFrenchTimezoneOffset } = require("../utils/date");
const { put, del } = require("@vercel/blob");

/**
 * Vérifie si l'heure actuelle correspond à 21h ou 22h heure française
 */
const isCorrectFrenchTime = () => {
  const now = new Date();
  const frenchOffset = getFrenchTimezoneOffset();
  now.setMinutes(now.getMinutes() + frenchOffset);

  const hour = now.getHours();

  return hour === 21 || hour === 22;
};

/**
 * Filtre les trajets pour ne garder que ceux qui passent par Montpellier Sabines entre 23h et 5h59
 */
const filterNightRides = (jsonData) => {
  const filteredData = {
    ...jsonData,
    estimatedTimetableDelivery: jsonData.estimatedTimetableDelivery.map(
      (delivery) => ({
        ...delivery,
        estimatedJourneyVersionFrame: delivery.estimatedJourneyVersionFrame.map(
          (frame) => ({
            ...frame,
            estimatedVehicleJourney: frame.estimatedVehicleJourney.filter(
              (journey) => {
                try {
                  const calls = journey.estimatedCalls?.estimatedCall || [];
                  let hasMontpellierStop = false;
                  let isNightTime = false;

                  for (const call of calls) {
                    // Vérifier si c'est l'arrêt de Montpellier Sabines
                    const isMontpellierStop = call.stopPointName?.some(
                      (name) =>
                        name.value.toLowerCase().includes("montpellier") &&
                        name.value.toLowerCase().includes("sabine")
                    );

                    if (isMontpellierStop) {
                      hasMontpellierStop = true;
                      // Vérifier l'heure de passage à Montpellier
                      const timeStr =
                        call.aimedArrivalTime || call.aimedDepartureTime;
                      if (timeStr) {
                        const time = new Date(formatDate(timeStr));
                        const hour = time.getHours();
                        isNightTime = hour >= 23 || hour < 6;
                      }
                    }
                  }

                  return hasMontpellierStop && isNightTime;
                } catch (error) {
                  console.error(
                    "Erreur lors du filtrage des trajets de nuit:",
                    error
                  );
                  return false;
                }
              }
            ),
          })
        ),
      })
    ),
  };

  return filteredData;
};

/**
 * Sauvegarde les données de nuit de BlaBlaBus
 */
const saveNightData = async (req, res) => {
  try {
    // Vérifier si l'heure est correcte en France
    if (!isCorrectFrenchTime()) {
      return res.status(400).json({
        message: "Le job ne peut être exécuté qu'à 21h ou 22h heure française",
      });
    }

    console.log("Début de la sauvegarde des données de nuit...");

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

    // Filtrer les données pour ne garder que les trajets de nuit passant par Montpellier
    const nightData = filterNightRides(jsonData);

    // Sauvegarder les données dans Vercel Blob
    const today = new Date();
    const fileName = `blablabus_night_${today.getFullYear()}-${(
      today.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}.json`;

    const { url } = await put(fileName, JSON.stringify(nightData), {
      access: "public",
      contentType: "application/json",
    });

    console.log(`Données de nuit sauvegardées avec succès: ${url}`);

    res.json({
      message: "Données de nuit sauvegardées avec succès",
      url: url,
    });
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des données de nuit:", error);
    res.status(500).json({
      message: "Erreur lors de la sauvegarde des données",
      error: error.message,
    });
  }
};

/**
 * Supprime les données de nuit de la veille
 */
const deletePreviousNightData = async (req, res) => {
  try {
    console.log("Début de la suppression des données de nuit...");

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

    await del(fileName);
    console.log(`Données supprimées avec succès: ${fileName}`);

    res.json({
      message: "Données de nuit supprimées avec succès",
      fileName: fileName,
    });
  } catch (error) {
    console.error("Erreur lors de la suppression des données de nuit:", error);
    res.status(500).json({
      message: "Erreur lors de la suppression des données",
      error: error.message,
    });
  }
};

module.exports = {
  saveNightData,
  deletePreviousNightData,
};
