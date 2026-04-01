import { doc, setDoc, serverTimestamp, query, where, getDocs, updateDoc, collection, getDoc } from "firebase/firestore"
import { auth, db, COLLECTIONS } from "@/lib/firebase"
import { signOut } from "firebase/auth"

export interface InvitacionValidationResult {
  tokenValid: boolean
  ownerId: string | null
}

export async function validarTokenInvitacion(token: string | null): Promise<InvitacionValidationResult> {
  if (!token || !db) {
    return { tokenValid: false, ownerId: null }
  }

  try {
    const q = query(
      collection(db, COLLECTIONS.INVITACIONES),
      where("token", "==", token),
      where("activo", "==", true),
      where("usado", "==", false)
    )
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      return { tokenValid: false, ownerId: null }
    }

    const linkData = snapshot.docs[0].data()
    return { tokenValid: true, ownerId: linkData.ownerId || null }
  } catch (error: any) {
    if (error?.code === "permission-denied") {
      return { tokenValid: true, ownerId: null }
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
    const q = query(
      collection(db, COLLECTIONS.INVITACIONES),
      where("token", "==", token),
      where("activo", "==", true),
      where("usado", "==", false)
    )
    snapshot = await getDocs(q)
  } catch (error: any) {
    if (error?.code === "permission-denied") {
      throw new Error("No tienes permisos para validar esta invitacion. Verifica tu sesion e intenta nuevamente.")
    }
    throw new Error("No se pudo validar la invitacion. Intenta nuevamente.")
  }

  if (snapshot.empty) {
    let statusMessage = "Token de invitacion invalido"
    try {
      const statusQuery = query(
        collection(db, COLLECTIONS.INVITACIONES),
        where("token", "==", token)
      )
      const statusSnapshot = await getDocs(statusQuery)
      if (statusSnapshot.empty) {
        statusMessage = "Token de invitacion invalido"
      } else {
        const statusData = statusSnapshot.docs[0].data()
        if (statusData.activo === false) {
          statusMessage = "Este link de invitacion fue desactivado."
        } else if (statusData.usado) {
          statusMessage = "Este link de invitacion ya fue usado por otro usuario. Solicita un nuevo link."
        } else {
          statusMessage = "Este link de invitacion no esta disponible en este momento."
        }
      }
    } catch (error: any) {
      statusMessage = "No se pudo validar la invitacion. Intenta nuevamente."
    }
    throw new Error(statusMessage)
  }

  const linkDoc = snapshot.docs[0]
  const linkData = linkDoc.data()
  const ownerId = linkData.ownerId || null
  const roleDelLink = linkData.role || "operador"
  const locationId = linkData.locationId || null
  const emailInvitacion = typeof linkData.email === "string" ? linkData.email.toLowerCase() : null
  const emailUsuario = typeof user.email === "string" ? user.email.toLowerCase() : null

  if (emailInvitacion) {
    if (!emailUsuario) {
      throw new Error("No se pudo validar tu email con esta invitacion. Usa un metodo de acceso con email.")
    }
    if (emailInvitacion !== emailUsuario) {
      throw new Error("El email de la invitacion no coincide con el de tu cuenta.")
    }
  }

  const userRef = doc(db, COLLECTIONS.USERS, user.uid)
  const userDoc = await getDoc(userRef)

  if (userDoc.exists()) {
    const userData = userDoc.data()
    if (userData.ownerId && ownerId && userData.ownerId !== ownerId) {
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
      locationId: locationId || userData.locationId || null,
      ownerId: ownerId || userData.ownerId || null,
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
      locationId: locationId || null,
      ownerId: ownerId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    await setDoc(userRef, userData)
  }

  if (!linkData.usado) {
    await updateDoc(doc(db, COLLECTIONS.INVITACIONES, linkDoc.id), {
      usado: true,
      usadoPor: user.uid,
      usadoEn: serverTimestamp(),
    })
  }
}
