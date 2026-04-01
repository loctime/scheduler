import { doc, setDoc, serverTimestamp, query, where, getDocs, updateDoc, collection, getDoc } from "firebase/firestore"
import { auth, db, COLLECTIONS } from "@/lib/firebase"
import { signOut } from "firebase/auth"

export interface InvitacionValidationResult {
  tokenValid: boolean
  createdBy: string | null
}

const ALLOWED_ROLES = ["operador", "delivery", "admin"] as const

type AllowedRole = (typeof ALLOWED_ROLES)[number]

const isAllowedRole = (role: any): role is AllowedRole => {
  return role === "operador" || role === "delivery" || role === "admin"
}

export async function validarTokenInvitacion(token: string | null): Promise<InvitacionValidationResult> {
  if (!token || !db) {
    return { tokenValid: false, createdBy: null }
  }

  try {
    const q = query(collection(db, COLLECTIONS.INVITACIONES), where("token", "==", token))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      return { tokenValid: false, createdBy: null }
    }

    const linkData = snapshot.docs[0].data()
    return { tokenValid: true, createdBy: linkData.createdBy || null }
  } catch (error: any) {
    if (error?.code === "permission-denied") {
      return { tokenValid: true, createdBy: null }
    }
    throw error
  }
}

export async function procesarRegistroInvitacion(user: any, token: string): Promise<void> {
  if (!token || !db) {
    throw new Error("Token de invitacion invalido")
  }

  let snapshot
  try {
    const q = query(collection(db, COLLECTIONS.INVITACIONES), where("token", "==", token))
    snapshot = await getDocs(q)
  } catch (error: any) {
    if (error?.code === "permission-denied") {
      throw new Error("No tienes permisos para validar esta invitacion. Verifica tu sesion e intenta nuevamente.")
    }
    throw new Error("No se pudo validar la invitacion. Intenta nuevamente.")
  }

  if (snapshot.empty) {
    throw new Error("Token de invitacion invalido")
  }

  const linkDoc = snapshot.docs[0]
  const linkData = linkDoc.data() as any

  const usedBy = linkData.usedBy || linkData.usadoPor || null
  const usedAt = linkData.usedAt || linkData.usadoEn || null
  if (usedBy || usedAt || linkData.usado === true) {
    throw new Error("Este link de invitacion ya fue usado por otro usuario. Solicita un nuevo link.")
  }

  const roleDelLink = linkData.role
  const locationId = linkData.locationId
  const createdBy = linkData.createdBy

  if (!isAllowedRole(roleDelLink)) {
    throw new Error("El link no tiene un rol valido. Solicita un nuevo link.")
  }
  if (!locationId || typeof locationId !== "string" || !locationId.trim()) {
    throw new Error("El link no tiene locationId valido. Solicita un nuevo link.")
  }
  if (!createdBy || typeof createdBy !== "string") {
    throw new Error("El link no tiene creador valido. Solicita un nuevo link.")
  }

  const userRef = doc(db, COLLECTIONS.USERS, user.uid)
  const userDoc = await getDoc(userRef)

  if (userDoc.exists()) {
    const userData = userDoc.data()
    if (userData.ownerId && createdBy && userData.ownerId !== createdBy) {
      if (auth) {
        await signOut(auth)
      }
      throw new Error("Esta cuenta ya esta registrada. Por favor inicia sesion normalmente.")
    }

    const updateData: any = {
      email: user.email,
      displayName: user.displayName || user.email?.split("@")[0] || "Usuario",
      photoURL: user.photoURL || null,
      role: roleDelLink,
      locationId: locationId.trim(),
      ownerId: createdBy,
      updatedAt: serverTimestamp(),
    }

    await updateDoc(userRef, updateData)
  } else {
    const userData: any = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split("@")[0] || "Usuario",
      photoURL: user.photoURL || null,
      role: roleDelLink,
      locationId: locationId.trim(),
      ownerId: createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    await setDoc(userRef, userData)
  }

  await updateDoc(doc(db, COLLECTIONS.INVITACIONES, linkDoc.id), {
    usedBy: user.uid,
    usedAt: serverTimestamp(),
  })
}
