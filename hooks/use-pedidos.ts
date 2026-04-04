"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch,
  onSnapshot,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { Pedido, Producto } from "@/lib/types"
import { buildPedidoOficial } from "@/lib/build-pedido-oficial"
import { getPedidoSugeridoUnits } from "@/lib/pedido-engine"
import {
  getStockMinimoUnits,
  normalizeStockMinimoInput,
} from "@/lib/unidades-utils"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { canUser } from "@/lib/permissions"
import { crearProductoCatalogo, actualizarProductoCatalogo } from "@/lib/catalogo-service"
import { inicializarStockUbicacion, stockUbicacionDocId, syncStockSnapshotsFromCatalogo } from "@/lib/stock-ubicaciones-service"

const DEFAULT_FORMAT = "{nombre} ({cantidad})"

function normalizeProduct(product: Producto): Producto {
  const stockMinimoUnits = getStockMinimoUnits(product)
  const stockActualUnits = Math.max(0, Math.floor(product.stockActualUnits ?? (product as any).stockActual ?? 0))

  return {
    ...product,
    stockMinimo: stockMinimoUnits,
    stockMinimoUnits,
    stockActualUnits,
    unidadBase: product.unidadBase || product.unidad || "U",
    unidad: product.unidad || product.unidadBase || "U",
    modoCompra: product.modoCompra || "unidad",
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
  return normalizeProduct({
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

export function usePedidos(user: any) {
  const { toast } = useToast()
  const { userData } = useData()

  const locationIdForStock = useMemo(
    () => userData?.locationId ?? user?.uid ?? "",
    [userData?.locationId, user?.uid]
  )
  
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [products, setProducts] = useState<Producto[]>([])
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)
  const [stockActual, setStockActual] = useState<Record<string, number>>({})

  const ownerId = useMemo(
    () => getOwnerIdForActor(user, userData),
    [user, userData]
  )
  const canCrearPedido = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "crear_pedido"),
    [user?.uid, userData?.role, userData?.locationId]
  )
  const canEditarPedido = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "editar_pedido"),
    [user?.uid, userData?.role, userData?.locationId]
  )
  const canEditarProductos = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "editar_producto"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  // Cargar pedidos
  const loadPedidos = useCallback(async () => {
    if (!user || !db) return
    
    try {
      if (!ownerId) return
      
      const pedidosQuery = query(
        collection(db, COLLECTIONS.PEDIDOS),
        where("ownerId", "==", ownerId)
      )
      const snapshot = await getDocs(pedidosQuery)
      const pedidosData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Pedido[]
      
      pedidosData.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setPedidos(pedidosData)
      
      if (pedidosData.length > 0 && !selectedPedido) {
        setSelectedPedido(pedidosData[0])
      }
    } catch (error: any) {
      logger.error("Error al cargar pedidos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los pedidos",
        variant: "destructive",
      })
    }
  }, [user, ownerId, selectedPedido, toast])

  // Catálogo + stock por ubicación (solo lectura)
  const loadProducts = useCallback(async () => {
    if (!user || !db || !selectedPedido) {
      setProducts([])
      setStockActual({})
      return
    }

    try {
      if (!ownerId) {
        setProducts([])
        setStockActual({})
        return
      }
      if (!locationIdForStock) {
        setProducts([])
        setStockActual({})
        return
      }

      const catalogQuery = query(
        collection(db, COLLECTIONS.CATALOGO),
        where("ownerId", "==", ownerId),
        where("pedidoId", "==", selectedPedido.id)
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

      const productsData: Producto[] = []
      catalogSnap.forEach((d) => {
        const cat = d.data() as Record<string, unknown>
        if (cat.activo === false) return
        productsData.push(
          catalogoYStockToProducto(d.id, cat, ownerId, user.uid, stockByCatalogo.get(d.id))
        )
      })

      productsData.sort((a, b) => {
        const ordenA = a.orden ?? 0
        const ordenB = b.orden ?? 0
        if (ordenA !== ordenB) {
          return ordenA - ordenB
        }
        return a.nombre.localeCompare(b.nombre)
      })

      setProducts(productsData)
      setStockActual(
        productsData.reduce<Record<string, number>>((acc, product) => {
          acc[product.id] = product.stockActualUnits ?? 0
          return acc
        }, {})
      )
    } catch (error: any) {
      logger.error("Error al cargar productos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      })
    }
  }, [user, selectedPedido, ownerId, toast, locationIdForStock])

  // Corregir orden de productos sin orden - función separada, solo se llama explícitamente
  const fixProductsOrder = useCallback(async (): Promise<boolean> => {
    if (!db || !selectedPedido || products.length === 0) return false
    if (!canEditarProductos) {
      toast({ title: "Error", description: "No tienes permisos para editar productos", variant: "destructive" })
      return false
    }

    try {
      if (!ownerId || !user?.uid) return false

      // Identificar productos sin orden
      const productosSinOrden = products.filter(p => p.orden === undefined)
      if (productosSinOrden.length === 0) return true

      // Ordenar alfabéticamente
      const productosConOrden = products.filter(p => p.orden !== undefined)
      productosSinOrden.sort((a, b) => a.nombre.localeCompare(b.nombre))
      
      // Calcular el orden inicial (máximo orden existente + 1, o 0)
      const maxOrden = productosConOrden.length > 0
        ? Math.max(...productosConOrden.map(p => p.orden ?? 0), -1) + 1
        : 0
      
      // Escribir en Firestore usando ownerId resuelto
      const dbInstance = db // TypeScript ahora sabe que db no es undefined
      const batch = writeBatch(dbInstance)
      productosSinOrden.forEach((product, index) => {
        const productRef = doc(dbInstance, COLLECTIONS.CATALOGO, product.id)
        batch.update(productRef, {
          orden: maxOrden + index,
          ownerId,
          updatedAt: serverTimestamp(),
        })
      })
      await batch.commit()
      
      // Recargar productos desde Firestore para reflejar cambios
      await loadProducts()
      return true
    } catch (error: any) {
      logger.error("Error al corregir orden de productos:", error)
      return false
    }
  }, [db, selectedPedido, products, ownerId, user, loadProducts, canEditarProductos, toast])

  // Corregir unidad de productos sin unidad - función separada, solo se llama explícitamente
  const fixProductsUnit = useCallback(async (): Promise<boolean> => {
    if (!db || !selectedPedido || products.length === 0) return false
    if (!canEditarProductos) {
      toast({ title: "Error", description: "No tienes permisos para editar productos", variant: "destructive" })
      return false
    }

    try {
      if (!ownerId || !user?.uid) return false

      // Identificar productos sin unidad
      const productosSinUnidad = products.filter(p => !p.unidad || p.unidad.trim() === "")
      if (productosSinUnidad.length === 0) return true

      // Escribir en Firestore usando ownerId resuelto
      const dbInstance = db // TypeScript ahora sabe que db no es undefined
      const batch = writeBatch(dbInstance)
      productosSinUnidad.forEach((product) => {
        const productRef = doc(dbInstance, COLLECTIONS.CATALOGO, product.id)
        batch.update(productRef, {
          unidad: "U",
          ownerId,
          updatedAt: serverTimestamp(),
        })
      })
      await batch.commit()

      for (const product of productosSinUnidad) {
        const snap = await getDoc(doc(db, COLLECTIONS.CATALOGO, product.id))
        if (snap.exists()) {
          const c = snap.data() as Record<string, unknown>
          await syncStockSnapshotsFromCatalogo(
            ownerId,
            product.id,
            String(c.nombre ?? ""),
            "U",
            String(c.pedidoId ?? "")
          )
        }
      }

      await loadProducts()
      return true
    } catch (error: any) {
      logger.error("Error al corregir unidad de productos:", error)
      return false
    }
  }, [db, selectedPedido, products, ownerId, user, loadProducts, canEditarProductos, toast])

  // Inicialización
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadPedidos()
      setLoading(false)
    }
    init()
  }, [user])

  useEffect(() => {
    if (selectedPedido) {
      loadProducts()
    }
  }, [selectedPedido?.id, locationIdForStock, loadProducts])

  const catalogMapRef = useRef(new Map<string, Record<string, unknown>>())
  const stockMapRef = useRef(new Map<string, Record<string, unknown>>())

  useEffect(() => {
    catalogMapRef.current = new Map()
    stockMapRef.current = new Map()
    if (!selectedPedido?.id || !db || !ownerId || !locationIdForStock || !user) return

    const catalogQuery = query(
      collection(db, COLLECTIONS.CATALOGO),
      where("ownerId", "==", ownerId),
      where("pedidoId", "==", selectedPedido.id)
    )
    const stockQuery = query(
      collection(db, COLLECTIONS.STOCK_UBICACIONES),
      where("ownerId", "==", ownerId),
      where("locationId", "==", locationIdForStock)
    )

    const mergeAndSet = () => {
      const productsData: Producto[] = []
      catalogMapRef.current.forEach((cat, id) => {
        if (cat.activo === false) return
        const row = stockMapRef.current.get(id)
        productsData.push(catalogoYStockToProducto(id, cat, ownerId, user.uid, row))
      })
      productsData.sort((a, b) => {
        const ordenA = a.orden ?? 0
        const ordenB = b.orden ?? 0
        if (ordenA !== ordenB) return ordenA - ordenB
        return a.nombre.localeCompare(b.nombre)
      })
      setProducts(productsData)
      setStockActual(
        productsData.reduce<Record<string, number>>((acc, product) => {
          acc[product.id] = product.stockActualUnits ?? 0
          return acc
        }, {})
      )
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
  }, [selectedPedido?.id, ownerId, locationIdForStock, user])

  // Listener en tiempo real para el pedido seleccionado (para actualizar estado automáticamente)
  useEffect(() => {
    if (!selectedPedido?.id || !db || !user) return

    const pedidoRef = doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id)
    const unsubscribe = onSnapshot(
      pedidoRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const pedidoData = { id: snapshot.id, ...snapshot.data() } as Pedido
          // Actualizar el pedido seleccionado si es el mismo
          setSelectedPedido((prev) => {
            if (prev?.id === pedidoData.id) {
              return pedidoData
            }
            return prev
          })
          // También actualizar en la lista de pedidos
          setPedidos((prev) =>
            prev.map((p) => (p.id === pedidoData.id ? pedidoData : p))
          )
        }
      },
      (error) => {
        logger.error("Error en listener de pedido:", error)
      }
    )

    return () => unsubscribe()
  }, [selectedPedido?.id, user])

  // Calcular pedido recomendado
  const calcularPedido = useCallback((stockMinimoUnits: number, stockActualValue: number | undefined): number => {
    const actual = stockActualValue ?? 0
    return Math.max(0, stockMinimoUnits - actual)
  }, [])

  // Productos con pedido > 0
  const productosAPedir = useMemo(() => {
    return products.filter((p) => getPedidoSugeridoUnits(p, stockActual[p.id] ?? 0) > 0)
  }, [products, stockActual])

  // Crear pedido
  const createPedido = useCallback(async (nombre: string, stockMinimoDefault: number, formatoSalida: string) => {
    if (!db || !user) return null
    if (!canCrearPedido) {
      toast({ title: "Error", description: "No tienes permisos para crear pedidos", variant: "destructive" })
      return null
    }
    
    if (!nombre.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
      return null
    }

    try {
      if (!ownerId) {
        toast({ title: "Error", description: "Owner no válido", variant: "destructive" })
        return null
      }

      const docRef = await addDoc(collection(db, COLLECTIONS.PEDIDOS), {
        nombre: nombre.trim(),
        stockMinimoDefault,
        formatoSalida: formatoSalida || DEFAULT_FORMAT,
        estado: "creado",
        ownerId,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      
      const newPedido: Pedido = {
        id: docRef.id,
        nombre: nombre.trim(),
        stockMinimoDefault,
        formatoSalida: formatoSalida || DEFAULT_FORMAT,
        estado: "creado",
        ownerId,
        userId: user.uid,
      }
      
      setPedidos(prev => [...prev, newPedido].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setSelectedPedido(newPedido)
      
      toast({ title: "Pedido creado", description: `Se ha creado "${newPedido.nombre}"` })
      return newPedido
    } catch (error: any) {
      logger.error("Error al crear pedido:", error)
      toast({ title: "Error", description: "No se pudo crear el pedido", variant: "destructive" })
      return null
    }
  }, [user, userData, ownerId, toast, canCrearPedido])

  // Actualizar pedido
  const updatePedido = useCallback(async (nombre: string, stockMinimoDefault: number, formatoSalida: string, mensajePrevio?: string, sheetUrl?: string) => {
    if (!db || !selectedPedido) return false
    if (!canEditarPedido) {
      toast({ title: "Error", description: "No tienes permisos para editar pedidos", variant: "destructive" })
      return false
    }

    try {
      if (!ownerId) {
        toast({ title: "Error", description: "Owner no válido", variant: "destructive" })
        return false
      }

      // Primero escribir en Firestore - solo actualizar estado local si la escritura es exitosa
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id), {
        nombre: nombre.trim(),
        stockMinimoDefault,
        formatoSalida: formatoSalida || DEFAULT_FORMAT,
        mensajePrevio: mensajePrevio ?? selectedPedido.mensajePrevio ?? null,
        sheetUrl: sheetUrl !== undefined ? (sheetUrl.trim() || null) : selectedPedido.sheetUrl ?? null,
        ownerId,
        userId: user?.uid ?? selectedPedido.userId,
        updatedAt: serverTimestamp(),
      })
      
      // Solo actualizar estado local DESPUÉS de confirmar la escritura exitosa
      // El listener de onSnapshot también actualizará, pero esto mejora la UX
      const updatedPedido = { 
        ...selectedPedido, 
        nombre: nombre.trim(), 
        stockMinimoDefault, 
        formatoSalida,
        mensajePrevio: mensajePrevio ?? selectedPedido.mensajePrevio,
        sheetUrl: sheetUrl !== undefined ? (sheetUrl.trim() || undefined) : selectedPedido.sheetUrl
      }
      setPedidos(prev => prev.map(p => p.id === selectedPedido.id ? updatedPedido : p))
      setSelectedPedido(updatedPedido)
      
      toast({ title: "Pedido actualizado" })
      return true
    } catch (error: any) {
      logger.error("Error al actualizar pedido:", error)
      // No actualizar estado local - el listener de onSnapshot mantendrá el estado correcto
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" })
      return false
    }
  }, [selectedPedido, ownerId, user, toast, canEditarPedido])

  // Eliminar pedido
  const deletePedido = useCallback(async () => {
    if (!db || !selectedPedido) return false
    if (!canEditarPedido) {
      toast({ title: "Error", description: "No tienes permisos para eliminar pedidos", variant: "destructive" })
      return false
    }

    try {
      if (!ownerId) {
        toast({ title: "Error", description: "Owner no válido", variant: "destructive" })
        return false
      }
      const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id))
      if (!pedidoDoc.exists() || pedidoDoc.data()?.ownerId !== ownerId) {
        toast({ title: "Error", description: "No tienes permiso para eliminar este pedido", variant: "destructive" })
        return false
      }

      const batch = writeBatch(db)
      const catalogosPedido = await getDocs(
        query(
          collection(db, COLLECTIONS.CATALOGO),
          where("ownerId", "==", ownerId),
          where("pedidoId", "==", selectedPedido.id)
        )
      )
      for (const c of catalogosPedido.docs) {
        const stockLin = await getDocs(
          query(
            collection(db, COLLECTIONS.STOCK_UBICACIONES),
            where("ownerId", "==", ownerId),
            where("catalogoId", "==", c.id)
          )
        )
        stockLin.forEach((s) => batch.delete(s.ref))
        batch.delete(c.ref)
      }
      for (const product of products) {
        batch.delete(doc(db, COLLECTIONS.PRODUCTS, product.id))
      }
      batch.delete(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id))
      await batch.commit()
      
      const remainingPedidos = pedidos.filter(p => p.id !== selectedPedido.id)
      setPedidos(remainingPedidos)
      setSelectedPedido(remainingPedidos[0] || null)
      setProducts([])
      
      toast({ title: "Pedido eliminado" })
      return true
    } catch (error: any) {
      logger.error("Error al eliminar pedido:", error)
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" })
      return false
    }
  }, [selectedPedido, products, pedidos, toast, ownerId, canEditarPedido])

  // Importar productos
  const importProducts = useCallback(async (text: string) => {
    if (!db || !user || !selectedPedido) return false
    if (!canEditarProductos) {
      toast({ title: "Error", description: "No tienes permisos para editar productos", variant: "destructive" })
      return false
    }

    const lines = text.split("\n").filter(line => line.trim())
    const nombres = lines.map(line => {
      if (line.includes("\t")) return line.split("\t")[0].trim()
      if (line.includes(";")) return line.split(";")[0].trim()
      if (line.includes(",")) {
        const parts = line.split(",")
        if (parts.length > 1 && parts[1].trim()) return parts[0].trim()
      }
      return line.trim()
    }).filter(Boolean)

    if (nombres.length === 0) {
      toast({ title: "Error", description: "No se encontraron productos", variant: "destructive" })
      return false
    }

    const existingNames = products.map(p => p.nombre.toLowerCase())
    const nuevos = nombres.filter(n => !existingNames.includes(n.toLowerCase()))

    if (nuevos.length === 0) {
      toast({ title: "Info", description: "Todos los productos ya existen" })
      return true
    }

    try {
      // Calcular el orden inicial: máximo orden existente + 1, o 0 si no hay productos
      const maxOrden = products.length > 0 
        ? Math.max(...products.map(p => p.orden ?? 0), -1) + 1
        : 0

      const batch = writeBatch(db)
      
      // Crear un mapa de nombres para mantener el orden de importación
      const nombresMap = new Map<string, number>()
      nombres.forEach((nombre, index) => {
        if (!existingNames.includes(nombre.toLowerCase())) {
          nombresMap.set(nombre, maxOrden + nombresMap.size)
        }
      })

      if (!ownerId) {
        toast({ title: "Error", description: "Usuario no válido", variant: "destructive" })
        return false
      }
      if (!locationIdForStock) {
        toast({
          title: "Error",
          description: "No hay ubicación para inicializar el stock de los productos importados",
          variant: "destructive",
        })
        return false
      }

      for (const nombre of nuevos) {
        const catRef = doc(collection(db, COLLECTIONS.CATALOGO))
        const orden = nombresMap.get(nombre) ?? maxOrden + nuevos.indexOf(nombre)
        batch.set(catRef, {
          ownerId,
          nombre,
          unidad: "U",
          pedidoId: selectedPedido.id,
          stockMinimo: selectedPedido.stockMinimoDefault,
          orden,
          activo: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        })
        const sId = stockUbicacionDocId(ownerId, catRef.id, locationIdForStock)
        const sRef = doc(db, COLLECTIONS.STOCK_UBICACIONES, sId)
        batch.set(sRef, {
          ownerId,
          catalogoId: catRef.id,
          locationId: locationIdForStock,
          nombre,
          unidad: "U",
          pedidoId: selectedPedido.id,
          stockActual: 0,
          stockMinimo: selectedPedido.stockMinimoDefault,
          orden,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        })
      }
      await batch.commit()
      
      toast({
        title: "Importados",
        description: `${nuevos.length} productos${nombres.length !== nuevos.length ? ` (${nombres.length - nuevos.length} existían)` : ""}`,
      })
      
      await loadProducts()
      return true
    } catch (error: any) {
      logger.error("Error al importar:", error)
      toast({ title: "Error", description: "No se pudo importar", variant: "destructive" })
      return false
    }
  }, [user, ownerId, selectedPedido, products, loadProducts, toast, canEditarProductos, locationIdForStock])

  // Actualizar producto
  const updateProduct = useCallback(async (productId: string, field: string, value: string) => {
    if (!db) return false
    if (!ownerId) return false
    if (!canEditarProductos) {
      toast({ title: "Error", description: "No tienes permisos para editar productos", variant: "destructive" })
      return false
    }

    try {
      const product = products.find((item) => item.id === productId)
      const catRef = doc(db, COLLECTIONS.CATALOGO, productId)
      const catSnap = await getDoc(catRef)
      if (!catSnap.exists()) {
        toast({ title: "Error", description: "Producto no encontrado en catálogo", variant: "destructive" })
        return false
      }
      const cur = catSnap.data() as Record<string, unknown>
      if (cur.ownerId !== ownerId) return false

      if (field === "nombre") {
        if (!value.trim()) {
          toast({ title: "Error", description: "Nombre requerido", variant: "destructive" })
          return false
        }
        const res = await actualizarProductoCatalogo(
          productId,
          { nombre: value.trim() },
          ownerId
        )
        if (!res.ok) {
          toast({ title: "Error", description: res.error, variant: "destructive" })
          return false
        }
      } else if (field === "stockMinimo" || field === "stockMinimoUnits") {
        if (!product) return false
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 0) {
          toast({ title: "Error", description: "Stock inválido", variant: "destructive" })
          return false
        }
        const units = normalizeStockMinimoInput(product, num)
        await updateDoc(catRef, {
          stockMinimo: units,
          updatedAt: serverTimestamp(),
        })
      } else if (field === "unidad") {
        const u = value.trim() || "U"
        const res = await actualizarProductoCatalogo(productId, { unidad: u }, ownerId)
        if (!res.ok) {
          toast({ title: "Error", description: res.error, variant: "destructive" })
          return false
        }
      } else if (field === "modoCompra" || field === "cantidadPorPack") {
        toast({
          title: "No disponible",
          description: "Modo pack se gestiona solo en datos legacy de productos.",
          variant: "destructive",
        })
        return false
      }

      await loadProducts()
      return true
    } catch (error: any) {
      logger.error("Error al actualizar producto:", error)
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" })
      return false
    }
  }, [loadProducts, ownerId, products, user, toast, canEditarProductos, db])

  // Crear producto individual
  const createProduct = useCallback(async (
    nombre: string,
    stockMinimo?: number,
    unidad?: string,
    modoCompra?: "unidad" | "pack",
    cantidadPorPack?: number
  ) => {
    if (!db || !user || !selectedPedido) return null
    if (!canEditarProductos) {
      toast({ title: "Error", description: "No tienes permisos para editar productos", variant: "destructive" })
      return null
    }

    if (!nombre.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
      return null
    }

    try {
      // Verificar que no exista un producto con el mismo nombre (case-insensitive)
      const existingNames = products.map(p => p.nombre.toLowerCase())
      if (existingNames.includes(nombre.trim().toLowerCase())) {
        toast({ title: "Error", description: "Ya existe un producto con ese nombre", variant: "destructive" })
        return null
      }

      // Calcular el orden: máximo orden existente + 1, o 0 si no hay productos
      const maxOrden = products.length > 0 
        ? Math.max(...products.map(p => p.orden ?? 0), -1) + 1
        : 0

      if (!ownerId) {
        toast({ title: "Error", description: "Usuario no válido", variant: "destructive" })
        return null
      }
      if (!locationIdForStock) {
        toast({
          title: "Error",
          description: "No hay ubicación para asociar el stock inicial",
          variant: "destructive",
        })
        return null
      }

      const baseUnidad = unidad?.trim() || "U"
      const min = stockMinimo ?? selectedPedido.stockMinimoDefault
      const catRes = await crearProductoCatalogo({
        ownerId,
        nombre: nombre.trim(),
        unidad: baseUnidad,
        pedidoId: selectedPedido.id,
        stockMinimo: min,
        orden: maxOrden,
        user: { uid: user.uid },
      })
      if (!catRes.ok || !catRes.catalogoId) {
        toast({
          title: "Error",
          description: catRes.error ?? "No se pudo crear el producto",
          variant: "destructive",
        })
        return null
      }

      const st = await inicializarStockUbicacion({
        ownerId,
        catalogoId: catRes.catalogoId,
        locationId: locationIdForStock,
        stockMinimo: min,
        orden: maxOrden,
        userId: user.uid,
      })
      if (!st.ok) {
        toast({
          title: "Catálogo creado",
          description: st.error ?? "No se pudo activar el stock en tu ubicación",
          variant: "destructive",
        })
      }

      await loadProducts()

      toast({ title: "Producto creado", description: `Se ha agregado "${nombre.trim()}"` })

      return catRes.catalogoId
    } catch (error: any) {
      logger.error("Error al crear producto:", error)
      toast({ title: "Error", description: "No se pudo crear el producto", variant: "destructive" })
      return null
    }
  }, [user, ownerId, selectedPedido, products, loadProducts, toast, canEditarProductos, locationIdForStock])

  // Eliminar producto
  const deleteProduct = useCallback(async (productId: string) => {
    if (!db) return false
    if (!canEditarProductos) {
      toast({ title: "Error", description: "No tienes permisos para editar productos", variant: "destructive" })
      return false
    }
    
    try {
      if (!ownerId) return false
      const stockLin = await getDocs(
        query(
          collection(db, COLLECTIONS.STOCK_UBICACIONES),
          where("ownerId", "==", ownerId),
          where("catalogoId", "==", productId)
        )
      )
      const batch = writeBatch(db)
      stockLin.forEach((s) => batch.delete(s.ref))
      batch.delete(doc(db, COLLECTIONS.CATALOGO, productId))
      await batch.commit()
      setStockActual((prev) => {
        const newState = { ...prev }
        delete newState[productId]
        return newState
      })
      await loadProducts()
      toast({ title: "Producto eliminado" })
      return true
    } catch (error: any) {
      logger.error("Error al eliminar producto:", error)
      toast({ title: "Error", variant: "destructive" })
      return false
    }
  }, [loadProducts, toast, canEditarProductos, ownerId, db])

  // Limpiar stock
  const clearStock = useCallback(async () => {
    if (!db || !ownerId || !user?.uid) return false
    if (!canEditarProductos) {
      toast({ title: "Error", description: "No tienes permisos para editar productos", variant: "destructive" })
      return false
    }

    try {
      if (!locationIdForStock) {
        toast({ title: "Error", description: "Ubicación no disponible", variant: "destructive" })
        return false
      }

      const dbInstance = db
      const batch = writeBatch(dbInstance)
      for (const product of products) {
        const sRef = doc(
          dbInstance,
          COLLECTIONS.STOCK_UBICACIONES,
          stockUbicacionDocId(ownerId, product.id, locationIdForStock)
        )
        const sSnap = await getDoc(sRef)
        if (sSnap.exists()) {
          batch.update(sRef, {
            stockActual: 0,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
          })
        }
      }

      await batch.commit()
      setStockActual(
        products.reduce<Record<string, number>>((acc, product) => {
          acc[product.id] = 0
          return acc
        }, {})
      )
      toast({ title: "Stock limpiado" })
      return true
    } catch (error: any) {
      logger.error("Error al limpiar stock:", error)
      toast({ title: "Error", description: "No se pudo limpiar el stock", variant: "destructive" })
      return false
    }
  }, [db, ownerId, products, toast, user, canEditarProductos, locationIdForStock])

  // Actualizar orden de productos
  const updateProductsOrder = useCallback(async (newOrder: string[]) => {
    if (!db) return false
    if (!ownerId) return false
    if (!canEditarProductos) {
      toast({ title: "Error", description: "No tienes permisos para editar productos", variant: "destructive" })
      return false
    }

    try {
      const dbInstance = db // TypeScript ahora sabe que db no es undefined
      const batch = writeBatch(dbInstance)

      newOrder.forEach((productId, index) => {
        const productRef = doc(dbInstance, COLLECTIONS.CATALOGO, productId)
        batch.update(productRef, {
          orden: index,
          ownerId,
          updatedAt: serverTimestamp(),
        })
      })
      
      // Primero confirmar la escritura en Firestore
      await batch.commit()
      
      // Solo actualizar estado local DESPUÉS de confirmar la escritura exitosa
      // Recargar desde Firestore para garantizar consistencia
      await loadProducts()
      
      return true
    } catch (error: any) {
      logger.error("Error al actualizar orden:", error)
      toast({ 
        title: "Error", 
        description: "No se pudo actualizar el orden", 
        variant: "destructive" 
      })
      // Recargar productos desde Firestore para restaurar estado correcto
      await loadProducts()
      return false
    }
  }, [db, ownerId, user, loadProducts, toast, canEditarProductos])

  // Generar texto del pedido (usa placeholders {cantidad}, {cantidadUnidades}, {cantidadPacks}, {unidad})
  const generarTextoPedido = useCallback((): string => {
    if (!selectedPedido) return ""

    const resultado = buildPedidoOficial({
      pedido: {
        nombre: selectedPedido.nombre,
        formatoSalida: selectedPedido.formatoSalida,
        mensajePrevio: selectedPedido.mensajePrevio,
      },
      productos: products,
      stockActual,
    })

    return resultado?.texto || ""
  }, [selectedPedido, products, stockActual])

  return {
    // Estado
    pedidos,
    products,
    selectedPedido,
    loading,
    stockActual,
    productosAPedir,
    
    // Setters
    setSelectedPedido,
    setStockActual,
    
    // Acciones
    createPedido,
    updatePedido,
    deletePedido,
    importProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    clearStock,
    updateProductsOrder,
    calcularPedido,
    generarTextoPedido,
    
    // Funciones de corrección (solo se llaman explícitamente)
    fixProductsOrder,
    fixProductsUnit,
  }
}









