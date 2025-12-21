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
  writeBatch,
  onSnapshot,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { Pedido, Producto } from "@/lib/types"
import { useData } from "@/contexts/data-context"

const DEFAULT_FORMAT = "{nombre} ({cantidad})"

export function usePedidos(user: any) {
  const { toast } = useToast()
  const { userData } = useData()
  
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [products, setProducts] = useState<Producto[]>([])
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)
  const [stockActual, setStockActual] = useState<Record<string, number>>({})

  // Cargar pedidos
  const loadPedidos = useCallback(async () => {
    if (!user || !db) return
    
    try {
      // Si el usuario es invitado, cargar pedidos del ownerId
      // Si no, cargar pedidos del userId normal
      const userIdToQuery = userData?.role === "invited" && userData?.ownerId 
        ? userData.ownerId 
        : user.uid
      
      const pedidosQuery = query(
        collection(db, COLLECTIONS.PEDIDOS),
        where("userId", "==", userIdToQuery)
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
  }, [user, userData, selectedPedido, toast])

  // Cargar productos del pedido seleccionado
  const loadProducts = useCallback(async () => {
    if (!user || !db || !selectedPedido) {
      setProducts([])
      return
    }
    
    try {
      // Si el usuario es invitado, usar ownerId para cargar productos
      const userIdToQuery = userData?.role === "invited" && userData?.ownerId 
        ? userData.ownerId 
        : user.uid
      
      const productsQuery = query(
        collection(db, COLLECTIONS.PRODUCTS),
        where("userId", "==", userIdToQuery),
        where("pedidoId", "==", selectedPedido.id)
      )
      const snapshot = await getDocs(productsQuery)
      const productsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Producto[]
      
      // Identificar productos sin orden o sin unidad (productos antiguos)
      const productosSinOrden = productsData.filter(p => p.orden === undefined)
      const productosSinUnidad = productsData.filter(p => !p.unidad || p.unidad.trim() === "")
      
      // Si hay productos sin orden, asignarles uno basado en orden alfabético
      if (productosSinOrden.length > 0 && db) {
        const dbInstance = db // TypeScript ahora sabe que db no es undefined
        // Ordenar alfabéticamente primero
        const productosConOrden = productsData.filter(p => p.orden !== undefined)
        productosSinOrden.sort((a, b) => a.nombre.localeCompare(b.nombre))
        
        // Calcular el orden inicial (máximo orden existente + 1, o 0)
        const maxOrden = productosConOrden.length > 0
          ? Math.max(...productosConOrden.map(p => p.orden ?? 0), -1) + 1
          : 0
        
        // Asignar orden a productos sin orden
        productosSinOrden.forEach((product, index) => {
          product.orden = maxOrden + index
        })
        
        // Guardar el orden en la base de datos
        const batch = writeBatch(dbInstance)
        productosSinOrden.forEach((product) => {
          const productRef = doc(dbInstance, COLLECTIONS.PRODUCTS, product.id)
          batch.update(productRef, {
            orden: product.orden,
            updatedAt: serverTimestamp(),
          })
        })
        await batch.commit()
      }
      
      // Si hay productos sin unidad, asignarles "U" como valor por defecto
      if (productosSinUnidad.length > 0 && db) {
        const dbInstance = db // TypeScript ahora sabe que db no es undefined
        const batch = writeBatch(dbInstance)
        productosSinUnidad.forEach((product) => {
          const productRef = doc(dbInstance, COLLECTIONS.PRODUCTS, product.id)
          batch.update(productRef, {
            unidad: "U",
            updatedAt: serverTimestamp(),
          })
          product.unidad = "U"
        })
        await batch.commit()
      }
      
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
    } catch (error: any) {
      logger.error("Error al cargar productos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      })
    }
  }, [user, selectedPedido, toast])

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
      setStockActual({})
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
  const calcularPedido = useCallback((stockMinimo: number, stockActualValue: number | undefined): number => {
    const actual = stockActualValue ?? 0
    return Math.max(0, stockMinimo - actual)
  }, [])

  // Productos con pedido > 0
  const productosAPedir = useMemo(() => {
    return products.filter(p => calcularPedido(p.stockMinimo, stockActual[p.id]) > 0)
  }, [products, stockActual, calcularPedido])

  // Crear pedido
  const createPedido = useCallback(async (nombre: string, stockMinimoDefault: number, formatoSalida: string) => {
    if (!db || !user) return null
    
    // Los usuarios invitados no pueden crear pedidos
    if (userData?.role === "invited") {
      toast({ title: "Error", description: "Los usuarios invitados no pueden crear pedidos", variant: "destructive" })
      return null
    }
    
    if (!nombre.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
      return null
    }

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.PEDIDOS), {
        nombre: nombre.trim(),
        stockMinimoDefault,
        formatoSalida: formatoSalida || DEFAULT_FORMAT,
        estado: "creado",
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
  }, [user, userData, toast])

  // Actualizar pedido
  const updatePedido = useCallback(async (nombre: string, stockMinimoDefault: number, formatoSalida: string, mensajePrevio?: string, sheetUrl?: string) => {
    if (!db || !selectedPedido) return false

    try {
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id), {
        nombre: nombre.trim(),
        stockMinimoDefault,
        formatoSalida: formatoSalida || DEFAULT_FORMAT,
        mensajePrevio: mensajePrevio ?? selectedPedido.mensajePrevio ?? null,
        sheetUrl: sheetUrl !== undefined ? (sheetUrl.trim() || null) : selectedPedido.sheetUrl ?? null,
        updatedAt: serverTimestamp(),
      })
      
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
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" })
      return false
    }
  }, [selectedPedido, toast])

  // Eliminar pedido
  const deletePedido = useCallback(async () => {
    if (!db || !selectedPedido) return false

    try {
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
  }, [selectedPedido, products, pedidos, toast])

  // Importar productos
  const importProducts = useCallback(async (text: string) => {
    if (!db || !user || !selectedPedido) return false

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

      // Si el usuario es invitado, usar ownerId para crear productos
      const userIdToUse = userData?.role === "invited" && userData?.ownerId 
        ? userData.ownerId 
        : user.uid
      
      for (const nombre of nuevos) {
        const docRef = doc(collection(db, COLLECTIONS.PRODUCTS))
        batch.set(docRef, {
          pedidoId: selectedPedido.id,
          nombre,
          stockMinimo: selectedPedido.stockMinimoDefault,
          unidad: "U",
          orden: nombresMap.get(nombre) ?? maxOrden + nuevos.indexOf(nombre),
          userId: userIdToUse,
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
  }, [user, userData, selectedPedido, products, loadProducts, toast])

  // Actualizar producto
  const updateProduct = useCallback(async (productId: string, field: string, value: string) => {
    if (!db) return false

    try {
      const updateData: any = { updatedAt: serverTimestamp() }

      if (field === "nombre") {
        if (!value.trim()) {
          toast({ title: "Error", description: "Nombre requerido", variant: "destructive" })
          return false
        }
        updateData.nombre = value.trim()
      } else if (field === "stockMinimo") {
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 0) {
          toast({ title: "Error", description: "Stock inválido", variant: "destructive" })
          return false
        }
        updateData.stockMinimo = num
      } else if (field === "unidad") {
        updateData.unidad = value.trim() || "U"
      }

      await updateDoc(doc(db, COLLECTIONS.PRODUCTS, productId), updateData)
      await loadProducts()
      return true
    } catch (error: any) {
      logger.error("Error al actualizar producto:", error)
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" })
      return false
    }
  }, [loadProducts, toast])

  // Crear producto individual
  const createProduct = useCallback(async (nombre: string, stockMinimo?: number, unidad?: string) => {
    if (!db || !user || !selectedPedido) return null

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

      // Si el usuario es invitado, usar ownerId para crear productos
      const userIdToUse = userData?.role === "invited" && userData?.ownerId 
        ? userData.ownerId 
        : user.uid

      const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
        pedidoId: selectedPedido.id,
        nombre: nombre.trim(),
        stockMinimo: stockMinimo ?? selectedPedido.stockMinimoDefault,
        unidad: unidad?.trim() || "U",
        orden: maxOrden,
        userId: userIdToUse,
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
  }, [user, userData, selectedPedido, products, loadProducts, toast])

  // Eliminar producto
  const deleteProduct = useCallback(async (productId: string) => {
    if (!db) return false
    
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
  }, [loadProducts, toast])

  // Limpiar stock
  const clearStock = useCallback(() => {
    setStockActual({})
    toast({ title: "Stock limpiado" })
  }, [toast])

  // Actualizar orden de productos
  const updateProductsOrder = useCallback(async (newOrder: string[]) => {
    if (!db) return false

    try {
      const dbInstance = db // TypeScript ahora sabe que db no es undefined
      const batch = writeBatch(dbInstance)
      
      newOrder.forEach((productId, index) => {
        const productRef = doc(dbInstance, COLLECTIONS.PRODUCTS, productId)
        batch.update(productRef, {
          orden: index,
          updatedAt: serverTimestamp(),
        })
      })
      
      await batch.commit()
      
      // Actualizar estado local sin recargar desde Firestore para mejor UX
      setProducts(prev => {
        const ordered = newOrder.map(id => prev.find(p => p.id === id)!).filter(Boolean)
        return ordered.map((p, index) => ({ ...p, orden: index }))
      })
      
      return true
    } catch (error: any) {
      logger.error("Error al actualizar orden:", error)
      toast({ 
        title: "Error", 
        description: "No se pudo actualizar el orden", 
        variant: "destructive" 
      })
      // Recargar productos en caso de error
      await loadProducts()
      return false
    }
  }, [db, loadProducts, toast])

  // Generar texto del pedido
  const generarTextoPedido = useCallback((): string => {
    if (!selectedPedido) return ""
    
    const lineas = productosAPedir.map(p => {
      const cantidad = calcularPedido(p.stockMinimo, stockActual[p.id])
      let texto = selectedPedido.formatoSalida
      texto = texto.replace(/{nombre}/g, p.nombre)
      texto = texto.replace(/{cantidad}/g, cantidad.toString())
      texto = texto.replace(/{unidad}/g, p.unidad || "")
      return texto.trim()
    })
    
    // Usar mensaje previo personalizado o el default con emoji
    const encabezado = selectedPedido.mensajePrevio?.trim() || `📦 ${selectedPedido.nombre}`
    
    return `${encabezado}\n\n${lineas.join("\n")}\n\nTotal: ${productosAPedir.length} productos`
  }, [selectedPedido, productosAPedir, stockActual, calcularPedido])

  // Actualizar estado del pedido
  const updatePedidoEstado = useCallback(async (
    pedidoId: string,
    estado: "creado" | "enviado" | "recibido" | "completado",
    fechaEnvio?: Date,
    fechaRecepcion?: Date
  ) => {
    if (!db) return false

    try {
      const updateData: any = {
        estado,
        updatedAt: serverTimestamp(),
      }
      
      if (fechaEnvio) {
        updateData.fechaEnvio = fechaEnvio
      }
      if (fechaRecepcion) {
        updateData.fechaRecepcion = fechaRecepcion
      }

      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId), updateData)
      
      // Actualizar estado local
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
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      })
      return false
    }
  }, [selectedPedido, toast])

  // Actualizar remito de envío
  const updateRemitoEnvio = useCallback(async (
    pedidoId: string,
    remitoEnvioId: string
  ) => {
    if (!db) return false

    try {
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId), {
        remitoEnvioId,
        updatedAt: serverTimestamp(),
      })
      
      setPedidos(prev => prev.map(p => 
        p.id === pedidoId ? { ...p, remitoEnvioId } : p
      ))
      
      if (selectedPedido?.id === pedidoId) {
        setSelectedPedido(prev => prev ? { ...prev, remitoEnvioId } : null)
      }

      return true
    } catch (error: any) {
      logger.error("Error al actualizar remito de envío:", error)
      return false
    }
  }, [selectedPedido])

  // Actualizar enlace público
  const updateEnlacePublico = useCallback(async (
    pedidoId: string,
    enlacePublicoId: string
  ) => {
    if (!db) return false

    try {
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId), {
        enlacePublicoId,
        updatedAt: serverTimestamp(),
      })
      
      setPedidos(prev => prev.map(p => 
        p.id === pedidoId ? { ...p, enlacePublicoId } : p
      ))
      
      if (selectedPedido?.id === pedidoId) {
        setSelectedPedido(prev => prev ? { ...prev, enlacePublicoId } : null)
      }

      return true
    } catch (error: any) {
      logger.error("Error al actualizar enlace público:", error)
      return false
    }
  }, [selectedPedido])

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
  }
}

