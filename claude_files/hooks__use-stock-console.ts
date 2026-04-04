"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { canUser } from "@/lib/permissions"
import { useData } from "@/contexts/data-context"
import { confirmarMovimientos } from "@/src/services/stock/movimientosService"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { logStockAction } from "@/lib/services/stockLogService"
import type { 
  StockConsoleState,
  MovimientoInput,
  MovimientoStockTipo,
  ConfirmarMovimientoResult 
} from "@/src/domain/stock/types"
import type { Pedido, Producto } from "@/lib/types"
import { getPedidoUsage, recordPedidoUsage } from "@/lib/stock-console-pedido-uso"
import { getCache, setCache } from "@/lib/cache/indexeddb-cache"
import { compareArraysByIds, compareRecords } from "@/lib/cache/cache-utils"
import { getStockMinimoUnits } from "@/lib/unidades-utils"
import { setStockUbicacion, stockUbicacionDocId } from "@/lib/stock-ubicaciones-service"

// Renombrar la función para evitar conflicto
const confirmarMovimientosService = confirmarMovimientos

function normalizeProducto(producto: Producto): Producto {
  const stockMinimoUnits = getStockMinimoUnits(producto)
  const stockActualUnits = Math.max(0, Math.floor(producto.stockActualUnits ?? (producto as any).stockActual ?? 0))

  return {
    ...producto,
    stockMinimo: stockMinimoUnits,
    stockMinimoUnits,
    stockActualUnits,
    unidadBase: producto.unidadBase || producto.unidad || "U",
    unidad: producto.unidad || producto.unidadBase || "U",
    modoCompra: producto.modoCompra || "unidad",
  }
}

function catalogoYStockToProducto(
  catalogoId: string,
  cat: Record<string, unknown>,
  ownerId: string,
  uid: string,
  stockRow?: Record<string, unknown>
): Producto {
  const catMin = typeof cat.stockMinimo === "number" ? cat.stockMinimo : 0
  const stAct = stockRow ? Math.max(0, Math.floor(Number(stockRow.stockActual) || 0)) : 0
  const stMin =
    stockRow && typeof stockRow.stockMinimo === "number" ? stockRow.stockMinimo : catMin
  const orden =
    typeof cat.orden === "number"
      ? cat.orden
      : stockRow && typeof stockRow.orden === "number"
        ? stockRow.orden
        : 0
  return normalizeProducto({
    id: catalogoId,
    pedidoId: String(cat.pedidoId ?? ""),
    nombre: String(cat.nombre ?? ""),
    ownerId,
    userId: String(cat.createdBy ?? uid),
    stockMinimoUnits: stMin,
    stockActualUnits: stAct,
    unidad: String(cat.unidad ?? "U"),
    unidadBase: String(cat.unidad ?? "U"),
    orden,
    modoCompra: "unidad",
  } as Producto)
}

