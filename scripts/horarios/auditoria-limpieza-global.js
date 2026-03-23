const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey-controlfile.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "controlstorage-eb796",
});

const db = admin.firestore();

const OWNER_IMPORTANTE = "uefWFJ8LMbXOhYN186RITrUVHF42";

async function auditar() {
  console.log("🔍 AUDITORÍA GLOBAL\n");

  // -----------------------
  // 1️⃣ SCHEDULES
  // -----------------------
  const schedulesSnap = await db.collection("apps")
    .doc("horarios")
    .collection("schedules")
    .get();

  let eliminarSchedules = [];

  schedulesSnap.forEach(doc => {
    const data = doc.data();

    if (data.ownerId !== OWNER_IMPORTANTE) {
      eliminarSchedules.push({
        id: doc.id,
        ownerId: data.ownerId || null,
        weekStart: data.weekStart
      });
    }
  });

  console.log("📅 SCHEDULES a eliminar:", eliminarSchedules.length);
  eliminarSchedules.slice(0, 10).forEach(d => console.log(d));

  // -----------------------
  // 2️⃣ USERS AUTH
  // -----------------------
  const listUsersResult = await admin.auth().listUsers(1000);
  const eliminarUsers = listUsersResult.users.filter(
    user => user.uid !== OWNER_IMPORTANTE
  );

  console.log("\n👤 USERS AUTH a eliminar:", eliminarUsers.length);
  eliminarUsers.slice(0, 10).forEach(u =>
    console.log({ uid: u.uid, email: u.email })
  );

  console.log("\n⚠️ ESTO NO BORRA NADA.");
  console.log("Si confirmás, te doy el script de ejecución.");
}

auditar().then(() => process.exit(0));
