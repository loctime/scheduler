"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
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
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Plus, Trash2, Copy, MessageCircle, RotateCcw, Upload, Package, 
  AlertTriangle, Settings, ChevronLeft, FileText, Edit2, Construction
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { Skeleton } from "@/components/ui/skeleton"
import { logger } from "@/lib/logger"
import { Pedido, Producto } from "@/lib/types"
import { cn } from "@/lib/utils"

// Formato de ejemplo por defecto
const DEFAULT_FORMAT = "{nombre} ({cantidad})"
const FORMAT_EXAMPLES = [
  { format: "{nombre} ({cantidad})", example: "Leche (8)" },
  { format: "{cantidad} - {nombre}", example: "8 - Leche" },
  { format: "({cantidad}) {nombre}", example: "(8) Leche" },
  { format: "• {nombre}: {cantidad} {unidad}", example: "• Leche: 8 litros" },
  { format: "{nombre} x{cantidad}", example: "Leche x8" },
]

export default function PedidosPage() {
  const { user } = useData()
  const { toast } = useToast()
  
  // Estados principales
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [products, setProducts] = useState<Producto[]>([])
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Dialogs
  const [createPedidoOpen, setCreatePedidoOpen] = useState(false)
  const [editPedidoOpen, setEditPedidoOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deletePedidoDialogOpen, setDeletePedidoDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  
  // Form states
  const [newPedidoName, setNewPedidoName] = useState("")
  const [newPedidoStockMin, setNewPedidoStockMin] = useState("1")
  const [newPedidoFormat, setNewPedidoFormat] = useState(DEFAULT_FORMAT)
  const [importText, setImportText] = useState("")
  
  // Estados para stock actual (no se guarda en Firebase, solo temporal)
  const [stockActual, setStockActual] = useState<Record<string, number>>({})
  
  // Estados para edición inline
  const [editingField, setEditingField] = useState<{id: string, field: string} | null>(null)
  const [inlineValue, setInlineValue] = useState("")

  // Cargar pedidos desde Firebase
  const loadPedidos = async () => {
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
      
      // Si hay pedidos y ninguno seleccionado, seleccionar el primero
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
  }

  // Cargar productos del pedido seleccionado
  const loadProducts = async () => {
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
  }

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
      setStockActual({}) // Limpiar stock al cambiar de pedido
    }
  }, [selectedPedido?.id])

  // Calcular pedido recomendado
  const calcularPedido = (stockMinimo: number, stockActualValue: number | undefined): number => {
    const actual = stockActualValue ?? 0
    return Math.max(0, stockMinimo - actual)
  }

  // Productos con pedido > 0
  const productosAPedir = useMemo(() => {
    return products.filter(p => {
      const pedido = calcularPedido(p.stockMinimo, stockActual[p.id])
      return pedido > 0
    })
  }, [products, stockActual])

  // Crear nuevo pedido
  const handleCreatePedido = async () => {
    if (!db || !user) return
    
    if (!newPedidoName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del pedido es requerido",
        variant: "destructive",
      })
      return
    }

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.PEDIDOS), {
        nombre: newPedidoName.trim(),
        stockMinimoDefault: parseInt(newPedidoStockMin, 10) || 1,
        formatoSalida: newPedidoFormat || DEFAULT_FORMAT,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      
      const newPedido: Pedido = {
        id: docRef.id,
        nombre: newPedidoName.trim(),
        stockMinimoDefault: parseInt(newPedidoStockMin, 10) || 1,
        formatoSalida: newPedidoFormat || DEFAULT_FORMAT,
        userId: user.uid,
      }
      
      setPedidos(prev => [...prev, newPedido].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setSelectedPedido(newPedido)
      
      setCreatePedidoOpen(false)
      setNewPedidoName("")
      setNewPedidoStockMin("1")
      setNewPedidoFormat(DEFAULT_FORMAT)
      
      toast({
        title: "Pedido creado",
        description: `Se ha creado el pedido "${newPedido.nombre}"`,
      })
    } catch (error: any) {
      logger.error("Error al crear pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo crear el pedido",
        variant: "destructive",
      })
    }
  }

  // Actualizar pedido
  const handleUpdatePedido = async () => {
    if (!db || !selectedPedido) return

    try {
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id), {
        nombre: newPedidoName.trim(),
        stockMinimoDefault: parseInt(newPedidoStockMin, 10) || 1,
        formatoSalida: newPedidoFormat || DEFAULT_FORMAT,
        updatedAt: serverTimestamp(),
      })
      
      const updatedPedido = {
        ...selectedPedido,
        nombre: newPedidoName.trim(),
        stockMinimoDefault: parseInt(newPedidoStockMin, 10) || 1,
        formatoSalida: newPedidoFormat || DEFAULT_FORMAT,
      }
      
      setPedidos(prev => prev.map(p => p.id === selectedPedido.id ? updatedPedido : p))
      setSelectedPedido(updatedPedido)
      
      setEditPedidoOpen(false)
      
      toast({
        title: "Pedido actualizado",
        description: "Los cambios se han guardado",
      })
    } catch (error: any) {
      logger.error("Error al actualizar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el pedido",
        variant: "destructive",
      })
    }
  }

  // Eliminar pedido y sus productos
  const handleDeletePedido = async () => {
    if (!db || !selectedPedido) return

    try {
      const batch = writeBatch(db)
      
      // Eliminar todos los productos del pedido
      for (const product of products) {
        batch.delete(doc(db, COLLECTIONS.PRODUCTS, product.id))
      }
      
      // Eliminar el pedido
      batch.delete(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id))
      
      await batch.commit()
      
      setPedidos(prev => prev.filter(p => p.id !== selectedPedido.id))
      setSelectedPedido(pedidos.length > 1 ? pedidos.find(p => p.id !== selectedPedido.id) || null : null)
      setProducts([])
      setDeletePedidoDialogOpen(false)
      
      toast({
        title: "Pedido eliminado",
        description: "El pedido y sus productos han sido eliminados",
      })
    } catch (error: any) {
      logger.error("Error al eliminar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el pedido",
        variant: "destructive",
      })
    }
  }

  // Detectar formato y parsear lista de productos
  const parseProductList = (text: string): string[] => {
    const lines = text.split("\n").filter(line => line.trim())
    const productos: string[] = []
    
    for (const line of lines) {
      let nombre = line
      
      if (line.includes("\t")) {
        nombre = line.split("\t")[0]
      } else if (line.includes(";")) {
        nombre = line.split(";")[0]
      } else if (line.includes(",")) {
        const parts = line.split(",")
        if (parts.length > 1 && parts[1].trim()) {
          nombre = parts[0]
        }
      }
      
      nombre = nombre.trim()
      if (nombre) {
        productos.push(nombre)
      }
    }
    
    return productos
  }

  // Importar productos
  const handleImport = async () => {
    if (!db || !user || !selectedPedido) return

    const nombresImportados = parseProductList(importText)
    
    if (nombresImportados.length === 0) {
      toast({
        title: "Error",
        description: "No se encontraron productos para importar",
        variant: "destructive",
      })
      return
    }

    const existingNames = products.map(p => p.nombre.toLowerCase())
    const nuevosNombres = nombresImportados.filter(
      nombre => !existingNames.includes(nombre.toLowerCase())
    )

    if (nuevosNombres.length === 0) {
      toast({
        title: "Información",
        description: "Todos los productos ya existen en la lista",
      })
      setImportDialogOpen(false)
      setImportText("")
      return
    }

    try {
      const batch = writeBatch(db)
      
      for (const nombre of nuevosNombres) {
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
        title: "Productos importados",
        description: `Se importaron ${nuevosNombres.length} productos${
          nombresImportados.length !== nuevosNombres.length 
            ? ` (${nombresImportados.length - nuevosNombres.length} ya existían)` 
            : ""
        }`,
      })
      
      setImportDialogOpen(false)
      setImportText("")
      await loadProducts()
    } catch (error: any) {
      logger.error("Error al importar productos:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al importar los productos",
        variant: "destructive",
      })
    }
  }

  // Guardar cambios inline
  const handleInlineSave = async (productId: string, field: string, value: string) => {
    if (!db) return

    try {
      const updateData: any = { updatedAt: serverTimestamp() }

      if (field === "nombre") {
        if (!value.trim()) {
          toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
          setEditingField(null)
          return
        }
        updateData.nombre = value.trim()
      } else if (field === "stockMinimo") {
        const numValue = parseInt(value, 10)
        if (isNaN(numValue) || numValue < 0) {
          toast({ title: "Error", description: "Stock mínimo inválido", variant: "destructive" })
          setEditingField(null)
          return
        }
        updateData.stockMinimo = numValue
      } else if (field === "unidad") {
        updateData.unidad = value.trim() || null
      }

      await updateDoc(doc(db, COLLECTIONS.PRODUCTS, productId), updateData)
      await loadProducts()
      setEditingField(null)
      setInlineValue("")
    } catch (error: any) {
      logger.error("Error al actualizar producto:", error)
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" })
      setEditingField(null)
    }
  }

  // Eliminar producto
  const handleDeleteProduct = async (productId: string) => {
    if (!db) return
    
    try {
      await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productId))
      setStockActual(prev => {
        const newState = { ...prev }
        delete newState[productId]
        return newState
      })
      await loadProducts()
      toast({ title: "Producto eliminado" })
    } catch (error: any) {
      logger.error("Error al eliminar producto:", error)
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" })
    }
  }

  // Limpiar stock actual
  const handleClearStock = () => {
    setStockActual({})
    setClearDialogOpen(false)
    toast({ title: "Stock limpiado" })
  }

  // Aplicar formato al texto del pedido
  const aplicarFormato = (producto: Producto, cantidad: number): string => {
    if (!selectedPedido) return ""
    
    let texto = selectedPedido.formatoSalida
    texto = texto.replace(/{nombre}/g, producto.nombre)
    texto = texto.replace(/{cantidad}/g, cantidad.toString())
    texto = texto.replace(/{unidad}/g, producto.unidad || "")
    
    return texto.trim()
  }

  // Generar texto del pedido
  const generarTextoPedido = (): string => {
    if (!selectedPedido) return ""
    
    const lineas = productosAPedir.map(p => {
      const cantidad = calcularPedido(p.stockMinimo, stockActual[p.id])
      return aplicarFormato(p, cantidad)
    })
    
    return `📦 ${selectedPedido.nombre}\n\n${lineas.join("\n")}\n\nTotal: ${productosAPedir.length} productos`
  }

  // Copiar pedido
  const handleCopyPedido = async () => {
    if (productosAPedir.length === 0) {
      toast({ title: "Sin pedidos", description: "No hay productos que pedir" })
      return
    }

    try {
      await navigator.clipboard.writeText(generarTextoPedido())
      toast({ title: "Copiado", description: "Pedido copiado al portapapeles" })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo copiar", variant: "destructive" })
    }
  }

  // Enviar por WhatsApp
  const handleWhatsApp = () => {
    if (productosAPedir.length === 0) {
      toast({ title: "Sin pedidos", description: "No hay productos que pedir" })
      return
    }

    const encoded = encodeURIComponent(generarTextoPedido())
    window.open(`https://wa.me/?text=${encoded}`, "_blank")
  }

  // Abrir dialog de edición
  const openEditDialog = () => {
    if (!selectedPedido) return
    setNewPedidoName(selectedPedido.nombre)
    setNewPedidoStockMin(selectedPedido.stockMinimoDefault.toString())
    setNewPedidoFormat(selectedPedido.formatoSalida)
    setEditPedidoOpen(true)
  }

  // Vista cuando no hay pedidos seleccionados
  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      {/* Banner de desarrollo */}
      <div className="mb-6 rounded-lg border-2 border-dashed border-amber-500/50 bg-amber-500/10 p-4">
        <div className="flex items-center gap-3">
          <Construction className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-300">
              🚧 Página en desarrollo
            </p>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
              Esta funcionalidad está en construcción. Algunas características pueden cambiar o no estar disponibles.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Sidebar - Lista de pedidos */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Mis Pedidos</CardTitle>
                <Button size="sm" onClick={() => {
                  setNewPedidoName("")
                  setNewPedidoStockMin("1")
                  setNewPedidoFormat(DEFAULT_FORMAT)
                  setCreatePedidoOpen(true)
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              {pedidos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tienes pedidos</p>
                  <Button 
                    variant="link" 
                    size="sm"
                    onClick={() => setCreatePedidoOpen(true)}
                  >
                    Crear primer pedido
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {pedidos.map(pedido => (
                    <button
                      key={pedido.id}
                      onClick={() => setSelectedPedido(pedido)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md transition-colors",
                        "hover:bg-accent",
                        selectedPedido?.id === pedido.id 
                          ? "bg-accent text-accent-foreground" 
                          : "text-muted-foreground"
                      )}
                    >
                      <div className="font-medium truncate">{pedido.nombre}</div>
                      <div className="text-xs opacity-70">
                        Stock mín: {pedido.stockMinimoDefault}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 space-y-6">
          {!selectedPedido ? (
            <Card className="border-border bg-card">
              <CardContent className="py-16 text-center">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Selecciona o crea un pedido</h3>
                <p className="text-muted-foreground mb-4">
                  Crea pedidos para organizar tus listas de productos
                </p>
                <Button onClick={() => setCreatePedidoOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Pedido
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Header del pedido */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{selectedPedido.nombre}</h2>
                  <p className="text-sm text-muted-foreground">
                    Formato: <code className="bg-muted px-1 rounded">{selectedPedido.formatoSalida}</code>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={openEditDialog}>
                    <Settings className="h-4 w-4 mr-1" />
                    Configurar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                    <Upload className="h-4 w-4 mr-1" />
                    Importar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletePedidoDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Acciones de pedido */}
              {products.length > 0 && (
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Generar Pedido
                    </CardTitle>
                    <CardDescription>
                      {productosAPedir.length > 0 
                        ? `${productosAPedir.length} producto${productosAPedir.length !== 1 ? "s" : ""} para pedir`
                        : "Stock completo - no hay productos que pedir"
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleCopyPedido} disabled={productosAPedir.length === 0}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar Pedido
                      </Button>
                      <Button 
                        onClick={handleWhatsApp} 
                        disabled={productosAPedir.length === 0}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        WhatsApp
                      </Button>
                      <Button variant="outline" onClick={() => setClearDialogOpen(true)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Limpiar Stock
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabla de productos */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Productos</CardTitle>
                  <CardDescription>
                    {products.length > 0 
                      ? `${products.length} productos en este pedido`
                      : "Importa productos para comenzar"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {products.length === 0 ? (
                    <div className="py-12 text-center">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">No hay productos en este pedido</p>
                      <Button onClick={() => setImportDialogOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Importar Productos
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-center w-24">Stock Mín.</TableHead>
                            <TableHead className="text-center w-24">Stock Actual</TableHead>
                            <TableHead className="text-center w-24">Pedido</TableHead>
                            <TableHead className="text-center w-20">Unidad</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((product) => {
                            const isEditing = editingField?.id === product.id
                            const editingThisField = isEditing && editingField?.field
                            const pedidoCalculado = calcularPedido(product.stockMinimo, stockActual[product.id])
                            
                            return (
                              <TableRow 
                                key={product.id} 
                                className={pedidoCalculado > 0 ? "bg-amber-500/10" : ""}
                              >
                                <TableCell className="font-medium">
                                  {editingThisField === "nombre" ? (
                                    <Input
                                      value={inlineValue}
                                      onChange={(e) => setInlineValue(e.target.value)}
                                      onBlur={() => handleInlineSave(product.id, "nombre", inlineValue)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleInlineSave(product.id, "nombre", inlineValue)
                                        if (e.key === "Escape") { setEditingField(null); setInlineValue("") }
                                      }}
                                      autoFocus
                                      className="h-8"
                                    />
                                  ) : (
                                    <div
                                      onClick={() => { setEditingField({ id: product.id, field: "nombre" }); setInlineValue(product.nombre) }}
                                      className="cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2"
                                    >
                                      {product.nombre}
                                    </div>
                                  )}
                                </TableCell>
                                
                                <TableCell className="text-center">
                                  {editingThisField === "stockMinimo" ? (
                                    <Input
                                      type="number"
                                      min="0"
                                      value={inlineValue}
                                      onChange={(e) => setInlineValue(e.target.value)}
                                      onBlur={() => handleInlineSave(product.id, "stockMinimo", inlineValue)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleInlineSave(product.id, "stockMinimo", inlineValue)
                                        if (e.key === "Escape") { setEditingField(null); setInlineValue("") }
                                      }}
                                      autoFocus
                                      className="h-8 w-16 mx-auto text-center"
                                    />
                                  ) : (
                                    <div
                                      onClick={() => { setEditingField({ id: product.id, field: "stockMinimo" }); setInlineValue(product.stockMinimo.toString()) }}
                                      className="cursor-pointer hover:bg-muted rounded px-2 py-1 inline-block"
                                    >
                                      {product.stockMinimo}
                                    </div>
                                  )}
                                </TableCell>
                                
                                <TableCell className="text-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={stockActual[product.id] ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setStockActual(prev => ({
                                        ...prev,
                                        [product.id]: val === "" ? 0 : parseInt(val, 10) || 0
                                      }))
                                    }}
                                    placeholder="0"
                                    className="h-8 w-16 mx-auto text-center"
                                  />
                                </TableCell>
                                
                                <TableCell className="text-center">
                                  <span className={cn(
                                    "font-bold",
                                    pedidoCalculado > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                                  )}>
                                    {pedidoCalculado}
                                  </span>
                                </TableCell>
                                
                                <TableCell className="text-center text-muted-foreground">
                                  {editingThisField === "unidad" ? (
                                    <Input
                                      value={inlineValue}
                                      onChange={(e) => setInlineValue(e.target.value)}
                                      onBlur={() => handleInlineSave(product.id, "unidad", inlineValue)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleInlineSave(product.id, "unidad", inlineValue)
                                        if (e.key === "Escape") { setEditingField(null); setInlineValue("") }
                                      }}
                                      autoFocus
                                      placeholder="kg..."
                                      className="h-8 w-14 mx-auto text-center"
                                    />
                                  ) : (
                                    <div
                                      onClick={() => { setEditingField({ id: product.id, field: "unidad" }); setInlineValue(product.unidad || "") }}
                                      className="cursor-pointer hover:bg-muted rounded px-2 py-1 inline-block min-w-[2rem]"
                                    >
                                      {product.unidad || "-"}
                                    </div>
                                  )}
                                </TableCell>
                                
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Dialog crear pedido */}
      <Dialog open={createPedidoOpen} onOpenChange={setCreatePedidoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Pedido</DialogTitle>
            <DialogDescription>
              Configura un nuevo pedido para organizar tus productos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pedidoName">Nombre del pedido *</Label>
              <Input
                id="pedidoName"
                value={newPedidoName}
                onChange={(e) => setNewPedidoName(e.target.value)}
                placeholder="Ej: Proveedor Bebidas, Almacén, etc."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="stockMin">Stock mínimo por defecto</Label>
              <Input
                id="stockMin"
                type="number"
                min="0"
                value={newPedidoStockMin}
                onChange={(e) => setNewPedidoStockMin(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se aplicará a los nuevos productos importados
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="formato">Formato de salida</Label>
              <Input
                id="formato"
                value={newPedidoFormat}
                onChange={(e) => setNewPedidoFormat(e.target.value)}
                placeholder="{nombre} ({cantidad})"
              />
              <p className="text-xs text-muted-foreground">
                Usa: <code>{"{nombre}"}</code>, <code>{"{cantidad}"}</code>, <code>{"{unidad}"}</code>
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {FORMAT_EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNewPedidoFormat(ex.format)}
                    className={cn(
                      "text-xs px-2 py-1 rounded border transition-colors",
                      newPedidoFormat === ex.format 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-muted hover:bg-accent border-border"
                    )}
                  >
                    {ex.example}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePedidoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePedido}>Crear Pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog editar pedido */}
      <Dialog open={editPedidoOpen} onOpenChange={setEditPedidoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar Pedido</DialogTitle>
            <DialogDescription>
              Modifica la configuración de "{selectedPedido?.nombre}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Nombre del pedido</Label>
              <Input
                id="editName"
                value={newPedidoName}
                onChange={(e) => setNewPedidoName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editStockMin">Stock mínimo por defecto</Label>
              <Input
                id="editStockMin"
                type="number"
                min="0"
                value={newPedidoStockMin}
                onChange={(e) => setNewPedidoStockMin(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editFormato">Formato de salida</Label>
              <Input
                id="editFormato"
                value={newPedidoFormat}
                onChange={(e) => setNewPedidoFormat(e.target.value)}
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {FORMAT_EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNewPedidoFormat(ex.format)}
                    className={cn(
                      "text-xs px-2 py-1 rounded border transition-colors",
                      newPedidoFormat === ex.format 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-muted hover:bg-accent border-border"
                    )}
                  >
                    {ex.example}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPedidoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdatePedido}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog importar */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Productos</DialogTitle>
            <DialogDescription>
              Pega una lista de productos (uno por línea)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Leche&#10;Pan&#10;Huevos&#10;..."
              className="min-h-48 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Stock mínimo por defecto: <strong>{selectedPedido?.stockMinimoDefault}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportText("") }}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!importText.trim()}>
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminar pedido */}
      <AlertDialog open={deletePedidoDialogOpen} onOpenChange={setDeletePedidoDialogOpen}>
        <AlertDialogContent className="border-2 border-destructive">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Pedido
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar <strong>"{selectedPedido?.nombre}"</strong> y todos sus productos ({products.length})?
              <br />Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePedido}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar limpiar stock */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar Stock Actual?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán todos los valores de stock actual ingresados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearStock}>Limpiar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
