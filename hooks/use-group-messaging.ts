"use client"

import { useState, useEffect, useCallback } from "react"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  limit,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { ConversacionGrupo, MensajeGrupo, Group } from "@/lib/types"
import { useGroups } from "@/hooks/use-groups"
import { useData } from "@/contexts/data-context"

export function useGroupMessaging(user: any) {
  const { toast } = useToast()
  const { groups } = useGroups(user)
  const { userData } = useData()
  
  const [conversaciones, setConversaciones] = useState<ConversacionGrupo[]>([])
  const [mensajes, setMensajes] = useState<Record<string, MensajeGrupo[]>>({})
  const [conversacionActiva, setConversacionActiva] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Obtener o crear conversación entre grupos
  const obtenerOCrearConversacion = useCallback(async (
    grupoDestinoId: string,
    tipo: "grupo" | "directo" | "rol" = "grupo"
  ): Promise<string | null> => {
    if (!db || !user || !userData) return null

    // Guardar db en constante local para que TypeScript entienda que no es undefined
    const firestoreDb = db

    try {
      // Obtener el grupo del usuario actual
      const miGrupoId = userData.grupoIds?.[0] || user.uid
      
      // Buscar conversación existente
      const conversacionesQuery = query(
        collection(firestoreDb, COLLECTIONS.CONVERSACIONES),
        where("participantes", "array-contains", miGrupoId),
        where("tipo", "==", tipo),
        where("activa", "==", true)
      )
      
      const snapshot = await getDocs(conversacionesQuery)
      const conversacionExistente = snapshot.docs.find(doc => {
        const data = doc.data() as ConversacionGrupo
        return data.participantes.includes(grupoDestinoId) && data.participantes.length === 2
      })

      if (conversacionExistente) {
        return conversacionExistente.id
      }

      // Crear nueva conversación
      const nombresParticipantes: string[] = []
      
      // Obtener nombres de los grupos/usuarios
      if (tipo === "grupo") {
        const miGrupo = groups.find(g => g.id === miGrupoId)
        const grupoDestino = groups.find(g => g.id === grupoDestinoId)
        if (miGrupo) nombresParticipantes.push(miGrupo.nombre)
        if (grupoDestino) nombresParticipantes.push(grupoDestino.nombre)
      } else {
        // Para conversaciones directas o por rol, usar nombres de usuarios
        nombresParticipantes.push(userData.displayName || user.email?.split("@")[0] || "Usuario")
        // El otro participante se puede obtener después
      }

      const nuevaConversacion = await addDoc(collection(firestoreDb, COLLECTIONS.CONVERSACIONES), {
        tipo,
        participantes: [miGrupoId, grupoDestinoId],
        nombresParticipantes,
        noLeidos: {},
        activa: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      return nuevaConversacion.id
    } catch (error: any) {
      logger.error("Error al obtener/crear conversación:", error)
      toast({
        title: "Error",
        description: "No se pudo crear la conversación",
        variant: "destructive",
      })
      return null
    }
  }, [user, userData, groups, toast])

  // Enviar mensaje
  const enviarMensaje = useCallback(async (
    conversacionId: string,
    contenido: string
  ): Promise<boolean> => {
    if (!db || !user || !contenido.trim()) return false

    // Guardar db en constante local para que TypeScript entienda que no es undefined
    const firestoreDb = db

    try {
      const nuevoMensaje = {
        conversacionId,
        remitenteId: user.uid,
        remitenteNombre: userData?.displayName || user.email?.split("@")[0] || "Usuario",
        remitenteEmail: user.email,
        remitenteRole: userData?.role,
        contenido: contenido.trim(),
        leido: false,
        leidoPor: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await addDoc(collection(firestoreDb, COLLECTIONS.MENSAJES), nuevoMensaje)

      // Actualizar conversación con último mensaje
      const conversacionRef = doc(firestoreDb, COLLECTIONS.CONVERSACIONES, conversacionId)
      const conversacionDoc = await getDoc(conversacionRef)
      
      if (conversacionDoc.exists()) {
        const conversacionData = conversacionDoc.data() as ConversacionGrupo
        const noLeidos = { ...(conversacionData.noLeidos || {}) }
        
        // Incrementar contador de no leídos para todos los participantes excepto el remitente
        conversacionData.participantes.forEach(participanteId => {
          if (participanteId !== user.uid && participanteId !== userData?.grupoIds?.[0]) {
            noLeidos[participanteId] = (noLeidos[participanteId] || 0) + 1
          }
        })

        await updateDoc(conversacionRef, {
          ultimoMensaje: contenido.trim(),
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajePor: user.uid,
          noLeidos,
          updatedAt: serverTimestamp(),
        })
      }

      return true
    } catch (error: any) {
      logger.error("Error al enviar mensaje:", error)
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      })
      return false
    }
  }, [user, userData, toast])

  // Marcar mensajes como leídos
  const marcarComoLeidos = useCallback(async (conversacionId: string, mensajesActuales: MensajeGrupo[]) => {
    if (!db || !user || !userData) return

    // Guardar db en constante local para que TypeScript entienda que no es undefined
    const firestoreDb = db

    try {
      const mensajesNoLeidos = mensajesActuales.filter(
        m => !m.leidoPor?.includes(user.uid) && m.remitenteId !== user.uid
      )

      if (mensajesNoLeidos.length === 0) return

      const batch = mensajesNoLeidos.map(mensaje => {
        const mensajeRef = doc(firestoreDb, COLLECTIONS.MENSAJES, mensaje.id)
        return updateDoc(mensajeRef, {
          leidoPor: [...(mensaje.leidoPor || []), user.uid],
        })
      })

      await Promise.all(batch)

      // Actualizar contador de no leídos en la conversación
      const conversacionRef = doc(firestoreDb, COLLECTIONS.CONVERSACIONES, conversacionId)
      const conversacionDoc = await getDoc(conversacionRef)
      
      if (conversacionDoc.exists()) {
        const data = conversacionDoc.data() as ConversacionGrupo
        const noLeidos = { ...(data.noLeidos || {}) }
        const miGrupoId = userData.grupoIds?.[0] || user.uid
        delete noLeidos[miGrupoId]
        delete noLeidos[user.uid]
        
        await updateDoc(conversacionRef, {
          noLeidos,
          updatedAt: serverTimestamp(),
        })
      }
    } catch (error: any) {
      logger.error("Error al marcar como leídos:", error)
    }
  }, [user, userData])

  // Cargar conversaciones del usuario
  useEffect(() => {
    if (!db || !user || !userData) {
      setLoading(false)
      return
    }

    // Guardar db en constante local para que TypeScript entienda que no es undefined
    const firestoreDb = db

    const miGrupoId = userData.grupoIds?.[0] || user.uid
    
    // Crear queries para cada participante posible (grupoId y userId)
    const participantes = [miGrupoId, user.uid]
    
    // Firestore no permite OR queries fácilmente, así que haremos múltiples queries
    const conversacionesQueries = participantes.map(participanteId => 
      query(
        collection(firestoreDb, COLLECTIONS.CONVERSACIONES),
        where("participantes", "array-contains", participanteId),
        where("activa", "==", true)
      )
    )
    
    // Usar solo la primera query por ahora (la del grupo principal)
    const conversacionesQuery = query(
      collection(firestoreDb, COLLECTIONS.CONVERSACIONES),
      where("participantes", "array-contains", miGrupoId),
      where("activa", "==", true)
    )

    const unsubscribe = onSnapshot(
      conversacionesQuery,
      (snapshot) => {
        const conversacionesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ConversacionGrupo[]

        setConversaciones(conversacionesData)
        setLoading(false)
      },
      (error) => {
        console.error("Error al cargar conversaciones:", error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, userData])

  // Cargar mensajes de la conversación activa
  useEffect(() => {
    if (!db || !conversacionActiva) {
      setMensajes({})
      return
    }

    // Guardar db en constante local para que TypeScript entienda que no es undefined
    const firestoreDb = db

    let hasMarkedAsRead = false

    const mensajesQuery = query(
      collection(firestoreDb, COLLECTIONS.MENSAJES),
      where("conversacionId", "==", conversacionActiva),
      orderBy("createdAt", "asc"),
      limit(100)
    )

    const unsubscribe = onSnapshot(
      mensajesQuery,
      (snapshot) => {
        const mensajesData = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            timestamp: data.createdAt?.toDate() || new Date(),
          }
        }) as MensajeGrupo[]

        setMensajes(prev => ({
          ...prev,
          [conversacionActiva]: mensajesData,
        }))

        // Marcar como leídos solo una vez cuando se carga la conversación
        if (mensajesData.length > 0 && !hasMarkedAsRead) {
          hasMarkedAsRead = true
          // Usar setTimeout para evitar llamadas síncronas que causen bucles
          setTimeout(() => {
            marcarComoLeidos(conversacionActiva, mensajesData)
          }, 500)
        }
      },
      (error) => {
        console.error("Error al cargar mensajes:", error)
      }
    )

    return () => {
      unsubscribe()
      hasMarkedAsRead = false
    }
  }, [conversacionActiva, marcarComoLeidos])

  return {
    conversaciones,
    mensajes: mensajes[conversacionActiva || ""] || [],
    conversacionActiva,
    setConversacionActiva,
    enviarMensaje,
    obtenerOCrearConversacion,
    marcarComoLeidos,
    loading,
  }
}

