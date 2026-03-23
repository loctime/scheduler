const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey-controlfile.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "controlstorage-eb796",
});

const db = admin.firestore();

async function limpiarSchedules() {
  console.log("🧹 INICIANDO LIMPIEZA ESTRUCTURAL DE SCHEDULES...\n");

  const schedulesRef = db
    .collection("apps")
    .doc("horarios")
    .collection("schedules");

  const snapshot = await schedulesRef.get();

  console.log(`📊 Total schedules encontrados: ${snapshot.size}\n`);

  const grupos = new Map();
  let batch = db.batch();
  let operaciones = 0;
  let eliminados = 0;

  // Agrupar por ownerId + weekStart
  snapshot.forEach(doc => {
    const data = doc.data();
    const ownerId = data.ownerId || null;
    const weekStart = data.weekStart || null;

    const key = `${ownerId}_${weekStart}`;

    if (!grupos.has(key)) {
      grupos.set(key, []);
    }

    grupos.get(key).push({
      id: doc.id,
      ref: doc.ref,
      size: JSON.stringify(data).length,
      ownerId,
      weekStart
    });
  });

  for (const [key, docs] of grupos.entries()) {

    // 🧨 ELIMINAR LOS QUE NO TIENEN ownerId
    if (key.startsWith("null_")) {
      docs.forEach(d => {
        console.log(`❌ Eliminando (sin ownerId): ${d.id}`);
        batch.delete(d.ref);
        operaciones++;
        eliminados++;
      });
      continue;
    }

    // 🔁 Resolver duplicados
    if (docs.length > 1) {
      console.log(`⚠️ Duplicado detectado: ${key}`);

      // Ordenar por tamaño DESC (mantener el más grande)
      docs.sort((a, b) => b.size - a.size);

      const [mantener, ...borrar] = docs;

      console.log(`   ✅ Manteniendo: ${mantener.id} (${mantener.size} bytes)`);

      borrar.forEach(d => {
        console.log(`   ❌ Eliminando: ${d.id} (${d.size} bytes)`);
        batch.delete(d.ref);
        operaciones++;
        eliminados++;
      });
    }
  }

  if (operaciones > 0) {
    await batch.commit();
  }

  console.log("\n====================================");
  console.log("✅ LIMPIEZA COMPLETADA");
  console.log(`🗑 Total eliminados: ${eliminados}`);
  console.log("====================================\n");
}

limpiarSchedules()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("💥 ERROR:", err);
    process.exit(1);
  });
