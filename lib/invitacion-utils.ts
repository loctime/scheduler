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
    throw new Error("Token de invitación inválido")
  }

  // Buscar el link de invitación nuevamente para asegurarnos de que sigue válido
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
      throw new Error("No tienes permisos para validar esta invitación. Verifica tu sesión e intenta nuevamente.")
    }
    throw new Error("No se pudo validar la invitación. Intenta nuevamente.")
  }

  if (snapshot.empty) {
    let statusMessage = "Token de invitación inválido"
    try {
      const statusQuery = query(
        collection(db, COLLECTIONS.INVITACIONES),
        where("token", "==", token)
      )
      const statusSnapshot = await getDocs(statusQuery)
      if (statusSnapshot.empty) {
        statusMessage = "Token de invitación inválido"
      } else {
        const statusData = statusSnapshot.docs[0].data()
        if (statusData.activo === false) {
          statusMessage = "Este link de invitación fue desactivado."
        } else if (statusData.usado) {
          statusMessage = "Este link de invitación ya fue usado por otro usuario. Solicita un nuevo link."
        } else {
          statusMessage = "Este link de invitación no está disponible en este momento."
        }
      }
    } catch (error: any) {
      statusMessage = "No se pudo validar la invitación. Intenta nuevamente."
    }
    throw new Error(statusMessage)
  }

  const linkDoc = snapshot.docs[0]
  const linkData = linkDoc.data()
  const ownerId = linkData.ownerId
  const roleDelLink = "invited"
  const permisosDelLink = linkData.permisos
  const emailInvitacion = typeof linkData.email === "string" ? linkData.email.toLowerCase() : null
  const emailUsuario = typeof user.email === "string" ? user.email.toLowerCase() : null

  if (emailInvitacion) {
    if (!emailUsuario) {
      throw new Error("No se pudo validar tu email con esta invitación. Usa un método de acceso con email.")
    }
    if (emailInvitacion !== emailUsuario) {
      throw new Error("El email de la invitación no coincide con el de tu cuenta.")
    }
  }

  // Verificar si el usuario ya existe en Firestore
  const userRef = doc(db, COLLECTIONS.USERS, user.uid)
  const userDoc = await getDoc(userRef)

  if (userDoc.exists()) {
    const userData = userDoc.data()
    // Si el usuario ya existe pero no es invitado, o es invitado de otro owner, mostrar error
    if (userData.role !== "invited" || (userData.ownerId && userData.ownerId !== ownerId)) {
      if (auth) {
        await signOut(auth)
      }
      throw new Error("Esta cuenta ya está registrada. Por favor inicia sesión normalmente.")
    } else {
      // Si ya es invitado del mismo owner, actualizar información
      const updateData: any = {
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0] || "Usuario",
        photoURL: user.photoURL || null,
        role: roleDelLink,
        ownerId: ownerId || null,
        updatedAt: serverTimestamp(),
      }
      if (permisosDelLink) {
        updateData.permisos = permisosDelLink
      }
      await updateDoc(userRef, updateData)
    }

    // Marcar link como usado si no estaba ya usado
    if (!linkData.usado) {
      await updateDoc(doc(db, COLLECTIONS.INVITACIONES, linkDoc.id), {
        usado: true,
        usadoPor: user.uid,
        usadoEn: serverTimestamp(),
      })
    }
  } else {
    const rolAAsignar = "invited"

    const userData: any = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split("@")[0] || "Usuario",
      photoURL: user.photoURL || null,
      role: rolAAsignar,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    if (rolAAsignar === "invited" && ownerId) {
      userData.ownerId = ownerId
    }

    if (permisosDelLink) {
      userData.permisos = permisosDelLink
    }

    await setDoc(userRef, userData)

    await updateDoc(doc(db, COLLECTIONS.INVITACIONES, linkDoc.id), {
      usado: true,
      usadoPor: user.uid,
      usadoEn: serverTimestamp(),
    })
  }
}
