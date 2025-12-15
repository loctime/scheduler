"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore"
import { Configuracion } from "@/lib/types"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { Pedido, Group } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { useGroups } from "@/hooks/use-groups"

export function useFabricaPedidos(user: any) {
  const { toast } = useToast()
  const { userData } = useData()
  const { groups, loading: loadingGroups } = useGroups(user)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [usuariosMap, setUsuariosMap] = useState<Record<string, { displayName?: string; email?: string }>>({})
  const [sucursalesDelGrupo, setSucursalesDelGrupo] = useState<Array<{ userId: string; nombreEmpresa: string; displayName?: string; email?: string }>>([])
  
  // Sincronizar grupoIds del usuario si está en grupos pero no tiene grupoIds
  useEffect(() => {
    if (!db || !user || !userData || loadingGroups) return
    
    // Buscar grupos donde el usuario está en userIds pero no tiene grupoIds actualizado
    const gruposDondeEstaElUsuario = groups.filter(grupo => 
      grupo.userIds.includes(user.uid)
    )
    
    if (gruposDondeEstaElUsuario.length > 0) {
      const grupoIdsActuales = userData.grupoIds || []
      const grupoIdsDelGrupo = gruposDondeEstaElUsuario.map(g => g.id)
      const grupoIdsFaltantes = grupoIdsDelGrupo.filter(id => !grupoIdsActuales.includes(id))
      
      if (grupoIdsFaltantes.length > 0) {
        // Sincronizar: actualizar grupoIds del usuario
        logger.info("[FABRICA] Sincronizando grupoIds del usuario", { 
          grupoIdsActuales, 
          grupoIdsFaltantes,
          grupoIdsNuevos: [...grupoIdsActuales, ...grupoIdsFaltantes]
        })
        
        const userRef = doc(db, COLLECTIONS.USERS, user.uid)
        updateDoc(userRef, {
          grupoIds: [...grupoIdsActuales, ...grupoIdsFaltantes],
          updatedAt: serverTimestamp(),
        }).catch(error => {
          logger.error("[FABRICA] Error al sincronizar grupoIds:", error)
        })
      }
    }
  }, [db, user, userData, groups, loadingGroups])

  // Obtener los grupos del usuario factory y extraer userIds de sucursales del mismo grupo
  const userIdsDelGrupo = useMemo(() => {
    // Primero buscar grupos donde el usuario está (ya sea por grupoIds o por userIds en el grupo)
    const gruposDelUsuario = groups.filter(grupo => {
      // Si tiene grupoIds, usar eso
      if (userData?.grupoIds?.includes(grupo.id)) {
        return true
      }
      // Si no tiene grupoIds pero está en userIds del grupo, también incluirlo
      if (grupo.userIds.includes(user?.uid || "")) {
        return true
      }
      return false
    })
    
    if (gruposDelUsuario.length === 0) {
      logger.warn("[FABRICA] Usuario factory no está en ningún grupo", { 
        userData,
        gruposDisponibles: groups.map(g => ({ id: g.id, nombre: g.nombre, userIds: g.userIds }))
      })
      return []
    }
    
    logger.info("[FABRICA] Grupos del usuario factory:", { 
      grupoIds: userData?.grupoIds,
      gruposEncontrados: gruposDelUsuario.map(g => ({ id: g.id, nombre: g.nombre, userIds: g.userIds }))
    })
    
    // Extraer todos los userIds de esos grupos (sucursales del mismo grupo)
    const userIds = new Set<string>()
    gruposDelUsuario.forEach(grupo => {
      grupo.userIds.forEach(userId => {
        // No incluir al usuario factory mismo
        if (userId !== user?.uid) {
          userIds.add(userId)
        }
      })
    })
    
    logger.info("[FABRICA] UserIds de sucursales del mismo grupo:", Array.from(userIds))
    
    return Array.from(userIds)
  }, [groups, userData?.grupoIds, user?.uid])

  // Cargar información de usuarios para mostrar nombres de sucursales
  const cargarUsuarios = useCallback(async (userIds: string[]) => {
    if (!db || userIds.length === 0) return {}

    const usuarios: Record<string, { displayName?: string; email?: string }> = {}
    
    try {
      const promesas = userIds.map(async (userId) => {
        try {
          if (!db) return
          const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId))
          if (userDoc.exists()) {
            const data = userDoc.data()
            usuarios[userId] = {
              displayName: data.displayName || data.email?.split("@")[0] || "Usuario",
              email: data.email,
            }
          }
        } catch (error) {
          logger.warn(`Error al cargar usuario ${userId}:`, error)
        }
      })
      
      await Promise.all(promesas)
    } catch (error) {
      logger.error("Error al cargar usuarios:", error)
    }
    
    return usuarios
  }, [])

  // Cargar información de sucursales del grupo con sus nombres de empresa
  const cargarSucursalesDelGrupo = useCallback(async (userIds: string[]) => {
    if (!db || userIds.length === 0) {
      setSucursalesDelGrupo([])
      return
    }

    try {
      const promesas = userIds.map(async (userId) => {
        try {
          if (!db) return null
          
          // Cargar usuario
          const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId))
          if (!userDoc.exists()) return null
          
          const userData = userDoc.data()
          
          // Cargar configuración (nombreEmpresa)
          const configDoc = await getDoc(doc(db, COLLECTIONS.CONFIG, userId))
          const configData = configDoc.exists() ? configDoc.data() as Configuracion : null
          const nombreEmpresa = configData?.nombreEmpresa || userData.displayName || userData.email?.split("@")[0] || "Sin nombre"
          
          return {
            userId,
            nombreEmpresa,
            displayName: userData.displayName || userData.email?.split("@")[0] || "Usuario",
            email: userData.email,
          }
        } catch (error) {
          logger.warn(`Error al cargar sucursal ${userId}:`, error)
          return null
        }
      })
      
      const resultados = await Promise.all(promesas)
      const sucursales = resultados.filter((s): s is NonNullable<typeof s> => s !== null)
      setSucursalesDelGrupo(sucursales)
    } catch (error) {
      logger.error("Error al cargar sucursales del grupo:", error)
      setSucursalesDelGrupo([])
    }
  }, [])

  // Cargar todos los pedidos pendientes (sin filtrar por userId)
  const loadPedidos = useCallback(async () => {
    if (!db || !user) return

    try {
      setLoading(true)
      
      // Si el usuario es "invited" y tiene userIdsDelGrupo, filtrar por esos userIds
      // Si no, cargar todos los pedidos (para factory/manager)
      let pedidosQuery;
      if (userData?.role === "invited" && userIdsDelGrupo.length > 0) {
        // Firestore limita el operador "in" a 10 elementos, así que si hay más, cargamos todos
        if (userIdsDelGrupo.length <= 10) {
          pedidosQuery = query(
            collection(db, COLLECTIONS.PEDIDOS),
            where("estado", "in", ["creado", "processing"]),
            where("userId", "in", userIdsDelGrupo.slice(0, 10))
          )
        } else {
          // Si hay más de 10, cargamos todos y filtramos después
          pedidosQuery = query(
            collection(db, COLLECTIONS.PEDIDOS),
            where("estado", "in", ["creado", "processing"])
          )
        }
      } else {
        // Para factory/manager, cargar todos los pedidos
        pedidosQuery = query(
          collection(db, COLLECTIONS.PEDIDOS),
          where("estado", "in", ["creado", "processing"])
        )
      }
      
      const snapshot = await getDocs(pedidosQuery)
      const pedidosData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Pedido[]

      // Cargar enlaces públicos activos para filtrar pedidos que tienen enlace generado
      const enlacesActivosQuery = query(
        collection(db, COLLECTIONS.ENLACES_PUBLICOS),
        where("activo", "==", true)
      )
      const enlacesActivosSnapshot = await getDocs(enlacesActivosQuery)
      // Extraer solo los pedidoIds válidos (filtrar undefined/null)
      const enlacesActivosIds = new Set(
        enlacesActivosSnapshot.docs
          .map(doc => {
            const data = doc.data()
            return data.pedidoId
          })
          .filter((pedidoId): pedidoId is string => !!pedidoId)
      )
      
      // Log para debug
      logger.info("[FABRICA] Enlaces activos raw:", {
        total: enlacesActivosSnapshot.docs.length,
        enlaces: enlacesActivosSnapshot.docs.map(doc => ({
          enlaceId: doc.id,
          pedidoId: doc.data().pedidoId,
          activo: doc.data().activo
        }))
      })
      
      // Filtrar pedidos por grupo Y que tengan enlace público activo
      let pedidosFiltrados = pedidosData
      logger.info("[FABRICA] Pedidos antes de filtrar:", { 
        total: pedidosData.length,
        pedidos: pedidosData.map(p => ({ id: p.id, nombre: p.nombre, userId: p.userId, estado: p.estado, enlacePublicoId: p.enlacePublicoId })),
        userIdsDelGrupo,
        enlacesActivosCount: enlacesActivosIds.size
      })
      
      if (userIdsDelGrupo.length > 0) {
      // Log detallado para debug
      const pedidosIds = pedidosData.map(p => p.id)
      const enlacesActivosArray = Array.from(enlacesActivosIds)
      const coincidencias = pedidosIds.filter(id => enlacesActivosArray.includes(id))
      const pedidosSinEnlace = pedidosIds.filter(id => !enlacesActivosArray.includes(id))
      const enlacesSinPedido = enlacesActivosArray.filter(id => !pedidosIds.includes(id))
      
      logger.info("[FABRICA] Debug filtrado - IDs de pedidos:", pedidosIds)
      logger.info("[FABRICA] Debug filtrado - IDs de enlaces activos:", enlacesActivosArray)
      logger.info("[FABRICA] Debug filtrado - Coincidencias:", coincidencias)
      logger.info("[FABRICA] Debug filtrado - Pedidos sin enlace:", pedidosSinEnlace)
      logger.info("[FABRICA] Debug filtrado - Enlaces sin pedido:", enlacesSinPedido)
      
      logger.info("[FABRICA] Debug filtrado:", {
        totalPedidos: pedidosData.length,
        totalEnlacesActivos: enlacesActivosIds.size,
        coincidencias: coincidencias.length,
        pedidosSinEnlace: pedidosSinEnlace.length,
        enlacesSinPedido: enlacesSinPedido.length,
        userIdsDelGrupo
      })
        
        pedidosFiltrados = pedidosData.filter(pedido => {
          const enGrupo = pedido.userId && userIdsDelGrupo.includes(pedido.userId)
          const tieneEnlaceActivo = enlacesActivosIds.has(pedido.id)
          const coincide = enGrupo && tieneEnlaceActivo
          
          if (!coincide && pedido.userId && enGrupo) {
            logger.info("[FABRICA] Pedido excluido del filtro:", {
              pedidoId: pedido.id,
              pedidoNombre: pedido.nombre,
              pedidoUserId: pedido.userId,
              pedidoEstado: pedido.estado,
              enGrupo,
              tieneEnlaceActivo,
              enlacePublicoId: pedido.enlacePublicoId,
              estaEnEnlacesActivos: enlacesActivosIds.has(pedido.id),
              todosEnlacesActivos: Array.from(enlacesActivosIds)
            })
          }
          return coincide
        })
        logger.info("[FABRICA] Pedidos después de filtrar por grupo y enlace activo:", { 
          total: pedidosFiltrados.length,
          pedidos: pedidosFiltrados.map(p => ({ id: p.id, nombre: p.nombre, userId: p.userId }))
        })
      } else if (userData?.role === "factory") {
        // Si el usuario factory no tiene grupos asignados, no mostrar ningún pedido
        logger.warn("[FABRICA] Usuario factory sin grupos asignados, no se mostrarán pedidos")
        pedidosFiltrados = []
      }

      // Ordenar por fecha de creación (más recientes primero)
      pedidosFiltrados.sort((a, b) => {
        const fechaA = a.createdAt?.toDate?.() || new Date(0)
        const fechaB = b.createdAt?.toDate?.() || new Date(0)
        return fechaB.getTime() - fechaA.getTime()
      })

      setPedidos(pedidosFiltrados)

      // Cargar información de usuarios únicos (solo de los pedidos filtrados)
      const userIdsUnicos = [...new Set(pedidosFiltrados.map(p => p.userId).filter(Boolean))]
      if (userIdsUnicos.length > 0) {
        const usuarios = await cargarUsuarios(userIdsUnicos)
        setUsuariosMap(usuarios)
      }
    } catch (error: any) {
      logger.error("Error al cargar pedidos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los pedidos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast, cargarUsuarios, userIdsDelGrupo, userData?.role])

  // Cargar pedidos al montar y configurar listeners
  useEffect(() => {
    if (!db || !user || loadingGroups) return

    loadPedidos()

    // Función para aplicar filtros a los pedidos
    const aplicarFiltros = async (pedidosData: Pedido[]) => {
      if (!db) return pedidosData
      
      // Obtener IDs de pedidos válidos (en estado creado o processing)
      const pedidosIdsValidos = new Set(pedidosData.map(p => p.id))
      
      // Cargar enlaces públicos activos para filtrar pedidos que tienen enlace generado
      // Solo incluir enlaces cuyo pedidoId corresponde a un pedido válido
      const enlacesActivosQuery = query(
        collection(db, COLLECTIONS.ENLACES_PUBLICOS),
        where("activo", "==", true)
      )
      const enlacesActivosSnapshot = await getDocs(enlacesActivosQuery)
      // Extraer solo los pedidoIds válidos que corresponden a pedidos en estado creado/processing
      const enlacesActivosIds = new Set(
        enlacesActivosSnapshot.docs
          .map(doc => {
            const data = doc.data()
            return data.pedidoId
          })
          .filter((pedidoId): pedidoId is string => !!pedidoId && pedidosIdsValidos.has(pedidoId))
      )
      
      // Log para debug
      logger.info("[FABRICA] Enlaces activos raw:", {
        total: enlacesActivosSnapshot.docs.length,
        enlaces: enlacesActivosSnapshot.docs.map(doc => ({
          enlaceId: doc.id,
          pedidoId: doc.data().pedidoId,
          activo: doc.data().activo
        }))
      })
      
      // Filtrar pedidos por grupo Y que tengan enlace público activo
      let pedidosFiltrados = pedidosData
      
      // Log detallado para debug
      const pedidosIds = pedidosData.map(p => p.id)
      const enlacesActivosArray = Array.from(enlacesActivosIds)
      const coincidencias = pedidosIds.filter(id => enlacesActivosArray.includes(id))
      const pedidosSinEnlace = pedidosIds.filter(id => !enlacesActivosArray.includes(id))
      const enlacesSinPedido = enlacesActivosArray.filter(id => !pedidosIds.includes(id))
      
      logger.info("[FABRICA] Debug filtrado (listener) - IDs de pedidos:", pedidosIds)
      logger.info("[FABRICA] Debug filtrado (listener) - IDs de enlaces activos:", enlacesActivosArray)
      logger.info("[FABRICA] Debug filtrado (listener) - Coincidencias:", coincidencias)
      logger.info("[FABRICA] Debug filtrado (listener) - Pedidos sin enlace:", pedidosSinEnlace)
      logger.info("[FABRICA] Debug filtrado (listener) - Enlaces sin pedido:", enlacesSinPedido)
      
      logger.info("[FABRICA] Debug filtrado (listener):", {
        totalPedidos: pedidosData.length,
        totalEnlacesActivos: enlacesActivosIds.size,
        coincidencias: coincidencias.length,
        pedidosSinEnlace: pedidosSinEnlace.length,
        enlacesSinPedido: enlacesSinPedido.length,
        userIdsDelGrupo
      })
      
      if (userIdsDelGrupo.length > 0) {
        pedidosFiltrados = pedidosData.filter(pedido => {
          const enGrupo = pedido.userId && userIdsDelGrupo.includes(pedido.userId)
          const tieneEnlaceActivo = enlacesActivosIds.has(pedido.id)
          const coincide = enGrupo && tieneEnlaceActivo
          
          // Log detallado para cada pedido
          logger.info("[FABRICA] Evaluando pedido:", {
            pedidoId: pedido.id,
            pedidoNombre: pedido.nombre,
            pedidoUserId: pedido.userId,
            pedidoEstado: pedido.estado,
            enGrupo,
            tieneEnlaceActivo,
            coincide,
            userIdsDelGrupo
          })
          
          if (!coincide && pedido.userId && enGrupo) {
            logger.info("[FABRICA] Pedido excluido del filtro (listener):", {
              pedidoId: pedido.id,
              pedidoNombre: pedido.nombre,
              pedidoUserId: pedido.userId,
              pedidoEstado: pedido.estado,
              enGrupo,
              tieneEnlaceActivo,
              enlacePublicoId: pedido.enlacePublicoId,
              estaEnEnlacesActivos: enlacesActivosIds.has(pedido.id)
            })
          }
          return coincide
        })
      } else if (userData?.role === "factory") {
        // Si el usuario factory no tiene grupos asignados, no mostrar ningún pedido
        pedidosFiltrados = []
      }

      pedidosFiltrados.sort((a, b) => {
        const fechaA = a.createdAt?.toDate?.() || new Date(0)
        const fechaB = b.createdAt?.toDate?.() || new Date(0)
        return fechaB.getTime() - fechaA.getTime()
      })

      setPedidos(pedidosFiltrados)

      // Actualizar usuarios si hay nuevos (solo de los pedidos filtrados)
      const userIdsUnicos = [...new Set(pedidosFiltrados.map(p => p.userId).filter(Boolean))]
      if (userIdsUnicos.length > 0) {
        const usuarios = await cargarUsuarios(userIdsUnicos)
        setUsuariosMap(prev => ({ ...prev, ...usuarios }))
      }
    }

    // Configurar listener en tiempo real para pedidos
    // Si el usuario es "invited" y tiene userIdsDelGrupo, filtrar por esos userIds
    let pedidosQuery;
    if (userData?.role === "invited" && userIdsDelGrupo.length > 0 && userIdsDelGrupo.length <= 10) {
      pedidosQuery = query(
        collection(db, COLLECTIONS.PEDIDOS),
        where("estado", "in", ["creado", "processing"]),
        where("userId", "in", userIdsDelGrupo.slice(0, 10))
      )
    } else {
      pedidosQuery = query(
        collection(db, COLLECTIONS.PEDIDOS),
        where("estado", "in", ["creado", "processing"])
      )
    }

    const unsubscribePedidos = onSnapshot(
      pedidosQuery,
      async (snapshot) => {
        const pedidosData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Pedido[]
        await aplicarFiltros(pedidosData)
      },
      (error) => {
        logger.error("Error en listener de pedidos:", error)
      }
    )

    // Configurar listener en tiempo real para enlaces activos
    const enlacesActivosQuery = query(
      collection(db, COLLECTIONS.ENLACES_PUBLICOS),
      where("activo", "==", true)
    )

    const unsubscribeEnlaces = onSnapshot(
      enlacesActivosQuery,
      async (snapshot) => {
        logger.info("[FABRICA] Listener de enlaces activos detectó cambio:", {
          totalEnlaces: snapshot.docs.length,
          enlaces: snapshot.docs.map(doc => ({
            enlaceId: doc.id,
            pedidoId: doc.data().pedidoId,
            activo: doc.data().activo
          }))
        })
        // Cuando cambian los enlaces, recargar pedidos y aplicar filtros
        const pedidosSnapshot = await getDocs(pedidosQuery)
        const pedidosData = pedidosSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Pedido[]
        logger.info("[FABRICA] Recargando pedidos después de cambio en enlaces:", {
          totalPedidos: pedidosData.length,
          pedidosIds: pedidosData.map(p => p.id)
        })
        await aplicarFiltros(pedidosData)
      },
      (error) => {
        logger.error("Error en listener de enlaces:", error)
      }
    )

    // Cleanup
    return () => {
      unsubscribePedidos()
      unsubscribeEnlaces()
    }
  }, [user, loadPedidos, cargarUsuarios, userIdsDelGrupo, userData?.role, loadingGroups])

  // Cargar sucursales del grupo cuando cambien los userIds
  useEffect(() => {
    if (userIdsDelGrupo.length > 0) {
      cargarSucursalesDelGrupo(userIdsDelGrupo)
    } else {
      setSucursalesDelGrupo([])
    }
  }, [userIdsDelGrupo, cargarSucursalesDelGrupo])

  // Marcar pedido como "processing" y asignar a usuario actual
  const aceptarPedido = useCallback(async (pedidoId: string): Promise<boolean> => {
    if (!db || !user) return false

    try {
      const pedidoRef = doc(db, COLLECTIONS.PEDIDOS, pedidoId)
      const pedidoDoc = await getDoc(pedidoRef)
      
      if (!pedidoDoc.exists()) {
        toast({
          title: "Error",
          description: "El pedido no existe",
          variant: "destructive",
        })
        return false
      }

      const pedidoData = pedidoDoc.data() as Pedido

      // Verificar que el pedido no esté ya asignado a otro usuario
      if (pedidoData.estado === "processing" && pedidoData.assignedTo && pedidoData.assignedTo !== user.uid) {
        toast({
          title: "Pedido ya asignado",
          description: `Este pedido ya fue tomado por: ${pedidoData.assignedToNombre || "otro usuario"}`,
          variant: "destructive",
        })
        return false
      }

      // Obtener nombre del usuario actual
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid))
      const userName = userDoc.exists() 
        ? (userDoc.data().displayName || user.displayName || user.email?.split("@")[0] || "Usuario")
        : (user.displayName || user.email?.split("@")[0] || "Usuario")

      // Actualizar pedido
      await updateDoc(pedidoRef, {
        estado: "processing",
        assignedTo: user.uid,
        assignedToNombre: userName,
        updatedAt: serverTimestamp(),
      })

      toast({
        title: "Pedido aceptado",
        description: "El pedido ha sido marcado como en proceso",
      })

      return true
    } catch (error: any) {
      logger.error("Error al aceptar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo aceptar el pedido",
        variant: "destructive",
      })
      return false
    }
  }, [user, toast])

  // Obtener información del usuario asignado
  const obtenerUsuarioAsignado = useCallback((pedido: Pedido) => {
    if (!pedido.assignedTo) return null
    return usuariosMap[pedido.assignedTo] || null
  }, [usuariosMap])

  return {
    pedidos,
    loading,
    aceptarPedido,
    obtenerUsuarioAsignado,
    usuariosMap,
    refreshPedidos: loadPedidos,
    userIdsDelGrupo, // Exponer para debugging
    tieneGrupos: (userData?.grupoIds?.length || 0) > 0, // Exponer para mostrar mensaje
    sucursalesDelGrupo, // Lista de sucursales del grupo con nombres de empresa
  }
}

