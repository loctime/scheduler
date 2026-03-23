const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey-controlfile.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "controlstorage-eb796",
});

const db = admin.firestore();

const OWNER_OK = "uefWFJ8LMbXOhYN186RITrUVHF42";

function buildDeterministicId(ownerId, weekStart) {
  return `${ownerId}__${weekStart}`;
}

async function diagnosticar() {
  console.log("🔍 Iniciando diagnóstico de schedules...\n");

  const schedulesRef = db.collection("apps").doc("horarios").collection("schedules");
  const snapshot = await schedulesRef.where("ownerId", "==", OWNER_OK).get();

  console.log(`📊 Total schedules del owner ${OWNER_OK}: ${snapshot.size}\n`);

  const agrupados = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const weekStart = data.weekStart || "SIN_weekStart";
    const id = doc.id;

    if (!agrupados[weekStart]) {
      agrupados[weekStart] = [];
    }

    agrupados[weekStart].push({
      id,
      completada: data.completada || false,
      hasAssignments: !!data.assignments && Object.keys(data.assignments).length > 0,
      assignmentKeys: data.assignments ? Object.keys(data.assignments) : [],
    });
  }

  let duplicados = 0;

  for (const weekStart of Object.keys(agrupados)) {
    const docs = agrupados[weekStart];

    const deterministicId = buildDeterministicId(OWNER_OK, weekStart);

    if (docs.length > 1) {
      duplicados++;
      console.log("🚨 DUPLICADO DETECTADO");
      console.log("Semana:", weekStart);
      console.log("ID determinístico esperado:", deterministicId);
      console.log("Documentos encontrados:");

      docs.forEach(d => {
        console.log("   - ID:", d.id);
        console.log("     completada:", d.completada);
        console.log("     tiene assignments:", d.hasAssignments);
        console.log("     fechas en assignments:", d.assignmentKeys);
      });

      console.log("--------------------------------------------------\n");
    } else {
      const d = docs[0];
      if (d.id !== deterministicId) {
        console.log("⚠️ ID no determinístico detectado");
        console.log("Semana:", weekStart);
        console.log("ID actual:", d.id);
        console.log("ID esperado:", deterministicId);
        console.log("--------------------------------------------------\n");
      }
    }
  }

  if (duplicados === 0) {
    console.log("✅ No se detectaron duplicados por weekStart.\n");
  }

  console.log("🏁 Diagnóstico finalizado.");
}

diagnosticar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Error en diagnóstico:", err);
    process.exit(1);
  });
