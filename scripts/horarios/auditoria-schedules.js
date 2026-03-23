const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey-controlfile.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "controlstorage-eb796",
});

const db = admin.firestore();

async function auditarSchedules() {
  console.log("🔍 Iniciando auditoría completa de schedules...\n");

  const schedulesRef = db
    .collection("apps")
    .doc("horarios")
    .collection("schedules");

  const snapshot = await schedulesRef.get();

  console.log(`📊 Total schedules encontrados: ${snapshot.size}\n`);

  const duplicadosMap = new Map();
  let vacios = [];
  let sinOwner = [];
  let sinWeekStart = [];

  snapshot.forEach(doc => {
    const data = doc.data();

    const ownerId = data.ownerId || null;
    const weekStart = data.weekStart || null;

    if (!ownerId) sinOwner.push(doc.id);
    if (!weekStart) sinWeekStart.push(doc.id);

    const key = `${ownerId}_${weekStart}`;

    if (!duplicadosMap.has(key)) {
      duplicadosMap.set(key, []);
    }

    duplicadosMap.get(key).push({
      id: doc.id,
      assignments: data.assignments || [],
      completada: data.completada || false,
      createdAt: data.createdAt || null,
      size: JSON.stringify(data).length
    });

    // Detectar vacíos
    if (!data.assignments || data.assignments.length === 0) {
      vacios.push(doc.id);
    }
  });

  console.log("======================================");
  console.log("🔁 DUPLICADOS DETECTADOS");
  console.log("======================================\n");

  for (const [key, docs] of duplicadosMap.entries()) {
    if (docs.length > 1) {
      console.log(`⚠️ ${key} → ${docs.length} documentos`);
      docs.forEach(d => {
        console.log(`   - ID: ${d.id}`);
        console.log(`     assignments: ${d.assignments.length}`);
        console.log(`     completada: ${d.completada}`);
        console.log(`     size aprox: ${d.size} bytes\n`);
      });
    }
  }

  console.log("======================================");
  console.log("📭 SCHEDULES VACÍOS");
  console.log("======================================\n");

  if (vacios.length === 0) {
    console.log("✅ No hay schedules vacíos\n");
  } else {
    vacios.forEach(id => console.log(`   - ${id}`));
    console.log(`\nTotal vacíos: ${vacios.length}\n`);
  }

  console.log("======================================");
  console.log("❌ SIN ownerId");
  console.log("======================================\n");

  if (sinOwner.length === 0) {
    console.log("✅ Todos tienen ownerId\n");
  } else {
    sinOwner.forEach(id => console.log(`   - ${id}`));
    console.log(`\nTotal sin ownerId: ${sinOwner.length}\n`);
  }

  console.log("======================================");
  console.log("❌ SIN weekStart");
  console.log("======================================\n");

  if (sinWeekStart.length === 0) {
    console.log("✅ Todos tienen weekStart\n");
  } else {
    sinWeekStart.forEach(id => console.log(`   - ${id}`));
    console.log(`\nTotal sin weekStart: ${sinWeekStart.length}\n`);
  }

  console.log("======================================");
  console.log("📈 RESUMEN FINAL");
  console.log("======================================\n");

  console.log(`Total schedules: ${snapshot.size}`);
  console.log(`Vacíos: ${vacios.length}`);
  console.log(`Sin ownerId: ${sinOwner.length}`);
  console.log(`Sin weekStart: ${sinWeekStart.length}`);

  console.log("\n🔎 Auditoría completada.\n");
}

auditarSchedules()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("💥 Error en auditoría:", err);
    process.exit(1);
  });
