"use client"

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  limit,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { Producto, Pedido, StockMovimiento } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

interface StockContextValue {
  stockActual: Record<string, number>
  productos: Producto[]
  movimientos: StockMovimiento[]
  pedidos: Pedido[]
  loadingStock: boolean
  updateStock: (productId: string, cantidad: number, motivo?: string) => Promise<{ stockAnterior: number; nuevoStock: number; producto: Producto }>
  incrementStock: (productId: string, cantidad: number, motivo?: string) => Promise<{ stockAnterior: number; nuevoStock: number; producto: Producto }>
  decrementStock: (productId: string, cantidad: number, motivo?: string) => Promise<{ stockAnterior: number; nuevoStock: number; producto: Producto }>
}

const StockContext = createContext<StockContextValue | undefined>(undefined)

function useStockState(user: { uid: string; displayName?: string | null; email?: string | null } | null) {
  const { userData } = useData()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const actorUserId = user?.uid
  const userName = user?.displayName || user?.email

  const [productos, setProductos] = useState<Producto[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [movimientos, setMovimientos] = useState<StockMovimiento[]>([])
  const [loadingStock, setLoadingStock] = useState(true)

  // Cargar pedidos
  useEffect(() => {
    if (!db || !ownerId) return
    const pedidosRef = collection(db, COLLECTIONS.PEDIDOS)
    const q = query(pedidosRef, where("ownerId", "==", ownerId))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const pedidosData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Pedido[]
        setPedidos(pedidosData)
      },
      (error) => {
        if (error.code === "permission-denied") {
          console.warn("Error de permisos al cargar pedidos:", error)
        } else {
          console.error("Error al cargar pedidos:", error)
        }
      }
    )
    return () => unsubscribe()
  }, [ownerId])

  // Cargar productos (solo ownerId; el filtrado por pedidos se hace en useMemo)
  useEffect(() => {
    if (!db || !ownerId) {
      setLoadingStock(false)
      return
    }
    const productosRef = collection(db, COLLECTIONS.PRODUCTS)
    const q = query(productosRef, where("ownerId", "==", ownerId))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const productosData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Producto[]
        setProductos(productosData)
        setLoadingStock(false)
      },
      (error) => {
        if (error.code === "permission-denied") {
          console.warn("Error de permisos al cargar productos:", error)
        } else {
          console.error("Error al cargar productos:", error)
        }
        setLoadingStock(false)
      }
    )
    return () => unsubscribe()
  }, [ownerId])

  // Cargar movimientos recientes
  useEffect(() => {
    if (!db || !ownerId) return
    const movimientosRef = collection(db, COLLECTIONS.STOCK_MOVIMIENTOS)
    const q = query(
      movimientosRef,
      where("ownerId", "==", ownerId),
      orderBy("createdAt", "desc"),
      limit(50)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const movData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as StockMovimiento[]
      setMovimientos(movData)
    })
    return () => unsubscribe()
  }, [ownerId])

  // Estado derivado: stock por producto (evita duplicar lo que ya está en productos)
  const stockActual = useMemo(() => {
    const map: Record<string, number> = {}
    productos.forEach((p) => {
      map[p.id] = (p as Producto & { stockActual?: number }).stockActual ?? 0
    })
    return map
  }, [productos])

  // Productos filtrados por pedidos y ordenados (fuera del listener para no recrearlo)
  const productosFiltrados = useMemo(() => {
    if (pedidos.length === 0) return productos
    return productos
      .filter((p) => p.pedidoId && pedidos.some((ped) => ped.id === p.pedidoId))
      .sort((a, b) => {
        const ordenA = a.orden ?? 0
        const ordenB = b.orden ?? 0
        if (ordenA !== ordenB) return ordenA - ordenB
        return a.nombre.localeCompare(b.nombre)
      })
  }, [productos, pedidos])

  const actualizarStock = useCallback(
    async (
      productoId: string,
      tipo: "entrada" | "salida",
      cantidad: number,
      motivo?: string
    ): Promise<{ stockAnterior: number; nuevoStock: number; producto: Producto }> => {
      if (!db || !ownerId || !actorUserId) throw new Error("No hay conexión")
      const producto = productos.find((p) => p.id === productoId)
      if (!producto) throw new Error("Producto no encontrado")
      const stockAnterior = stockActual[productoId] || 0
      const nuevoStock = tipo === "entrada" ? stockAnterior + cantidad : stockAnterior - cantidad
      if (nuevoStock < 0) {
        const mensajeError =
          stockAnterior === 0
            ? `No podés quitar ${cantidad} ${producto.unidad || "unidades"} de ${producto.nombre} porque el stock está en 0.`
            : `No podés quitar ${cantidad} ${producto.unidad || "unidades"} de ${producto.nombre}. Solo tenés ${stockAnterior} disponibles.`
        throw new Error(mensajeError)
      }
      const movimiento: Omit<StockMovimiento, "id"> = {
        productoId,
        productoNombre: producto.nombre,
        tipo,
        cantidad,
        unidad: producto.unidad || "u",
        ownerId,
        userId: actorUserId,
        ...(userName != null && { userName }),
        createdAt: serverTimestamp(),
        ...(motivo && { motivo }),
        ...(producto.pedidoId && { pedidoId: producto.pedidoId }),
      }
      await addDoc(collection(db, COLLECTIONS.STOCK_MOVIMIENTOS), movimiento)
      const productRef = doc(db, COLLECTIONS.PRODUCTS, productoId)
      await updateDoc(productRef, {
        stockActual: nuevoStock,
        updatedAt: serverTimestamp(),
        ownerId,
        userId: actorUserId,
      })
      return { stockAnterior, nuevoStock, producto }
    },
    [db, ownerId, actorUserId, userName, productos, stockActual]
  )

  const actualizarStockDirecto = useCallback(
    async (
      productoId: string,
      cantidad: number,
      motivo?: string
    ): Promise<{ stockAnterior: number; nuevoStock: number; producto: Producto }> => {
      if (!db || !ownerId || !actorUserId) throw new Error("No hay conexión")
      const producto = productos.find((p) => p.id === productoId)
      if (!producto) throw new Error("Producto no encontrado")
      if (cantidad < 0) {
        throw new Error(`El stock no puede ser negativo para ${producto.nombre}.`)
      }
      const stockAnterior = stockActual[productoId] || 0
      const diferencia = cantidad - stockAnterior
      const tipoMovimiento: "entrada" | "salida" = diferencia >= 0 ? "entrada" : "salida"
      const cantidadMovimiento = Math.abs(diferencia)
      if (cantidadMovimiento > 0) {
        const movimiento: Omit<StockMovimiento, "id"> = {
          productoId,
          productoNombre: producto.nombre,
          tipo: tipoMovimiento,
          cantidad: cantidadMovimiento,
          unidad: producto.unidad || "u",
          ownerId,
          userId: actorUserId,
          ...(userName != null && { userName }),
          createdAt: serverTimestamp(),
          motivo: motivo || `Actualización directa: ${stockAnterior} → ${cantidad}`,
          ...(producto.pedidoId && { pedidoId: producto.pedidoId }),
        }
        await addDoc(collection(db, COLLECTIONS.STOCK_MOVIMIENTOS), movimiento)
      }
      const productRef = doc(db, COLLECTIONS.PRODUCTS, productoId)
      await updateDoc(productRef, {
        stockActual: cantidad,
        updatedAt: serverTimestamp(),
        ownerId,
        userId: actorUserId,
      })
      return { stockAnterior, nuevoStock: cantidad, producto }
    },
    [db, ownerId, actorUserId, userName, productos, stockActual]
  )

  const updateStock = useCallback(
    (productId: string, cantidad: number, motivo?: string) =>
      actualizarStockDirecto(productId, cantidad, motivo),
    [actualizarStockDirecto]
  )

  const incrementStock = useCallback(
    (productId: string, cantidad: number, motivo?: string) =>
      actualizarStock(productId, "entrada", cantidad, motivo),
    [actualizarStock]
  )

  const decrementStock = useCallback(
    (productId: string, cantidad: number, motivo?: string) =>
      actualizarStock(productId, "salida", cantidad, motivo),
    [actualizarStock]
  )

  const value = useMemo(
    () => ({
      stockActual,
      productos: productosFiltrados,
      movimientos,
      pedidos,
      loadingStock,
      updateStock,
      incrementStock,
      decrementStock,
    }),
    [
      stockActual,
      productosFiltrados,
      movimientos,
      pedidos,
      loadingStock,
      updateStock,
      incrementStock,
      decrementStock,
    ]
  )

  return value
}

export function StockProvider({
  children,
  user,
}: {
  children: React.ReactNode
  user: { uid: string; displayName?: string | null; email?: string | null } | null
}) {
  const value = useStockState(user)
  return (
    <StockContext.Provider value={value}>
      {children}
    </StockContext.Provider>
  )
}

export function useStock(): StockContextValue {
  const context = useContext(StockContext)
  if (context === undefined) {
    throw new Error("useStock must be used within a StockProvider")
  }
  return context
}
