const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey-controlfile.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "controlstorage-eb796",
});

async function buscarEmail(uid) {
  try {
    const user = await admin.auth().getUser(uid);

    console.log("\n====================================");
    console.log("UID:", user.uid);
    console.log("Email:", user.email);
    console.log("Email verificado:", user.emailVerified);
    console.log("Proveedor:", user.providerData.map(p => p.providerId).join(", "));
    console.log("====================================\n");

  } catch (error) {
    console.error("Error buscando usuario:", error);
  }
}

buscarEmail("uefWFJ8LMbXOhYN186RITrUVHF42")
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
