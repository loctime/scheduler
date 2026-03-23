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

// 🔥 OMITIMOS historial
const COLECCIONES_A_LIMPIAR = [
  "schedules",
  "employees",
  "shifts",
  "products",
  "branches",
  "settings"
];

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function limpiarColeccion(nombre, counters) {
  const colRef = db.collection("apps").doc("horarios").collection(nombre);
  const snap = await colRef.get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const ownerId = data?.ownerId ?? null;
    const pathDoc = doc.ref.path;

    if (!ownerId || ownerId !== OWNER_OK) {
      counters.toDelete++;
      counters.samples.push(pathDoc);

      if (APPLY) {
        await doc.ref.delete();
        counters.deleted++;
      }
    } else {
      counters.kept++;
    }
  }
}

async function main() {
  console.log("======================================");
  console.log("🧹 LIMPIEZA /apps/horarios (SIN historial)");
  console.log("======================================");
  console.log("Owner válido:", OWNER_OK);
  console.log("Modo:", APPLY ? "🔥 BORRADO REAL" : "🧪 AUDITORÍA");
  console.log("");

  if (APPLY) {
    const confirm = await ask(`Escribí EXACTO el ownerId:\n${OWNER_OK}\n> `);
    if (confirm !== OWNER_OK) {
      console.log("❌ Confirmación incorrecta.");
      process.exit(1);
    }

    const confirm2 = await ask('Escribí "BORRAR":\n> ');
    if (confirm2 !== "BORRAR") {
      console.log("❌ Abortado.");
      process.exit(1);
    }
  }

  const counters = {
    kept: 0,
    toDelete: 0,
    deleted: 0,
    samples: [],
  };

  for (const col of COLECCIONES_A_LIMPIAR) {
    console.log("🔎 Escaneando:", col);
    await limpiarColeccion(col, counters);
  }

  console.log("\n======================================");
  console.log("📊 RESUMEN");
  console.log("======================================");
  console.log("Se mantienen:", counters.kept);
  console.log("Candidatos a borrar:", counters.toDelete);
  console.log("Borrados:", counters.deleted);

  console.log("\n🧾 Muestra:");
  counters.samples.slice(0, 20).forEach((s, i) => {
    console.log(`${i + 1}. ${s}`);
  });

  if (!APPLY) {
    console.log("\n👉 Para ejecutar borrado real:");
    console.log('$env:APPLY="true"; node limpiar-horarios-sin-historial.js');
  }
}

main().then(() => process.exit(0));
