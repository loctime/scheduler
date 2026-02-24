const admin = require("firebase-admin");
const path = require("path");

const SERVICE_ACCOUNT_PATH = path.join(
  __dirname,
  "../serviceAccountKey-controlfile.json"
);

const EMAILS_TO_ADD = [
  "licvidalfernando@gmail.com",
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

  const snapshot = await db
    .collection("apps")
    .doc("emails")
    .collection("vehicles")
    .get();

  console.log("Vehículos encontrados:", snapshot.size);

  let updates = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

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

      console.log("→", doc.id);
      console.log("   Antes:", current);
      console.log("   Después:", merged);

      if (APPLY_CHANGES) {
        await doc.ref.update({
          responsables: merged,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  console.log("--------------------------------------");
  console.log("Total a modificar:", updates);
  console.log("Finalizado.");
}

run().catch(console.error);