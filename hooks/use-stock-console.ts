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
  
  // Estado local aislado
  const [state, setState] = useState<StockConsoleState>({
    selectedPedidoId: null,
    tipo: "INGRESO",
    cantidades: {},
    loading: false,
    error: null,
  })
  
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [stockActual, setStockActual] = useState<Record<string, number>>({})

  // Helper para obtener el userId efectivo
  const getEffectiveUserId = useCallback((): string | null => {
    if (!user) return null
    return userData?.role === "invited" && userData?.ownerId 
      ? userData.ownerId 
      : user.uid
  }, [user, userData])

  // Cargar pedidos
  const loadPedidos = useCallback(async () => {
    if (!user || !db) return
    
    try {
      const userIdToQuery = getEffectiveUserId()
      if (!userIdToQuery) return
      
      const pedidosQuery = query(
        collection(db, "apps/horarios/pedidos"),
        where("userId", "==", userIdToQuery)
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
  }, [user, getEffectiveUserId, toast])

  // Cargar productos del pedido seleccionado
  const loadProductos = useCallback(async () => {
    if (!user || !db || !state.selectedPedidoId) {
      setProductos([])
      setStockActual({})
      return
    }
    
    try {
      const userIdToQuery = getEffectiveUserId()
      if (!userIdToQuery) return
      
      const productsQuery = query(
        collection(db, "apps/horarios/products"),
        where("userId", "==", userIdToQuery),
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
  }, [user, state.selectedPedidoId, getEffectiveUserId, toast])

  // Listener para stock en tiempo real
  useEffect(() => {
    if (!state.selectedPedidoId || !db || !user) return

    const userIdToQuery = getEffectiveUserId()
    if (!userIdToQuery) return

    const productsQuery = query(
      collection(db, "apps/horarios/products"),
      where("userId", "==", userIdToQuery),
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
  }, [state.selectedPedidoId, user, getEffectiveUserId])

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

  const setTipo = useCallback((tipo: MovimientoStockTipo) => {
    setState(prev => ({ ...prev, tipo }))
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

  const setCantidad = useCallback((productoId: string, cantidad: number) => {
    if (cantidad < 0) return
    
    setState(prev => ({
      ...prev,
      cantidades: {
        ...prev.cantidades,
        [productoId]: cantidad
      }
    }))
  }, [])

  const limpiarCantidades = useCallback(() => {
    setState(prev => ({ ...prev, cantidades: {} }))
  }, [])

  // Resumen de movimientos pendientes
  const movimientosPendientes = useMemo(() => {
    return Object.entries(state.cantidades)
      .filter(([_, cantidad]) => cantidad > 0)
      .map(([productoId, cantidad]) => {
        const producto = productos.find(p => p.id === productoId)
        if (!producto) return null
        
        const movimiento: MovimientoInput = {
          productoId,
          productoNombre: producto.nombre,
          cantidad,
          tipo: state.tipo,
          pedidoId: state.selectedPedidoId || undefined,
        }
        
        return movimiento
      })
      .filter(Boolean) as MovimientoInput[]
  }, [state.cantidades, state.tipo, state.selectedPedidoId, productos])

  const totalProductos = useMemo(() => {
    return movimientosPendientes.length
  }, [movimientosPendientes])

  const totalCantidad = useMemo(() => {
    return movimientosPendientes.reduce((sum, mov) => sum + mov.cantidad, 0)
  }, [movimientosPendientes])

  // Confirmar movimientos
  const confirmarMovimientos = useCallback(async (): Promise<boolean> => {
    if (movimientosPendientes.length === 0) {
      toast({
        title: "Error",
        description: "No hay movimientos para confirmar",
        variant: "destructive",
      })
      return false
    }

    const userIdToUse = getEffectiveUserId()
    if (!userIdToUse) {
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
        userIdToUse
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
  }, [movimientosPendientes, getEffectiveUserId, toast, totalProductos])

  return {
    // Estado
    state,
    pedidos,
    productos,
    stockActual,
    movimientosPendientes,
    totalProductos,
    totalCantidad,
    
    // Acciones
    setSelectedPedidoId,
    setTipo,
    incrementarCantidad,
    setCantidad,
    limpiarCantidades,
    confirmarMovimientos,
  }
}
