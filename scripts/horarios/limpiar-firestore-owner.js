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

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function scanCollection(colRef, counters) {
  const snap = await colRef.get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const ownerId = data?.ownerId ?? null;
    const pathDoc = doc.ref.path;

    let shouldDelete = false;
    let reason = "";

    if (!ownerId) {
      shouldDelete = true;
      reason = "sin ownerId";
    } else if (ownerId !== OWNER_OK) {
      shouldDelete = true;
      reason = `ownerId distinto (${ownerId})`;
    }

    if (shouldDelete) {
      counters.toDelete++;
      counters.samples.push({ path: pathDoc, reason });

      if (APPLY) {
        await db.recursiveDelete(doc.ref);
        counters.deleted++;
      }
    } else {
      counters.kept++;
    }

    const subcollections = await doc.ref.listCollections();
    for (const sub of subcollections) {
      await scanCollection(sub, counters);
    }
  }
}

async function main() {
  console.log("======================================");
  console.log("🧹 LIMPIEZA /apps/horarios");
  console.log("======================================");
  console.log("Owner válido:", OWNER_OK);
  console.log("Modo:", APPLY ? "🔥 BORRADO REAL" : "🧪 AUDITORÍA");
  console.log("");

  if (APPLY) {
    const confirm = await ask(`Escribí EXACTO el ownerId para confirmar:\n${OWNER_OK}\n> `);
    if (confirm !== OWNER_OK) {
      console.log("❌ Confirmación incorrecta. Abortando.");
      process.exit(1);
    }

    const confirm2 = await ask('Escribí "BORRAR" para ejecutar:\n> ');
    if (confirm2 !== "BORRAR") {
      console.log("❌ No se escribió BORRAR. Abortando.");
      process.exit(1);
    }
  }

  const counters = {
    kept: 0,
    toDelete: 0,
    deleted: 0,
    samples: [],
  };

  const horariosRef = db.collection("apps").doc("horarios");
  const subcollections = await horariosRef.listCollections();

  for (const col of subcollections) {
    console.log("🔎 Escaneando:", col.id);
    await scanCollection(col, counters);
  }

  console.log("\n======================================");
  console.log("📊 RESUMEN");
  console.log("======================================");
  console.log("Se mantienen:", counters.kept);
  console.log("Candidatos a borrar:", counters.toDelete);
  console.log("Borrados:", counters.deleted);

  console.log("\n🧾 Muestra:");
  counters.samples.slice(0, 20).forEach((s, i) => {
    console.log(`${i + 1}. ${s.path} → ${s.reason}`);
  });

  if (!APPLY) {
    console.log("\n👉 Para borrar de verdad:");
    console.log('PowerShell:  $env:APPLY="true"; node limpiar-apps-horarios.js');
  }
}

main().then(() => process.exit(0));
