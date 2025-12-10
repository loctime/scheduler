"use client"

import { useState, useEffect } from "react"
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore"
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
      const linksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as InvitacionLink[]
      setLinks(linksData)
    } catch (error: any) {
      console.error("Error loading links:", error)
    } finally {
      setLoading(false)
    }
  }

  // Desactivar link
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
    cargarLinks,
  }
}

