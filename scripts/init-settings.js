const { initializeApp } = require("firebase/app")
const { getFirestore, doc, setDoc, serverTimestamp } = require("firebase/firestore")
const { getWeek, startOfWeek, format } = require("date-fns")
const { es } = require("date-fns/locale")

// Helper para normalizar IDs (similar al de frontend)
function normalizeFirestoreId(value) {
  return value.replace(/\//g, '_').replace(/#/g, '_').replace(/\$/g, '_').replace(/\[/g, '_').replace(/\]/g, '_')
}

// Configuración de Firebase (debe coincidir con la del proyecto)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Función para generar ID de semana
function generateWeekId(date) {
  const month = format(date, "MM", { locale: es })
  const year = format(date, "yyyy", { locale: es })
  const weekNumber = getWeek(date, { weekStartsOn: 1, locale: es })
  
  return `${month}/${year}-W${weekNumber}`
}

async function initializeSettings() {
  try {
    // Inicializar Firebase
    const app = initializeApp(firebaseConfig)
    const db = getFirestore(app)

    // Obtener ownerId desde variable de entorno o parámetro
    const ownerId = process.env.OWNER_ID || process.argv[2]
    
    if (!ownerId) {
      throw new Error("Se requiere OWNER_ID. Usar: OWNER_ID=tu_uid node scripts/init-settings.js")
    }

    console.log(`🔧 [init-settings] Using ownerId: ${ownerId}`)

    // Generar ID de la semana actual
    const currentWeekId = generateWeekId(new Date())
    const normalizedWeekId = normalizeFirestoreId(currentWeekId)

    // Crear documento de settings - path corregido
    const settingsRef = doc(db, "apps", "horarios", normalizeFirestoreId(ownerId), "settings", "main")
    
    await setDoc(settingsRef, {
      publishedWeekId: currentWeekId,
      updatedAt: serverTimestamp(),
      initializedAt: serverTimestamp()
    })

    console.log(`✅ Settings inicializados con semana publicada: ${currentWeekId}`)
    
    // Crear documento de la semana actual
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const weekData = {
      weekId: currentWeekId,
      startDate: format(monday, "dd/MM/yyyy", { locale: es }),
      endDate: format(sunday, "dd/MM/yyyy", { locale: es }),
      weekNumber: getWeek(monday, { weekStartsOn: 1, locale: es }),
      year: monday.getFullYear(),
      month: monday.getMonth(),
      createdBy: "system", // El script se ejecuta como sistema
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    // Path corregido para weeks: apps/horarios/weeks/{ownerId}_{weekId}
    const compositeId = `${normalizeFirestoreId(ownerId)}_${normalizeFirestoreId(currentWeekId)}`
    const weekRef = doc(db, "apps", "horarios", "weeks", compositeId)
    await setDoc(weekRef, weekData)

    console.log(`✅ Semana ${currentWeekId} creada en Firestore`)
    console.log(`   📅 ${weekData.startDate} - ${weekData.endDate}`)

  } catch (error) {
    console.error("❌ Error al inicializar settings:", error)
    process.exit(1)
  }
}

// Ejecutar script
initializeSettings().then(() => {
  console.log("🎉 Inicialización completada")
  process.exit(0)
})
