const admin = require("firebase-admin");
const path = require("path");

// Cargar service account desde la raíz
const serviceAccount = require(path.join(__dirname, "serviceAccountKey-controlfile.json"));

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "controlstorage-eb796",
});

const db = admin.firestore();

async function limpiarSemanasCompletadas() {
  console.log("🧹 Iniciando limpieza de semanas completadas...");

  try {
    const schedulesRef = db.collection("apps").doc("horarios").collection("schedules");

    const snapshot = await schedulesRef
      .where("completada", "==", true)
      .get();

    console.log(`📊 Encontradas ${snapshot.size} semanas completadas`);

    if (snapshot.empty) {
      console.log("✅ No hay semanas completadas para limpiar");
      return;
    }

    let batch = db.batch();
    let operationCount = 0;
    let totalUpdated = 0;

    for (const doc of snapshot.docs) {
      console.log(`🔄 Limpiando semana: ${doc.id}`);

      batch.update(doc.ref, { completada: false });

      operationCount++;
      totalUpdated++;

      // Firestore permite máximo 500 operaciones por batch
      if (operationCount === 500) {
        await batch.commit();
        console.log("⚡ Batch de 500 confirmado");
        batch = db.batch();
        operationCount = 0;
      }
    }

    // Confirmar operaciones restantes
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log("✅ ¡Limpieza completada!");
    console.log(`📈 Se limpiaron ${totalUpdated} semanas`);

  } catch (error) {
    console.error("❌ Error al limpiar semanas:", error);
    process.exit(1);
  }
}

// Ejecutar
limpiarSemanasCompletadas()
  .then(() => {
    console.log("🎉 Script finalizado correctamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Error fatal:", error);
    process.exit(1);
  });
