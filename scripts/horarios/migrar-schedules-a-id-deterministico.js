const admin = require("firebase-admin");
const path = require("path");
const readline = require("readline");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey-controlfile.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "controlstorage-eb796",
});

const db = admin.firestore();

const OWNER_OK = "uefWFJ8LMbXOhYN186RITrUVHF42";
const APPLY = process.env.APPLY === "true";

function buildDeterministicId(ownerId, weekStart) {
  return `${ownerId}__${weekStart}`;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function main() {
  console.log("======================================");
  console.log("🔄 MIGRACIÓN A ID DETERMINÍSTICO");
  console.log("======================================");
  console.log("Owner:", OWNER_OK);
  console.log("Modo:", APPLY ? "🔥 EJECUCIÓN REAL" : "🧪 MODO AUDITORÍA");
  console.log("");

  const schedulesRef = db.collection("apps").doc("horarios").collection("schedules");

  const snapshot = await schedulesRef.where("ownerId", "==", OWNER_OK).get();

  const agrupados = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const weekStart = data.weekStart;
    if (!weekStart) continue;

    if (!agrupados[weekStart]) {
      agrupados[weekStart] = [];
    }

    agrupados[weekStart].push({
      ref: doc.ref,
      id: doc.id,
      data,
    });
  }

  let migrados = 0;
  let conflictos = 0;

  for (const weekStart of Object.keys(agrupados)) {
    const docs = agrupados[weekStart];
    const deterministicId = buildDeterministicId(OWNER_OK, weekStart);

    const viejo = docs.find(d => d.id !== deterministicId);
    const nuevo = docs.find(d => d.id === deterministicId);

    if (!viejo && !nuevo) continue;

    if (viejo && !nuevo) {
      console.log(`📦 Semana ${weekStart}: solo ID viejo → crear determinístico`);

      if (APPLY) {
        await schedulesRef.doc(deterministicId).set(viejo.data);
        await viejo.ref.delete();
      }

      migrados++;
    }

    else if (viejo && nuevo) {
      const viejoTieneData =
        viejo.data.assignments &&
        Object.keys(viejo.data.assignments).length > 0;

      const nuevoTieneData =
        nuevo.data.assignments &&
        Object.keys(nuevo.data.assignments).length > 0;

      if (viejoTieneData && !nuevoTieneData) {
        console.log(`🔁 Semana ${weekStart}: nuevo vacío → copiar datos`);

        if (APPLY) {
          await schedulesRef.doc(deterministicId).set(viejo.data);
          await viejo.ref.delete();
        }

        migrados++;
      }

      else if (viejoTieneData && nuevoTieneData) {
        console.log(`⚠️ CONFLICTO en ${weekStart} → ambos tienen data. NO TOCADO.`);
        conflictos++;
      }
    }
  }

  console.log("\n======================================");
  console.log("📊 RESULTADO");
  console.log("======================================");
  console.log("Migrados:", migrados);
  console.log("Conflictos:", conflictos);

  if (!APPLY) {
    console.log("\n👉 Para ejecutar realmente:");
    console.log('$env:APPLY="true"; node migrar-schedules-a-id-deterministico.js');
  }

  console.log("\n🏁 Proceso finalizado.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
