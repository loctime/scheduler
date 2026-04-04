import { initializeApp, getApps } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import { getFirestore, type Firestore, enableIndexedDbPersistence, enableNetwork, disableNetwork } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Check if Firebase config is valid
export const isFirebaseConfigured = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  )
}

// Initialize Firebase only if configured
let app
let auth: Auth | undefined
let db: Firestore | undefined
let persistenceEnabled = false

if (isFirebaseConfigured()) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  auth = getAuth(app)
  db = getFirestore(app)
  
  // Activar Firestore Offline Persistence solo en cliente
  if (typeof window !== "undefined" && !persistenceEnabled) {
    enableIndexedDbPersistence(db)
      .then(() => {
        persistenceEnabled = true
        console.log("[Firestore] Offline persistence habilitada")
      })
      .catch((err: any) => {
        // Manejar error de múltiples tabs
        if (err.code === "failed-precondition") {
          // Múltiples tabs abiertos, solo uno puede tener persistence
          console.warn("[Firestore] Persistence no disponible (múltiples tabs detectados)")
        } else if (err.code === "unimplemented") {
          // Navegador no soporta persistence
          console.warn("[Firestore] Persistence no implementada en este navegador")
        } else {
          console.error("[Firestore] Error al habilitar persistence:", err)
        }
      })
  }
}

export { auth, db }

// Helper functions for collection paths with apps/horarios/ prefix
export const getCollectionPath = (collectionName: string) => {
  return `apps/horarios/${collectionName}`
}

export const COLLECTIONS = {
  USERS: getCollectionPath("users"),
  EMPLOYEES: getCollectionPath("employees"),
  SHIFTS: getCollectionPath("shifts"),
  SCHEDULES: getCollectionPath("schedules"),
  HISTORIAL: getCollectionPath("historial"),
  CONFIG: getCollectionPath("config"),
  PEDIDOS: getCollectionPath("pedidos"),
  PRODUCTS: getCollectionPath("products"),
  LOTS: getCollectionPath("lots"),
  WAREHOUSE_ZONES: getCollectionPath("warehouse_zones"),
  STOCK_MOVIMIENTOS: getCollectionPath("stock_movimientos"),
  STOCK_ACTUAL: getCollectionPath("stock_actual"),
  REMITOS: getCollectionPath("remitos"),
  RECEPCIONES: getCollectionPath("recepciones"),
  REMITOS_SALIDA: getCollectionPath("remitos_salida"),
  PEDIDOS_CONSOLIDADOS: getCollectionPath("pedidos_consolidados"),
  PEDIDOS_PENDIENTES: getCollectionPath("pedidos_pendientes"),
  AUDIT_LOGS: getCollectionPath("audit_logs"),
  COUNTERS: getCollectionPath("counters"),
  ENLACES_PUBLICOS: getCollectionPath("enlaces_publicos"),
  PEDIDOS_INTERNOS_V2: getCollectionPath("pedidos_internos"),
  REMITOS_SALIDA_V2: getCollectionPath("remitos_salida"),
  RECEPCIONES_REMITO_V2: getCollectionPath("recepciones_remito"),
  DEVOLUCIONES_REMITO_V2: getCollectionPath("devoluciones_remito"),
  STOCK_MOVEMENTS_V2: getCollectionPath("stock_movements_v2"),
  DOCUMENT_FILES_V2: getCollectionPath("document_files"),
  AUDIT_LOGS_V2: getCollectionPath("audit_logs"),
  COUNTERS_V2: getCollectionPath("counters"),
  INVITACIONES: getCollectionPath("invitaciones"),
  GROUPS: getCollectionPath("groups"),
  CONVERSACIONES: getCollectionPath("conversaciones"),
  MENSAJES: getCollectionPath("mensajes"),
  EMPLOYEE_FIXED_RULES: getCollectionPath("employee_fixed_rules"),
  PEDIDOS_FABRICA: getCollectionPath("pedidos_fabrica"),
  REMITOS_LOG: getCollectionPath("remitos_log"),
  RECEPCIONES_LOG: getCollectionPath("recepciones_log"),
} as const

