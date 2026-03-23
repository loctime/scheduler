import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey-controlfile.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function run() {
  const snap = await db
    .collection("apps/horarios/schedules")
    .limit(3)
    .get();

  snap.forEach(doc => {
    console.log("----", doc.id);
    console.log(doc.data());
  });

  process.exit(0);
}

run();