export function useStockConsole(user: any) {
  const { toast } = useToast()
  const { userData } = useData()
  
  // Validar permisos: si no tiene acceso a editar stock
  const puedeEditarStock = canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "editar_stock")
  
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
  const [pedidosLoading, setPedidosLoading] = useState(true)
  const [productosLoading, setProductosLoading] = useState(false)
  const mountedRef = useRef(true)

  const ownerId = useMemo(
    () => getOwnerIdForActor(user, userData),
    [user, userData]
  )

  const locationIdForStock = useMemo(
    () => userData?.locationId ?? user?.uid ?? "",
    [userData?.locationId, user?.uid]
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Cargar pedidos con cache
  const loadPedidos = useCallback(async () => {
    if (!user || !db) return
    
    // Validar permisos antes de cargar datos
    if (!puedeEditarStock) {
      if (mountedRef.current) {
        setPedidosLoading(false)
      }
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a Stock Console",
        variant: "destructive",
      })
      return
    }
    
    try {
      if (!ownerId) {
        if (mountedRef.current) {
          setPedidosLoading(false)
        }
        return
      }
      
      const cacheKey = `pedidos-${ownerId}`
      
      // 1. Cargar desde cache primero (stale-while-revalidate)
      const cachedPedidos = await getCache<Pedido[]>(cacheKey)
      if (cachedPedidos && cachedPedidos.length > 0 && mountedRef.current) {
        // Ordenar por uso del usuario antes de setear
        const usage = getPedidoUsage(ownerId)
        const sortedCached = [...cachedPedidos].sort((a, b) => {
          const ua = usage[a.id]
          const ub = usage[b.id]
          if (ua && ub) {
            if (ua.count !== ub.count) return ub.count - ua.count
            if (ua.lastUsed !== ub.lastUsed) return ub.lastUsed - ua.lastUsed
          }
          if (ua && !ub) return -1
          if (!ua && ub) return 1
          return a.nombre.localeCompare(b.nombre)
        })
        setPedidos(sortedCached)
        setPedidosLoading(false) // Marcar como cargado si hay cache
        // Continuar con fetch en background
      } else if (mountedRef.current) {
        setPedidosLoading(true)
      }
      
      // 2. Cargar desde Firestore en background
      const pedidosQuery = query(
        collection(db, "apps/horarios/pedidos"),
        where("ownerId", "==", ownerId)
      )
      const snapshot = await getDocs(pedidosQuery)
      const pedidosData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Pedido[]
      
      // Ordenar por uso del usuario: más utilizado primero, luego alfabético
      const usage = getPedidoUsage(ownerId)
      pedidosData.sort((a, b) => {
        const ua = usage[a.id]
        const ub = usage[b.id]
        if (ua && ub) {
          if (ua.count !== ub.count) return ub.count - ua.count
          if (ua.lastUsed !== ub.lastUsed) return ub.lastUsed - ua.lastUsed
        }
        if (ua && !ub) return -1
        if (!ua && ub) return 1
        return a.nombre.localeCompare(b.nombre)
      })
      
      if (!mountedRef.current) return
      
      // Solo actualizar si hay cambios
      setPedidos((prev) => {
        if (compareArraysByIds(prev, pedidosData)) {
          return prev
        }
        return pedidosData
      })
      
      setPedidosLoading(false)
      
      // 3. Actualizar cache en background
      setCache(cacheKey, pedidosData).catch(() => {
        // Ignorar errores de cache
      })
    } catch (error: any) {
      console.error("Error al cargar pedidos:", error)
      if (mountedRef.current) {
        setPedidosLoading(false)
        toast({
          title: "Error",
          description: "No se pudieron cargar los pedidos",
          variant: "destructive",
        })
      }
    }
  }, [user, ownerId, toast, puedeEditarStock])

  // Cargar productos del pedido seleccionado con cache
  const loadProductos = useCallback(async () => {
    if (!user || !db || !state.selectedPedidoId) {
      if (mountedRef.current) {
        setProductos([])
        setStockActual({})
        setProductosLoading(false)
      }
      return
    }
    
    // Validar permisos antes de cargar datos
    if (!puedeEditarStock) {
      if (mountedRef.current) {
        setProductosLoading(false)
      }
      return
    }
    
    try {
      if (!ownerId) {
        if (mountedRef.current) {
          setProductosLoading(false)
        }
        return
      }
      if (!locationIdForStock) {
        if (mountedRef.current) {
          setProductos([])
          setStockActual({})
          setProductosLoading(false)
        }
        return
      }

      const cacheKey = `productos-${ownerId}-${state.selectedPedidoId}-${locationIdForStock}`

      const cachedData = await getCache<{ productos: Producto[]; stockActual: Record<string, number> }>(cacheKey)
      if (cachedData && cachedData.productos && cachedData.productos.length > 0 && mountedRef.current) {
        setProductos(cachedData.productos)
        setStockActual(cachedData.stockActual)
        setProductosLoading(false)
      } else if (mountedRef.current) {
        setProductosLoading(true)
      }

      const catalogQuery = query(
        collection(db, COLLECTIONS.CATALOGO),
        where("ownerId", "==", ownerId),
        where("pedidoId", "==", state.selectedPedidoId)
      )
      const catalogSnap = await getDocs(catalogQuery)

      const stockQuery = query(
        collection(db, COLLECTIONS.STOCK_UBICACIONES),
        where("ownerId", "==", ownerId),
        where("locationId", "==", locationIdForStock)
      )
      const stockSnap = await getDocs(stockQuery)

      const stockByCatalogo = new Map<string, Record<string, unknown>>()
      stockSnap.forEach((d) => {
        const x = d.data() as Record<string, unknown>
        const cid = String(x.catalogoId ?? "")
        if (cid) stockByCatalogo.set(cid, x)
      })

      const productosData: Producto[] = []
      catalogSnap.forEach((d) => {
        const cat = d.data() as Record<string, unknown>
        if (cat.activo === false) return
        productosData.push(
          catalogoYStockToProducto(d.id, cat, ownerId, user.uid, stockByCatalogo.get(d.id))
        )
      })

      productosData.sort((a, b) => {
        const ordenA = a.orden ?? 0
        const ordenB = b.orden ?? 0
        if (ordenA !== ordenB) {
          return ordenA - ordenB
        }
        return a.nombre.localeCompare(b.nombre)
      })

      const stockMap: Record<string, number> = {}
      productosData.forEach((producto) => {
        stockMap[producto.id] = producto.stockActualUnits ?? 0
      })
      
      if (!mountedRef.current) return
      
      // Solo actualizar si hay cambios
      setProductos((prev) => {
        if (compareArraysByIds(prev, productosData)) {
          return prev
        }
        return productosData
      })
      
      setStockActual((prev) => {
        if (compareRecords(prev, stockMap)) {
          return prev
        }
        return stockMap
      })
      
      setProductosLoading(false)
      
      // 3. Actualizar cache en background
      setCache(cacheKey, { productos: productosData, stockActual: stockMap }).catch(() => {
        // Ignorar errores de cache
      })
      
      // NO resetear cantidades al cambiar de pedido - mantener las cantidades existentes
    } catch (error: any) {
      console.error("Error al cargar productos:", error)
      if (mountedRef.current) {
        setProductosLoading(false)
        toast({
          title: "Error",
          description: "No se pudieron cargar los productos",
          variant: "destructive",
        })
      }
    }
  }, [user, state.selectedPedidoId, ownerId, toast, puedeEditarStock, locationIdForStock])

  const catalogMapRef = useRef(new Map<string, Record<string, unknown>>())
  const stockMapRef = useRef(new Map<string, Record<string, unknown>>())

  useEffect(() => {
    catalogMapRef.current = new Map()
    stockMapRef.current = new Map()
    if (!state.selectedPedidoId || !db || !user || !ownerId || !locationIdForStock) return
    if (!puedeEditarStock) return

    const cacheKey = `productos-${ownerId}-${state.selectedPedidoId}-${locationIdForStock}`
    const catalogQuery = query(
      collection(db, COLLECTIONS.CATALOGO),
      where("ownerId", "==", ownerId),
      where("pedidoId", "==", state.selectedPedidoId)
    )
    const stockQuery = query(
      collection(db, COLLECTIONS.STOCK_UBICACIONES),
      where("ownerId", "==", ownerId),
      where("locationId", "==", locationIdForStock)
    )

    const mergeAndSet = () => {
      const productosData: Producto[] = []
      catalogMapRef.current.forEach((cat, id) => {
        if (cat.activo === false) return
        const row = stockMapRef.current.get(id)
        productosData.push(catalogoYStockToProducto(id, cat, ownerId, user.uid, row))
      })
      productosData.sort((a, b) => {
        const ordenA = a.orden ?? 0
        const ordenB = b.orden ?? 0
        if (ordenA !== ordenB) return ordenA - ordenB
        return a.nombre.localeCompare(b.nombre)
      })
      const stockMap: Record<string, number> = {}
      productosData.forEach((p) => {
        stockMap[p.id] = p.stockActualUnits ?? 0
      })
      setProductos((prev) => {
        if (compareArraysByIds(prev, productosData)) return prev
        return productosData
      })
      setStockActual((prev) => {
        if (compareRecords(prev, stockMap)) return prev
        return stockMap
      })
      if (productosData.length > 0) {
        setCache(cacheKey, { productos: productosData, stockActual: stockMap }).catch(() => null)
      }
    }

    const unsubCat = onSnapshot(catalogQuery, (snap) => {
      catalogMapRef.current = new Map(
        snap.docs.map((d) => [d.id, d.data() as Record<string, unknown>])
      )
      mergeAndSet()
    })
    const unsubStock = onSnapshot(stockQuery, (snap) => {
      stockMapRef.current = new Map()
      snap.forEach((d) => {
        const x = d.data() as Record<string, unknown>
        stockMapRef.current.set(String(x.catalogoId), x)
      })
      mergeAndSet()
    })

    return () => {
      unsubCat()
      unsubStock()
    }
  }, [state.selectedPedidoId, user, ownerId, puedeEditarStock, locationIdForStock])

  // Inicialización: re-ejecutar cuando ownerId esté disponible (p. ej. userData del colaborador cargada)
  useEffect(() => {
    loadPedidos()
  }, [user, ownerId])

  useEffect(() => {
    loadProductos()
  }, [state.selectedPedidoId, locationIdForStock, loadProductos])

  // Acciones
  const setSelectedPedidoId = useCallback((pedidoId: string | null) => {
    if (pedidoId && ownerId) recordPedidoUsage(ownerId, pedidoId)
    setState(prev => ({ ...prev, selectedPedidoId: pedidoId }))
  }, [ownerId])

  /** delta en unidades (default 1). Para pack mode, pasar packsToUnidades(product, 1) */
  const incrementarCantidad = useCallback((productoId: string, delta: number = 1) => {
    const d = Math.max(0, Math.floor(delta))
    if (d === 0) return
    setState(prev => ({
      ...prev,
      cantidades: {
        ...prev.cantidades,
        [productoId]: (prev.cantidades[productoId] || 0) + d
      }
    }))
  }, [])

  /** delta en unidades (default 1). Para pack mode, pasar packsToUnidades(product, 1) */
  const decrementarCantidad = useCallback((productoId: string, delta: number = 1) => {
    const d = Math.max(0, Math.floor(delta))
    if (d === 0) return
    setState(prev => {
      const cantidadActual = prev.cantidades[productoId] || 0
      const stockDisponible = stockActual[productoId] || 0
      const cantidadMinimaPermitida = -stockDisponible
      const nuevaCantidad = cantidadActual - d
      if (nuevaCantidad < cantidadMinimaPermitida) return prev
      return {
        ...prev,
        cantidades: { ...prev.cantidades, [productoId]: nuevaCantidad }
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

  const updateProductsOrder = useCallback(async (newOrder: string[]): Promise<boolean> => {
    if (!db || !ownerId || !user?.uid) return false

    try {
      const dbInstance = db
      const batch = writeBatch(dbInstance)

      newOrder.forEach((productId, index) => {
        batch.update(doc(dbInstance, COLLECTIONS.CATALOGO, productId), {
          orden: index,
          ownerId,
          updatedAt: serverTimestamp(),
        })
      })

      await batch.commit()
      return true
    } catch (error: any) {
      console.error("Error al actualizar orden en stock console:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el orden",
        variant: "destructive",
      })
      await loadProductos()
      return false
    }
  }, [db, loadProductos, ownerId, toast, user])

  /** Actualiza el stock real del producto en Firestore (modo control físico). */
  const setStockReal = useCallback(async (productoId: string, value: number): Promise<boolean> => {
    if (!db || !user?.uid || !ownerId || value < 0) return false
    if (!locationIdForStock) {
      toast({
        title: "Error",
        description: "No hay ubicación para guardar el stock",
        variant: "destructive",
      })
      return false
    }
    const val = Math.floor(value)
    try {
      const sRef = doc(
        db,
        COLLECTIONS.STOCK_UBICACIONES,
        stockUbicacionDocId(ownerId, productoId, locationIdForStock)
      )
      const sDoc = await getDoc(sRef)
      const previousValue = sDoc.exists()
        ? Math.max(0, Math.floor(Number(sDoc.data().stockActual) || 0))
        : 0

      if (previousValue === val) {
        setStockActual((prev) => ({ ...prev, [productoId]: val }))
        return true
      }

      const productName = sDoc.exists()
        ? String(sDoc.data().nombre || "Producto desconocido")
        : "Producto desconocido"

      const res = await setStockUbicacion({
        ownerId,
        catalogoId: productoId,
        locationId: locationIdForStock,
        cantidad: val,
        user: { uid: user.uid },
      })
      if (!res.ok) {
        toast({
          title: "Error",
          description: res.error ?? "No se pudo actualizar el stock",
          variant: "destructive",
        })
        return false
      }

      setStockActual((prev) => ({ ...prev, [productoId]: val }))

      await logStockAction({
        ownerId,
        productId: productoId,
        productName,
        action: "stock_update",
        previousValue,
        newValue: val,
        user: {
          uid: user.uid,
          email: user.email || "desconocido@example.com",
        },
        source: "pwa",
      })

      return true
    } catch (err) {
      console.error("Error actualizando stock real:", err)
      toast({
        title: "Error",
        description: "No se pudo actualizar el stock",
        variant: "destructive",
      })
      return false
    }
  }, [db, user, ownerId, toast, locationIdForStock])

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
    if (!puedeEditarStock) {
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

    if (!locationIdForStock) {
      toast({
        title: "Error",
        description: "No hay ubicación para registrar movimientos",
        variant: "destructive",
      })
      return false
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await confirmarMovimientosService(
        movimientosPendientes,
        ownerId,
        user.uid,
        locationIdForStock
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
  }, [movimientosPendientes, ownerId, user, toast, totalProductos, puedeEditarStock, locationIdForStock])

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
    setStockReal,
    updateProductsOrder,
  }
}
