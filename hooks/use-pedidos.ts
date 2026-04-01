"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
  deleteField,
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

export function usePedidos(user: any) {
  const { toast } = useToast()
  const { userData } = useData()
  
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

  // Cargar productos del pedido seleccionado - 100% READ-ONLY
  // NO hace escrituras automáticas. Solo lee desde Firestore.
  const loadProducts = useCallback(async () => {
    if (!user || !db || !selectedPedido) {
      setProducts([])
      return
    }
    
    try {
      if (!ownerId) {
        setProducts([])
        return
      }
      
      const productsQuery = query(
        collection(db, COLLECTIONS.PRODUCTS),
        where("ownerId", "==", ownerId),
        where("pedidoId", "==", selectedPedido.id)
      )
      const snapshot = await getDocs(productsQuery)
      const productsData = snapshot.docs.map((doc) =>
        normalizeProduct({
          id: doc.id,
          ...doc.data(),
        } as Producto)
      )
      
      // Ordenar por orden, y si tienen el mismo orden, alfabéticamente
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
  }, [user, selectedPedido, ownerId, toast])

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
        const productRef = doc(dbInstance, COLLECTIONS.PRODUCTS, product.id)
        batch.update(productRef, {
          orden: maxOrden + index,
          ownerId,
          userId: user.uid,
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
        const productRef = doc(dbInstance, COLLECTIONS.PRODUCTS, product.id)
        batch.update(productRef, {
          unidad: "U",
          ownerId,
          userId: user.uid,
          updatedAt: serverTimestamp(),
        })
      })
      await batch.commit()
      
      // Recargar productos desde Firestore para reflejar cambios
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
  }, [selectedPedido?.id])

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
      
      for (const nombre of nuevos) {
        const docRef = doc(collection(db, COLLECTIONS.PRODUCTS))
        batch.set(docRef, {
          pedidoId: selectedPedido.id,
          nombre,
          stockMinimoUnits: selectedPedido.stockMinimoDefault,
          stockActualUnits: 0,
          unidad: "U",
          unidadBase: "U",
          modoCompra: "unidad",
          orden: nombresMap.get(nombre) ?? maxOrden + nuevos.indexOf(nombre),
          ownerId,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
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
  }, [user, ownerId, selectedPedido, products, loadProducts, toast, canEditarProductos])

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
      const updateData: any = {
        updatedAt: serverTimestamp(),
        ownerId,
        userId: user?.uid,
      }

      if (field === "nombre") {
        if (!value.trim()) {
          toast({ title: "Error", description: "Nombre requerido", variant: "destructive" })
          return false
        }
        updateData.nombre = value.trim()
      } else if (field === "stockMinimo") {
        if (!product) return false
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 0) {
          toast({ title: "Error", description: "Stock inválido", variant: "destructive" })
          return false
        }
        updateData.stockMinimoUnits = normalizeStockMinimoInput(product, num)
        updateData.stockMinimo = deleteField()
      } else if (field === "stockMinimoUnits") {
        if (!product) return false
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 0) {
          toast({ title: "Error", description: "Stock inválido", variant: "destructive" })
          return false
        }
        updateData.stockMinimoUnits = num
        updateData.stockMinimo = deleteField()
      } else if (field === "unidad") {
        updateData.unidad = value.trim() || "U"
        updateData.unidadBase = value.trim() || "U"
      } else if (field === "modoCompra") {
        const modo = value as "unidad" | "pack"
        if (modo !== "unidad" && modo !== "pack") return false
        updateData.modoCompra = modo
        if (modo === "unidad") {
          updateData.cantidadPorPack = deleteField()
        }
      } else if (field === "cantidadPorPack") {
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 2) {
          toast({ title: "Error", description: "Cantidad por pack debe ser al menos 2", variant: "destructive" })
          return false
        }
        updateData.cantidadPorPack = num
      }

      await updateDoc(doc(db, COLLECTIONS.PRODUCTS, productId), updateData)
      await loadProducts()
      return true
    } catch (error: any) {
      logger.error("Error al actualizar producto:", error)
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" })
      return false
    }
  }, [loadProducts, ownerId, products, user, toast, canEditarProductos])

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

      const modo = modoCompra || "unidad"
      const baseUnidad = unidad?.trim() || "U"
      const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
        pedidoId: selectedPedido.id,
        nombre: nombre.trim(),
        stockMinimoUnits: stockMinimo ?? selectedPedido.stockMinimoDefault,
        stockActualUnits: 0,
        unidad: baseUnidad,
        unidadBase: baseUnidad,
        modoCompra: modo,
        ...(modo === "pack" && cantidadPorPack != null && cantidadPorPack > 1
          ? { cantidadPorPack }
          : {}),
        orden: maxOrden,
        ownerId,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      await loadProducts()
      
      toast({ title: "Producto creado", description: `Se ha agregado "${nombre.trim()}"` })
      
      return docRef.id
    } catch (error: any) {
      logger.error("Error al crear producto:", error)
      toast({ title: "Error", description: "No se pudo crear el producto", variant: "destructive" })
      return null
    }
  }, [user, ownerId, selectedPedido, products, loadProducts, toast, canEditarProductos])

  // Eliminar producto
  const deleteProduct = useCallback(async (productId: string) => {
    if (!db) return false
    if (!canEditarProductos) {
      toast({ title: "Error", description: "No tienes permisos para editar productos", variant: "destructive" })
      return false
    }
    
    try {
      await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productId))
      setStockActual(prev => {
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
  }, [loadProducts, toast, canEditarProductos])

  // Limpiar stock
  const clearStock = useCallback(async () => {
    if (!db || !ownerId || !user?.uid) return false
    if (!canEditarProductos) {
      toast({ title: "Error", description: "No tienes permisos para editar productos", variant: "destructive" })
      return false
    }

    try {
      const dbInstance = db // TypeScript ahora sabe que db no es undefined
      const batch = writeBatch(dbInstance)
      products.forEach((product) => {
        batch.update(doc(dbInstance, COLLECTIONS.PRODUCTS, product.id), {
          stockActualUnits: 0,
          stockActual: deleteField(),
          updatedAt: serverTimestamp(),
          ownerId,
          userId: user.uid,
        })
      })

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
  }, [db, ownerId, products, toast, user, canEditarProductos])

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
        const productRef = doc(dbInstance, COLLECTIONS.PRODUCTS, productId)
        batch.update(productRef, {
          orden: index,
          ownerId,
          userId: user?.uid,
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

  // Actualizar estado del pedido
  const updatePedidoEstado = useCallback(async (
    pedidoId: string,
    estado: "creado" | "enviado" | "recibido" | "completado",
    fechaEnvio?: Date,
    fechaRecepcion?: Date
  ) => {
    if (!db) return false
    if (!ownerId) return false
    if (!canEditarPedido) {
      toast({ title: "Error", description: "No tienes permisos para editar pedidos", variant: "destructive" })
      return false
    }

    try {
      const updateData: any = {
        estado,
        ownerId,
        userId: user?.uid,
        updatedAt: serverTimestamp(),
      }
      
      if (fechaEnvio) {
        updateData.fechaEnvio = fechaEnvio
      }
      if (fechaRecepcion) {
        updateData.fechaRecepcion = fechaRecepcion
      }

      // Primero escribir en Firestore - solo actualizar estado local si la escritura es exitosa
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId), updateData)
      
      // Solo actualizar estado local DESPUÉS de confirmar la escritura exitosa
      // El listener de onSnapshot también actualizará, pero esto mejora la UX
      setPedidos(prev => prev.map(p => 
        p.id === pedidoId 
          ? { ...p, estado, fechaEnvio, fechaRecepcion }
          : p
      ))
      
      if (selectedPedido?.id === pedidoId) {
        setSelectedPedido(prev => prev ? { ...prev, estado, fechaEnvio, fechaRecepcion } : null)
      }

      return true
    } catch (error: any) {
      logger.error("Error al actualizar estado del pedido:", error)
      // No actualizar estado local - el listener de onSnapshot mantendrá el estado correcto
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      })
      return false
    }
  }, [ownerId, user, selectedPedido, toast, canEditarPedido])

  // Actualizar remito de envío
  const updateRemitoEnvio = useCallback(async (
    pedidoId: string,
    remitoEnvioId: string
  ) => {
    if (!db) return false
    if (!ownerId) return false
    if (!canEditarPedido) {
      toast({ title: "Error", description: "No tienes permisos para editar pedidos", variant: "destructive" })
      return false
    }

    try {
      // Primero escribir en Firestore - solo actualizar estado local si la escritura es exitosa
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId), {
        remitoEnvioId,
        ownerId,
        userId: user?.uid,
        updatedAt: serverTimestamp(),
      })
      
      // Solo actualizar estado local DESPUÉS de confirmar la escritura exitosa
      // El listener de onSnapshot también actualizará, pero esto mejora la UX
      setPedidos(prev => prev.map(p => 
        p.id === pedidoId ? { ...p, remitoEnvioId } : p
      ))
      
      if (selectedPedido?.id === pedidoId) {
        setSelectedPedido(prev => prev ? { ...prev, remitoEnvioId } : null)
      }

      return true
    } catch (error: any) {
      logger.error("Error al actualizar remito de envío:", error)
      // No actualizar estado local - el listener de onSnapshot mantendrá el estado correcto
      return false
    }
  }, [ownerId, user, selectedPedido, toast, canEditarPedido])

  // Actualizar enlace público
  const updateEnlacePublico = useCallback(async (
    pedidoId: string,
    enlacePublicoId: string
  ) => {
    if (!db) return false
    if (!ownerId) return false
    if (!canEditarPedido) {
      toast({ title: "Error", description: "No tienes permisos para editar pedidos", variant: "destructive" })
      return false
    }

    try {
      // Primero escribir en Firestore - solo actualizar estado local si la escritura es exitosa
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId), {
        enlacePublicoId,
        ownerId,
        userId: user?.uid,
        updatedAt: serverTimestamp(),
      })
      
      // Solo actualizar estado local DESPUÉS de confirmar la escritura exitosa
      // El listener de onSnapshot también actualizará, pero esto mejora la UX
      setPedidos(prev => prev.map(p => 
        p.id === pedidoId ? { ...p, enlacePublicoId } : p
      ))
      
      if (selectedPedido?.id === pedidoId) {
        setSelectedPedido(prev => prev ? { ...prev, enlacePublicoId } : null)
      }

      return true
    } catch (error: any) {
      logger.error("Error al actualizar enlace público:", error)
      // No actualizar estado local - el listener de onSnapshot mantendrá el estado correcto
      return false
    }
  }, [ownerId, user, selectedPedido, toast, canEditarPedido])

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
    updatePedidoEstado,
    updateRemitoEnvio,
    updateEnlacePublico,
    
    // Funciones de corrección (solo se llaman explícitamente)
    fixProductsOrder,
    fixProductsUnit,
  }
}









