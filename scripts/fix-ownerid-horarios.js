import admin from "firebase-admin";
import fs from "fs";

// 👉 cargar la service account desde la raíz
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey-controlfile.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const VALID_OWNERS = [
  "uefWFJ8LMbXOhYN186RITrUVHF42",
  "rixIn0BwiVPHB4SgR0K0SlnpSLC2",
];

async function fixCollection(path) {
  const snap = await db.collection(path).get();
  let fixed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const createdBy = data.createdBy;
    const ownerId = data.ownerId;

    if (
      createdBy &&
      VALID_OWNERS.includes(createdBy) &&
      ownerId !== createdBy
    ) {
      await doc.ref.update({ ownerId: createdBy });
      fixed++;
      console.log(`✔ ${path}/${doc.id} → ownerId = ${createdBy}`);
    }
  }

  console.log(`🧩 ${path}: ${fixed} documentos corregidos\n`);
}

async function run() {
  console.log("🔧 Normalizando ownerId (ControlHorarios)\n");

  await fixCollection("apps/horarios/schedules");
  await fixCollection("apps/horarios/employees");
  await fixCollection("apps/horarios/shifts");
  await fixCollection("apps/horarios/employee_fixed_rules");

  console.log("✅ Proceso terminado");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
