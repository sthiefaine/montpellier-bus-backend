const axios = require("axios");
const AdmZip = require("adm-zip");
const fs = require("fs");
const path = require("path");
const { formatDate } = require("../utils/date");

/**
 * Filtre les trajets pour ne garder que ceux entre 23h et 5h59
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
                  for (const call of calls) {
                    const timeStr =
                      call.aimedDepartureTime || call.aimedArrivalTime;
                    if (!timeStr) continue;

                    const time = new Date(formatDate(timeStr));
                    const hour = time.getHours();
                    if (hour >= 23 || hour < 6) {
                      return true;
                    }
                  }
                  return false;
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

    // Filtrer les données pour ne garder que les trajets de nuit
    const nightData = filterNightRides(jsonData);

    // Créer le dossier data s'il n'existe pas
    const dataDir = path.join(__dirname, "../data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }

    // Sauvegarder les données avec la date du jour
    const today = new Date();
    const fileName = `blablabus_night_${today.getFullYear()}-${(
      today.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}.json`;
    const filePath = path.join(dataDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(nightData, null, 2));
    console.log(`Données de nuit sauvegardées dans ${filePath}`);

    res.json({
      message: "Données de nuit sauvegardées avec succès",
      file: fileName,
    });
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des données de nuit:", error);
    res.status(500).json({
      message: "Erreur lors de la sauvegarde des données",
      error: error.message,
    });
  }
};

module.exports = {
  saveNightData,
};
