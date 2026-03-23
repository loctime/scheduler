const admin = require("firebase-admin");
const path = require("path");

// ========= CONFIG =========
const SOURCE_UID = "uefWFJ8LMbXOhYN186RITrUVHF42";
const TARGET_UID = "rixIn0BwiVPHB4SgR0K0SlnpSLC2";
const DRY_RUN = false; // true = solo revisar | false = copiar
// ==========================

const serviceAccount = require(path.resolve("./serviceAccountKey-controlfile.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  console.log("======================================");
  console.log("CLONACIÓN DE USUARIO");
  console.log("Origen:", SOURCE_UID);
  console.log("Destino:", TARGET_UID);
  console.log("Modo:", DRY_RUN ? "DRY RUN (NO ESCRIBE)" : "EJECUCIÓN REAL");
  console.log("======================================\n");

  const employeesRef = db
    .collection("apps")
    .doc("horarios")
    .collection("employees");

  const shiftsRef = db
    .collection("apps")
    .doc("horarios")
    .collection("shifts");

  const employeesSnap = await employeesRef
    .where("ownerId", "==", SOURCE_UID)
    .get();

  const shiftsSnap = await shiftsRef
    .where("ownerId", "==", SOURCE_UID)
    .get();

  console.log("Empleados encontrados:", employeesSnap.size);
  console.log("Turnos encontrados:", shiftsSnap.size);

  if (DRY_RUN) {
    console.log("\n⚠️ DRY RUN finalizado. No se copiaron datos.");
    process.exit(0);
  }

  const batch = db.batch();

  employeesSnap.forEach((doc) => {
    const data = doc.data();
    const newRef = employeesRef.doc();

    batch.set(newRef, {
      ...data,
      ownerId: TARGET_UID,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      clonedFrom: SOURCE_UID,
    });
  });

  shiftsSnap.forEach((doc) => {
    const data = doc.data();
    const newRef = shiftsRef.doc();

    batch.set(newRef, {
      ...data,
      ownerId: TARGET_UID,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      clonedFrom: SOURCE_UID,
    });
  });

  await batch.commit();

  console.log("\n✅ Copia completada correctamente.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});