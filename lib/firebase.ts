import { initializeApp, getApps } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"

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

if (isFirebaseConfigured()) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  auth = getAuth(app)
  db = getFirestore(app)
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
} as const
