const admin = require("firebase-admin");
const path = require("path");

const SERVICE_ACCOUNT_PATH = path.join(
  __dirname,
  "../serviceAccountKey-controlfile.json"
);

const EMAILS_TO_ADD = [
  "franco.compiano@maximia.com.ar",
  "pablo.pisani@maximia.com.ar",
  "cecilia.canet@maximia.com.ar",
  "diegobertosi@gmail.com",
];


const APPLY_CHANGES = true; // cambiar luego a true

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function run() {
  console.log("======================================");
  console.log("ASIGNACIÓN MASIVA DE RESPONSABLES");
  console.log("Modo:", APPLY_CHANGES ? "WRITE" : "DRY RUN");
  console.log("======================================");

  // First, update main vehicles collection
  const snapshot = await db
    .collection("apps")
    .doc("emails")
    .collection("vehicles")
    .get();

  console.log("Vehículos encontrados:", snapshot.size);

  let updates = 0;
  let dailyAlertsUpdates = 0;

  // Get all date keys from dailyAlerts
  const dailyAlertsSnapshot = await db
    .collection("apps")
    .doc("emails")
    .collection("dailyAlerts")
    .listDocuments();
  
  const dateKeys = dailyAlertsSnapshot.map(doc => doc.id);
  console.log("Fechas encontradas en dailyAlerts:", dateKeys.length);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const plate = doc.id;

    const current = Array.isArray(data.responsables)
      ? data.responsables
      : [];

    const merged = Array.from(
      new Set([...current, ...EMAILS_TO_ADD])
    );

    const changed =
      JSON.stringify(current.sort()) !==
      JSON.stringify(merged.sort());

    if (changed) {
      updates++;

      console.log("→", plate);
      console.log("   Antes:", current);
      console.log("   Después:", merged);

      if (APPLY_CHANGES) {
        await doc.ref.update({
          responsables: merged,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // Update dailyAlerts for each date key
    for (const dateKey of dateKeys) {
      try {
        const dailyAlertVehicleRef = db
          .collection("apps")
          .doc("emails")
          .collection("dailyAlerts")
          .doc(dateKey)
          .collection("vehicles")
          .doc(plate);

        const dailyAlertDoc = await dailyAlertVehicleRef.get();
        
        if (dailyAlertDoc.exists) {
          const dailyAlertData = dailyAlertDoc.data();
          const dailyAlertCurrent = Array.isArray(dailyAlertData.responsables)
            ? dailyAlertData.responsables
            : [];

          const dailyAlertMerged = Array.from(
            new Set([...dailyAlertCurrent, ...EMAILS_TO_ADD])
          );

          const dailyAlertChanged =
            JSON.stringify(dailyAlertCurrent.sort()) !==
            JSON.stringify(dailyAlertMerged.sort());

          if (dailyAlertChanged) {
            dailyAlertsUpdates++;

            console.log(`   dailyAlerts/${dateKey}/${plate}:`);
            console.log("     Antes:", dailyAlertCurrent);
            console.log("     Después:", dailyAlertMerged);

            if (APPLY_CHANGES) {
              await dailyAlertVehicleRef.update({
                responsables: dailyAlertMerged,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
          }
        }
      } catch (error) {
        console.log(`   Error en dailyAlerts/${dateKey}/${plate}:`, error.message);
      }
    }
  }

  console.log("--------------------------------------");
  console.log("Total a modificar en vehicles:", updates);
  console.log("Total a modificar en dailyAlerts:", dailyAlertsUpdates);
  console.log("Finalizado.");
}

run().catch(console.error);