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

export function useGroupMessaging(user: any, conversacionIdExterno?: string | null) {
  const { toast } = useToast()
  const { groups } = useGroups(user)
  const { userData } = useData()
  
  const [conversaciones, setConversaciones] = useState<ConversacionGrupo[]>([])
  const [mensajes, setMensajes] = useState<Record<string, MensajeGrupo[]>>({})
  const [conversacionActiva, setConversacionActiva] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Sincronizar conversacionId externo con el estado interno
  useEffect(() => {
    if (conversacionIdExterno !== undefined) {
      setConversacionActiva(conversacionIdExterno)
    }
  }, [conversacionIdExterno])

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

  // Obtener o crear conversación directa con un usuario
  const obtenerOCrearConversacionDirecta = useCallback(async (
    usuarioDestinoId: string
  ): Promise<string | null> => {
    if (!db || !user || !userData) return null

    // Guardar db en constante local para que TypeScript entienda que no es undefined
    const firestoreDb = db

    try {
      // Buscar conversación existente (puede estar con userId o grupoId)
      const conversacionesQuery = query(
        collection(firestoreDb, COLLECTIONS.CONVERSACIONES),
        where("participantes", "array-contains", user.uid),
        where("tipo", "==", "directo"),
        where("activa", "==", true)
      )
      
      const snapshot = await getDocs(conversacionesQuery)
      const conversacionExistente = snapshot.docs.find(doc => {
        const data = doc.data() as ConversacionGrupo
        return data.participantes.includes(usuarioDestinoId) && data.participantes.length === 2
      })

      if (conversacionExistente) {
        return conversacionExistente.id
      }

      // Obtener datos del usuario destino para el nombre
      let nombreDestino = "Usuario"
      try {
        const usuarioDestinoDoc = await getDoc(doc(firestoreDb, COLLECTIONS.USERS, usuarioDestinoId))
        if (usuarioDestinoDoc.exists()) {
          const usuarioDestinoData = usuarioDestinoDoc.data()
          nombreDestino = usuarioDestinoData.displayName || usuarioDestinoData.email?.split("@")[0] || "Usuario"
        }
      } catch (error) {
        logger.error("Error al obtener datos del usuario destino:", error)
      }

      // Crear nueva conversación directa
      const nombresParticipantes = [
        userData.displayName || user.email?.split("@")[0] || "Usuario",
        nombreDestino
      ]

      const nuevaConversacion = await addDoc(collection(firestoreDb, COLLECTIONS.CONVERSACIONES), {
        tipo: "directo",
        participantes: [user.uid, usuarioDestinoId],
        nombresParticipantes,
        noLeidos: {},
        activa: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      return nuevaConversacion.id
    } catch (error: any) {
      logger.error("Error al obtener/crear conversación directa:", error)
      toast({
        title: "Error",
        description: "No se pudo crear la conversación",
        variant: "destructive",
      })
      return null
    }
  }, [user, userData, toast])

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
          // Para conversaciones directas, usar userId directamente
          // Para conversaciones de grupo, usar grupoId
          if (conversacionData.tipo === "directo") {
            // En conversaciones directas, los participantes son userIds
            if (participanteId !== user.uid) {
              noLeidos[participanteId] = (noLeidos[participanteId] || 0) + 1
            }
          } else {
            // En conversaciones de grupo, los participantes son grupoIds
            if (participanteId !== user.uid && participanteId !== userData?.grupoIds?.[0]) {
              noLeidos[participanteId] = (noLeidos[participanteId] || 0) + 1
            }
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
        
        // Limpiar contador según el tipo de conversación
        if (data.tipo === "directo") {
          // En conversaciones directas, solo limpiar el userId
          delete noLeidos[user.uid]
        } else {
          // En conversaciones de grupo, limpiar tanto grupoId como userId
          const miGrupoId = userData.grupoIds?.[0] || user.uid
          delete noLeidos[miGrupoId]
          delete noLeidos[user.uid]
        }
        
        await updateDoc(conversacionRef, {
          noLeidos,
          updatedAt: serverTimestamp(),
        })
      }
    } catch (error: any) {
      logger.error("Error al marcar como leídos:", error)
    }
  }, [user, userData])

  // Cargar conversaciones del usuario (grupos y directas)
  useEffect(() => {
    if (!db || !user || !userData) {
      setLoading(false)
      return
    }

    // Guardar db en constante local para que TypeScript entienda que no es undefined
    const firestoreDb = db

    const miGrupoId = userData.grupoIds?.[0] || user.uid
    
    // Cargar conversaciones de grupo (donde participa el grupo)
    const conversacionesGrupoQuery = query(
      collection(firestoreDb, COLLECTIONS.CONVERSACIONES),
      where("participantes", "array-contains", miGrupoId),
      where("activa", "==", true)
    )

    // Cargar conversaciones directas (donde participa el usuario)
    const conversacionesDirectasQuery = query(
      collection(firestoreDb, COLLECTIONS.CONVERSACIONES),
      where("participantes", "array-contains", user.uid),
      where("tipo", "==", "directo"),
      where("activa", "==", true)
    )

    let conversacionesGrupo: ConversacionGrupo[] = []
    let conversacionesDirectas: ConversacionGrupo[] = []

    const unsubscribeGrupo = onSnapshot(
      conversacionesGrupoQuery,
      (snapshot) => {
        conversacionesGrupo = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ConversacionGrupo[]

        // Combinar y actualizar
        const todas = [...conversacionesGrupo, ...conversacionesDirectas]
        // Eliminar duplicados
        const unicas = todas.filter((conv, index, self) =>
          index === self.findIndex(c => c.id === conv.id)
        )
        // Ordenar por último mensaje
        unicas.sort((a, b) => {
          const aTime = a.ultimoMensajeAt?.toDate?.()?.getTime() || a.ultimoMensajeAt?.getTime?.() || 0
          const bTime = b.ultimoMensajeAt?.toDate?.()?.getTime() || b.ultimoMensajeAt?.getTime?.() || 0
          return bTime - aTime
        })

        setConversaciones(unicas)
        setLoading(false)
      },
      (error) => {
        console.error("Error al cargar conversaciones de grupo:", error)
        setLoading(false)
      }
    )

    const unsubscribeDirectas = onSnapshot(
      conversacionesDirectasQuery,
      (snapshot) => {
        conversacionesDirectas = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ConversacionGrupo[]

        // Combinar y actualizar
        const todas = [...conversacionesGrupo, ...conversacionesDirectas]
        // Eliminar duplicados
        const unicas = todas.filter((conv, index, self) =>
          index === self.findIndex(c => c.id === conv.id)
        )
        // Ordenar por último mensaje
        unicas.sort((a, b) => {
          const aTime = a.ultimoMensajeAt?.toDate?.()?.getTime() || a.ultimoMensajeAt?.getTime?.() || 0
          const bTime = b.ultimoMensajeAt?.toDate?.()?.getTime() || b.ultimoMensajeAt?.getTime?.() || 0
          return bTime - aTime
        })

        setConversaciones(unicas)
        setLoading(false)
      },
      (error) => {
        console.error("Error al cargar conversaciones directas:", error)
        setLoading(false)
      }
    )

    return () => {
      unsubscribeGrupo()
      unsubscribeDirectas()
    }
  }, [user, userData])

  // Cargar mensajes de la conversación activa
  useEffect(() => {
    const conversacionIdParaCargar = conversacionIdExterno ?? conversacionActiva
    
    if (!db || !conversacionIdParaCargar) {
      setMensajes({})
      return
    }

    // Guardar db en constante local para que TypeScript entienda que no es undefined
    const firestoreDb = db

    let hasMarkedAsRead = false

    const mensajesQuery = query(
      collection(firestoreDb, COLLECTIONS.MENSAJES),
      where("conversacionId", "==", conversacionIdParaCargar),
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
          [conversacionIdParaCargar]: mensajesData,
        }))

        // Marcar como leídos solo una vez cuando se carga la conversación
        if (mensajesData.length > 0 && !hasMarkedAsRead) {
          hasMarkedAsRead = true
          // Usar setTimeout para evitar llamadas síncronas que causen bucles
          setTimeout(() => {
            marcarComoLeidos(conversacionIdParaCargar, mensajesData)
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
  }, [conversacionIdExterno, conversacionActiva, marcarComoLeidos])

  // Usar conversacionIdExterno si está disponible, sino usar conversacionActiva
  const conversacionIdParaMensajes = conversacionIdExterno ?? conversacionActiva

  return {
    conversaciones,
    mensajes: mensajes[conversacionIdParaMensajes || ""] || [],
    conversacionActiva: conversacionIdParaMensajes,
    setConversacionActiva,
    enviarMensaje,
    obtenerOCrearConversacion,
    obtenerOCrearConversacionDirecta,
    marcarComoLeidos,
    loading,
  }
}

