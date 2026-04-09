"use client"

import { useState, useEffect } from "react"
import { collection, addDoc, query, where, getDocs, doc, serverTimestamp, getDoc, deleteDoc, updateDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { InvitacionLink } from "@/lib/types"

export function useInvitaciones(
  user: any,
  userData?: { role?: "operador" | "admin" | "delivery" | "colaborador"; locationId?: string | null } | null
) {
  const { toast } = useToast()
  const [links, setLinks] = useState<InvitacionLink[]>([])
  const [loading, setLoading] = useState(true)

  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  const crearLinkInvitacion = async (role?: "operador" | "admin" | "delivery" | "colaborador", locationId?: string) => {
    if (!user || !db) return null
    if (!role || (role !== "operador" && role !== "delivery" && role !== "admin" && role !== "colaborador")) {
      toast({
        title: "Error",
        description: "Rol invalido. Solo se permite operador, delivery, admin o colaborador.",
        variant: "destructive",
      })
      return null
    }
    if (role === "admin" && userData?.role !== "admin") {
      toast({
        title: "Error",
        description: "Solo un admin puede invitar a otro admin.",
        variant: "destructive",
      })
      return null
    }
    if (!locationId || !locationId.trim()) {
      toast({
        title: "Error",
        description: "LocationId es obligatorio.",
        variant: "destructive",
      })
      return null
    }

    try {
      const token = generateToken()
      const linkData = {
        token,
        createdBy: user.uid,
        role,
        locationId: locationId.trim(),
        createdAt: serverTimestamp(),
        usedBy: null,
        usedAt: null,
      }

      const linkRef = await addDoc(collection(db, COLLECTIONS.INVITACIONES), linkData)

      const newLink: InvitacionLink = {
        id: linkRef.id,
        token: linkData.token,
        createdBy: linkData.createdBy,
        role: linkData.role,
        locationId: linkData.locationId,
        createdAt: linkData.createdAt,
        usedBy: undefined,
        usedAt: undefined,
      }

      await cargarLinks()
      return newLink
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo crear el link de invitacion",
        variant: "destructive",
      })
      return null
    }
  }

  const cargarLinks = async () => {
    if (!user || !db) return

    try {
      setLoading(true)
      const q = query(collection(db, COLLECTIONS.INVITACIONES), where("createdBy", "==", user.uid))
      const snapshot = await getDocs(q)
      const linksData = await Promise.all(
        snapshot.docs.map(async (linkDoc) => {
          const linkData = {
            id: linkDoc.id,
            ...linkDoc.data(),
          } as InvitacionLink

          if (linkData.usedBy && db) {
            try {
              const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, linkData.usedBy))
              if (userDoc.exists()) {
                const userInfo = userDoc.data()
                linkData.usedByEmail = userInfo.email || "Email no disponible"
              } else {
                linkData.usedByEmail = "Usuario no encontrado"
              }
            } catch (error) {
              linkData.usedByEmail = "Error al cargar email"
            }
          }

          return linkData
        })
      )
      setLinks(linksData)
    } catch (error: any) {
      console.error("Error loading links:", error)
    } finally {
      setLoading(false)
    }
  }

  const desactivarUsuario = async (userId: string) => {
    if (!db || !user) return
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
        disabled: true,
        updatedAt: serverTimestamp(),
      })
      const invQ = query(collection(db, COLLECTIONS.INVITACIONES), where("createdBy", "==", user.uid))
      const invSnap = await getDocs(invQ)
      const aBorrar = invSnap.docs.filter((d) => (d.data() as InvitacionLink).usedBy === userId)
      await Promise.all(aBorrar.map((d) => deleteDoc(d.ref)))
      await cargarLinks()
      toast({
        title: "Cuenta desactivada",
        description: "El usuario ya no puede acceder a la aplicación.",
      })
    } catch (error: any) {
      console.error("Error desactivando usuario:", error)
      toast({
        title: "Error",
        description: error?.message || "No se pudo desactivar la cuenta",
        variant: "destructive",
      })
    }
  }

  const eliminarLink = async (linkId: string, eliminarUsuario: boolean = false) => {
    if (!db) return

    try {
      const linkDoc = await getDoc(doc(db, COLLECTIONS.INVITACIONES, linkId))
      if (!linkDoc.exists()) {
        toast({
          title: "Error",
          description: "El link no existe",
          variant: "destructive",
        })
        return
      }

      const linkData = linkDoc.data() as InvitacionLink

      let usuarioEliminadoEnServidor = false
      if (eliminarUsuario && linkData.usedBy) {
        try {
          await deleteDoc(doc(db, COLLECTIONS.USERS, linkData.usedBy))
          usuarioEliminadoEnServidor = true
        } catch (error: any) {
          console.warn("No se pudo eliminar el usuario en el servidor:", error?.code, error?.message)
        }
      }

      await deleteDoc(doc(db, COLLECTIONS.INVITACIONES, linkId))
      await cargarLinks()

      if (eliminarUsuario && linkData.usedBy && !usuarioEliminadoEnServidor) {
        toast({
          title: "Link eliminado",
          description: "El link se elimino. El usuario ya no aparecera en la lista. No se pudo eliminarlo del servidor.",
        })
      } else {
        toast({
          title: "Link eliminado",
          description: usuarioEliminadoEnServidor
            ? "El link y el usuario vinculado han sido eliminados."
            : "El link de invitacion ha sido eliminado.",
        })
      }
    } catch (error: any) {
      console.error("Error eliminando link:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el link",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (user) {
      cargarLinks()
    }
  }, [user])

  return {
    links,
    loading,
    crearLinkInvitacion,
    eliminarLink,
    desactivarUsuario,
    cargarLinks,
  }
}
