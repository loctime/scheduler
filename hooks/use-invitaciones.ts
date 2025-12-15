"use client"

import { useState, useEffect } from "react"
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, getDoc, deleteDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { InvitacionLink } from "@/lib/types"

export function useInvitaciones(user: any, userData?: { grupoIds?: string[] } | null) {
  const { toast } = useToast()
  const [links, setLinks] = useState<InvitacionLink[]>([])
  const [loading, setLoading] = useState(true)

  // Generar token único
  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  // Crear nuevo link de invitación
  const crearLinkInvitacion = async (
    role?: "branch" | "factory" | "admin" | "invited" | "manager",
    grupoId?: string,
    permisos?: { paginas?: string[]; crearLinks?: boolean }
  ) => {
    if (!user || !db) return null

    try {
      const token = generateToken()
      const linkData: any = {
        token,
        ownerId: user.uid,
        activo: true,
        usado: false,
        createdAt: serverTimestamp(),
      }

      // Si se especifica un rol, agregarlo al link
      if (role) {
        linkData.role = role
      }

      // Determinar el grupoId a usar:
      // 1. Si se especifica explícitamente, usarlo
      // 2. Si no, heredar el grupoId del usuario que crea el link (si pertenece a un grupo)
      // Esto asegura que todos los links creados por usuarios del mismo grupo pertenezcan al mismo grupo
      const grupoIdFinal = grupoId || (userData?.grupoIds && userData.grupoIds.length > 0 ? userData.grupoIds[0] : undefined)
      
      if (grupoIdFinal) {
        linkData.grupoId = grupoIdFinal
      }

      // Si se especifican permisos, agregarlos al link
      if (permisos) {
        linkData.permisos = permisos
      }

      const linkRef = await addDoc(collection(db, COLLECTIONS.INVITACIONES), linkData)

      const newLink: InvitacionLink = {
        id: linkRef.id,
        token,
        ownerId: user.uid,
        activo: true,
        usado: false,
        role: role,
        grupoId: grupoIdFinal,
        permisos: permisos,
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
        snapshot.docs.map(async (linkDoc) => {
          const linkData = {
            id: linkDoc.id,
            ...linkDoc.data(),
          } as InvitacionLink

          // Si el link fue usado, obtener el email del usuario
          if (linkData.usado && linkData.usadoPor && db) {
            try {
              const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, linkData.usadoPor))
              if (userDoc.exists()) {
                const userData = userDoc.data()
                linkData.usadoPorEmail = userData.email || "Email no disponible"
                console.log("📧 Email cargado para link:", linkData.id, "->", linkData.usadoPorEmail)
              } else {
                console.warn("⚠️ Usuario no encontrado para link:", linkData.id, "usadoPor:", linkData.usadoPor)
                linkData.usadoPorEmail = "Usuario no encontrado"
              }
            } catch (error) {
              console.error("Error obteniendo email del usuario:", error)
              linkData.usadoPorEmail = "Error al cargar email"
            }
          } else if (linkData.usado && !linkData.usadoPor) {
            console.warn("⚠️ Link marcado como usado pero sin usadoPor:", linkData.id)
            linkData.usadoPorEmail = "No disponible"
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
          console.log("🗑️ Eliminando usuario:", linkData.usadoPor)
          await deleteDoc(doc(db, COLLECTIONS.USERS, linkData.usadoPor))
          console.log("✅ Usuario eliminado exitosamente")
          toast({
            title: "Usuario eliminado",
            description: "El usuario vinculado ha sido eliminado",
          })
        } catch (error: any) {
          console.error("❌ Error eliminando usuario:", error)
          console.error("❌ Código de error:", error.code)
          console.error("❌ Mensaje:", error.message)
          toast({
            title: "Error al eliminar usuario",
            description: error.message || "No se pudo eliminar el usuario. Verifica las reglas de Firestore.",
            variant: "destructive",
          })
          // No continuar si no se pudo eliminar el usuario
          return
        }
      }

      // Eliminar el link
      console.log("🗑️ Eliminando link:", linkId)
      await deleteDoc(doc(db, COLLECTIONS.INVITACIONES, linkId))
      console.log("✅ Link eliminado exitosamente")
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

