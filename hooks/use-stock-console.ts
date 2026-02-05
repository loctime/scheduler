"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { confirmarMovimientos } from "@/src/services/stock/movimientosService"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import type { 
  StockConsoleState,
  MovimientoInput,
  MovimientoStockTipo,
  ConfirmarMovimientoResult 
} from "@/src/domain/stock/types"
import type { Pedido, Producto } from "@/lib/types"

// Renombrar la función para evitar conflicto
const confirmarMovimientosService = confirmarMovimientos

export function useStockConsole(user: any) {
  const { toast } = useToast()
  const { userData } = useData()
  
  // Validar permisos: si no tiene "pedidos", no permitir acceso
  const tienePermisoPedidos = userData?.permisos?.paginas?.includes("pedidos")
  
  // Estado local aislado
  const [state, setState] = useState<StockConsoleState>({
    selectedPedidoId: null,
    cantidades: {},
    loading: false,
    error: null,
  })
  
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [stockActual, setStockActual] = useState<Record<string, number>>({})

  const ownerId = useMemo(
    () => getOwnerIdForActor(user, userData),
    [user, userData]
  )

  // Cargar pedidos
  const loadPedidos = useCallback(async () => {
    if (!user || !db) return
    
    // Validar permisos antes de cargar datos
    if (!tienePermisoPedidos) {
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a Stock Console",
        variant: "destructive",
      })
      return
    }
    
    try {
      if (!ownerId) return
      
      const pedidosQuery = query(
        collection(db, "apps/horarios/pedidos"),
        where("ownerId", "==", ownerId)
      )
      const snapshot = await getDocs(pedidosQuery)
      const pedidosData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Pedido[]
      
      pedidosData.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setPedidos(pedidosData)
    } catch (error: any) {
      console.error("Error al cargar pedidos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los pedidos",
        variant: "destructive",
      })
    }
  }, [user, ownerId, toast, tienePermisoPedidos])

  // Cargar productos del pedido seleccionado
  const loadProductos = useCallback(async () => {
    if (!user || !db || !state.selectedPedidoId) {
      setProductos([])
      setStockActual({})
      return
    }
    
    // Validar permisos antes de cargar datos
    if (!tienePermisoPedidos) {
      return
    }
    
    try {
      if (!ownerId) return
      
      const productsQuery = query(
        collection(db, "apps/horarios/products"),
        where("ownerId", "==", ownerId),
        where("pedidoId", "==", state.selectedPedidoId)
      )
      const snapshot = await getDocs(productsQuery)
      const productosData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Producto[]
      
      productosData.sort((a, b) => {
        const ordenA = a.orden ?? 0
        const ordenB = b.orden ?? 0
        if (ordenA !== ordenB) {
          return ordenA - ordenB
        }
        return a.nombre.localeCompare(b.nombre)
      })
      
      setProductos(productosData)
      
      // Cargar stock actual
      const stockMap: Record<string, number> = {}
      productosData.forEach(producto => {
        stockMap[producto.id] = (producto as any).stockActual || 0
      })
      setStockActual(stockMap)
      
      // Resetear cantidades al cambiar de pedido
      setState(prev => ({ ...prev, cantidades: {} }))
    } catch (error: any) {
      console.error("Error al cargar productos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      })
    }
  }, [user, state.selectedPedidoId, ownerId, toast, tienePermisoPedidos])

  // Listener para stock en tiempo real
  useEffect(() => {
    if (!state.selectedPedidoId || !db || !user) return

    if (!ownerId) return
    
    // Validar permisos antes de configurar listener
    if (!tienePermisoPedidos) {
      return
    }

    const productsQuery = query(
      collection(db, "apps/horarios/products"),
      where("ownerId", "==", ownerId),
      where("pedidoId", "==", state.selectedPedidoId)
    )

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const stockMap: Record<string, number> = {}
        snapshot.forEach((doc) => {
          const data = doc.data()
          stockMap[doc.id] = data.stockActual || 0
        })
        setStockActual(stockMap)
      },
      (error) => {
        console.error("Error en listener de stock:", error)
      }
    )

    return () => unsubscribe()
  }, [state.selectedPedidoId, user, ownerId, tienePermisoPedidos])

  // Inicialización
  useEffect(() => {
    loadPedidos()
  }, [user])

  useEffect(() => {
    loadProductos()
  }, [state.selectedPedidoId])

  // Acciones
  const setSelectedPedidoId = useCallback((pedidoId: string | null) => {
    setState(prev => ({ ...prev, selectedPedidoId: pedidoId }))
  }, [])

  const incrementarCantidad = useCallback((productoId: string) => {
    setState(prev => ({
      ...prev,
      cantidades: {
        ...prev.cantidades,
        [productoId]: (prev.cantidades[productoId] || 0) + 1
      }
    }))
  }, [])

  const decrementarCantidad = useCallback((productoId: string) => {
    setState(prev => {
      const cantidadActual = prev.cantidades[productoId] || 0
      const stockDisponible = stockActual[productoId] || 0
      const cantidadMinimaPermitida = -stockDisponible
      
      // No permitir ir más abajo del stock disponible
      const nuevaCantidad = cantidadActual - 1
      if (nuevaCantidad < cantidadMinimaPermitida) {
        return prev // No hacer nada si viola la regla
      }
      
      return {
        ...prev,
        cantidades: {
          ...prev.cantidades,
          [productoId]: nuevaCantidad
        }
      }
    })
  }, [stockActual])

  const setCantidad = useCallback((productoId: string, cantidad: number) => {
    setState(prev => {
      const stockDisponible = stockActual[productoId] || 0
      const cantidadMinimaPermitida = -stockDisponible
      
      // Clamp al mínimo permitido para egresos
      const cantidadFinal = cantidad < cantidadMinimaPermitida ? cantidadMinimaPermitida : cantidad
      
      return {
        ...prev,
        cantidades: {
          ...prev.cantidades,
          [productoId]: cantidadFinal
        }
      }
    })
  }, [stockActual])

  const limpiarCantidades = useCallback(() => {
    setState(prev => ({ ...prev, cantidades: {} }))
  }, [])

  // Resumen de movimientos pendientes
  const movimientosPendientes = useMemo(() => {
    return Object.entries(state.cantidades)
      .filter(([_, cantidad]) => cantidad !== 0) // Incluir positivos y negativos
      .map(([productoId, cantidad]) => {
        const producto = productos.find(p => p.id === productoId)
        if (!producto) return null
        
        // Determinar tipo según signo de cantidad
        const tipo: MovimientoStockTipo = cantidad > 0 ? "INGRESO" : "EGRESO"
        
        const movimiento: MovimientoInput = {
          productoId,
          productoNombre: producto.nombre,
          cantidad: Math.abs(cantidad), // Usar valor absoluto para persistencia
          tipo,
          pedidoId: state.selectedPedidoId || undefined,
        }
        
        return movimiento
      })
      .filter(Boolean) as MovimientoInput[]
  }, [state.cantidades, state.selectedPedidoId, productos])

  const totalProductos = useMemo(() => {
    return movimientosPendientes.length
  }, [movimientosPendientes])

  const totalCantidad = useMemo(() => {
    // Suma directa de las cantidades con signo
    return Object.values(state.cantidades).reduce((sum, cantidad) => sum + cantidad, 0)
  }, [state.cantidades])

  // Totales separados para el footer
  const totalIngresos = useMemo(() => {
    return Object.values(state.cantidades)
      .filter(cantidad => cantidad > 0)
      .reduce((sum, cantidad) => sum + cantidad, 0)
  }, [state.cantidades])

  const totalEgresos = useMemo(() => {
    return Math.abs(Object.values(state.cantidades)
      .filter(cantidad => cantidad < 0)
      .reduce((sum, cantidad) => sum + cantidad, 0))
  }, [state.cantidades])

  // Confirmar movimientos
  const confirmarMovimientos = useCallback(async (): Promise<boolean> => {
    // Validar permisos antes de ejecutar cualquier operación
    if (!tienePermisoPedidos) {
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para ejecutar movimientos de stock",
        variant: "destructive",
      })
      return false
    }
    
    if (movimientosPendientes.length === 0) {
      toast({
        title: "Error",
        description: "No hay movimientos para confirmar",
        variant: "destructive",
      })
      return false
    }

    if (!ownerId || !user?.uid) {
      toast({
        title: "Error",
        description: "Usuario no válido",
        variant: "destructive",
      })
      return false
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await confirmarMovimientosService(
        movimientosPendientes,
        ownerId,
        user.uid
      )

      if (!result.ok) {
        setState(prev => ({ ...prev, error: result.error, loading: false }))
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
        return false
      }

      // Éxito
      setState(prev => ({ 
        ...prev, 
        cantidades: {}, 
        loading: false, 
        error: null 
      }))

      toast({
        title: "Movimientos confirmados",
        description: `${totalProductos} productos actualizados correctamente`,
      })

      return true
    } catch (error: any) {
      const errorMessage = error.message || "Error al confirmar movimientos"
      setState(prev => ({ ...prev, error: errorMessage, loading: false }))
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      
      return false
    }
  }, [movimientosPendientes, ownerId, user, toast, totalProductos, tienePermisoPedidos])

  return {
    // Estado
    state,
    pedidos,
    productos,
    stockActual,
    movimientosPendientes,
    totalProductos,
    totalCantidad,
    totalIngresos,
    totalEgresos,
    
    // Acciones
    setSelectedPedidoId,
    incrementarCantidad,
    decrementarCantidad,
    setCantidad,
    limpiarCantidades,
    confirmarMovimientos,
  }
}
