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
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { Pedido, Producto } from "@/lib/types"

const DEFAULT_FORMAT = "{nombre} ({cantidad})"

export function usePedidos(user: any) {
  const { toast } = useToast()
  
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [products, setProducts] = useState<Producto[]>([])
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)
  const [stockActual, setStockActual] = useState<Record<string, number>>({})

  // Cargar pedidos
  const loadPedidos = useCallback(async () => {
    if (!user || !db) return
    
    try {
      const pedidosQuery = query(
        collection(db, COLLECTIONS.PEDIDOS),
        where("userId", "==", user.uid)
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
  }, [user, selectedPedido, toast])

  // Cargar productos del pedido seleccionado
  const loadProducts = useCallback(async () => {
    if (!user || !db || !selectedPedido) {
      setProducts([])
      return
    }
    
    try {
      const productsQuery = query(
        collection(db, COLLECTIONS.PRODUCTS),
        where("userId", "==", user.uid),
        where("pedidoId", "==", selectedPedido.id)
      )
      const snapshot = await getDocs(productsQuery)
      const productsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Producto[]
      
      productsData.sort((a, b) => a.nombre.localeCompare(b.nombre))
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
    
    if (!nombre.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
      return null
    }

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.PEDIDOS), {
        nombre: nombre.trim(),
        stockMinimoDefault,
        formatoSalida: formatoSalida || DEFAULT_FORMAT,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      
      const newPedido: Pedido = {
        id: docRef.id,
        nombre: nombre.trim(),
        stockMinimoDefault,
        formatoSalida: formatoSalida || DEFAULT_FORMAT,
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
  }, [user, toast])

  // Actualizar pedido
  const updatePedido = useCallback(async (nombre: string, stockMinimoDefault: number, formatoSalida: string) => {
    if (!db || !selectedPedido) return false

    try {
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id), {
        nombre: nombre.trim(),
        stockMinimoDefault,
        formatoSalida: formatoSalida || DEFAULT_FORMAT,
        updatedAt: serverTimestamp(),
      })
      
      const updatedPedido = { ...selectedPedido, nombre: nombre.trim(), stockMinimoDefault, formatoSalida }
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
      const batch = writeBatch(db)
      for (const nombre of nuevos) {
        const docRef = doc(collection(db, COLLECTIONS.PRODUCTS))
        batch.set(docRef, {
          pedidoId: selectedPedido.id,
          nombre,
          stockMinimo: selectedPedido.stockMinimoDefault,
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
  }, [user, selectedPedido, products, loadProducts, toast])

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
        updateData.unidad = value.trim() || null
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
    
    return `📦 ${selectedPedido.nombre}\n\n${lineas.join("\n")}\n\nTotal: ${productosAPedir.length} productos`
  }, [selectedPedido, productosAPedir, stockActual, calcularPedido])

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
    updateProduct,
    deleteProduct,
    clearStock,
    calcularPedido,
    generarTextoPedido,
  }
}

