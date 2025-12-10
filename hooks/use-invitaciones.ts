"use client"

import { useState, useEffect } from "react"
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, getDoc, deleteDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { InvitacionLink } from "@/lib/types"

export function useInvitaciones(user: any) {
  const { toast } = useToast()
  const [links, setLinks] = useState<InvitacionLink[]>([])
  const [loading, setLoading] = useState(true)

  // Generar token único
  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  // Crear nuevo link de invitación
  const crearLinkInvitacion = async () => {
    if (!user || !db) return null

    try {
      const token = generateToken()
      const linkRef = await addDoc(collection(db, COLLECTIONS.INVITACIONES), {
        token,
        ownerId: user.uid,
        activo: true,
        usado: false,
        createdAt: serverTimestamp(),
      })

      const newLink: InvitacionLink = {
        id: linkRef.id,
        token,
        ownerId: user.uid,
        activo: true,
        usado: false,
      }

      await cargarLinks()
      return newLink
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo crear el link de invitación",
        variant: "destructive",
      })
      return null
    }
  }

  // Cargar todos los links del usuario
  const cargarLinks = async () => {
    if (!user || !db) return

    try {
      setLoading(true)
      const q = query(
        collection(db, COLLECTIONS.INVITACIONES),
        where("ownerId", "==", user.uid)
      )
      const snapshot = await getDocs(q)
      const linksData = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const linkData = {
            id: doc.id,
            ...doc.data(),
          } as InvitacionLink

          // Si el link fue usado, obtener el email del usuario
          if (linkData.usado && linkData.usadoPor) {
            try {
              const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, linkData.usadoPor))
              if (userDoc.exists()) {
                linkData.usadoPorEmail = userDoc.data().email || "Email no disponible"
              }
            } catch (error) {
              console.error("Error obteniendo email del usuario:", error)
              linkData.usadoPorEmail = "Email no disponible"
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

  // Desactivar link (solo marca como inactivo)
  const desactivarLink = async (linkId: string) => {
    if (!db) return

    try {
      await updateDoc(doc(db, COLLECTIONS.INVITACIONES, linkId), {
        activo: false,
      })
      await cargarLinks()
      toast({
        title: "Link desactivado",
        description: "El link de invitación ha sido desactivado",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo desactivar el link",
        variant: "destructive",
      })
    }
  }

  // Eliminar link completamente (y opcionalmente el usuario vinculado)
  const eliminarLink = async (linkId: string, eliminarUsuario: boolean = false) => {
    if (!db) return

    try {
      // Obtener el link antes de eliminarlo para saber si tiene usuario vinculado
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

      // Si se solicita eliminar el usuario y existe un usuario vinculado
      if (eliminarUsuario && linkData.usadoPor) {
        try {
          await deleteDoc(doc(db, COLLECTIONS.USERS, linkData.usadoPor))
          toast({
            title: "Usuario eliminado",
            description: "El usuario vinculado ha sido eliminado",
          })
        } catch (error: any) {
          console.error("Error eliminando usuario:", error)
          toast({
            title: "Advertencia",
            description: "El link fue eliminado pero no se pudo eliminar el usuario",
            variant: "destructive",
          })
        }
      }

      // Eliminar el link
      await deleteDoc(doc(db, COLLECTIONS.INVITACIONES, linkId))
      await cargarLinks()
      
      toast({
        title: "Link eliminado",
        description: "El link de invitación ha sido eliminado completamente",
      })
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
    desactivarLink,
    eliminarLink,
    cargarLinks,
  }
}

