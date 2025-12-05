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
import { Plus, Trash2, Copy, MessageCircle, RotateCcw, Upload, Package, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { Skeleton } from "@/components/ui/skeleton"
import { logger } from "@/lib/logger"
import { Producto } from "@/lib/types"

export default function PedidosPage() {
  const { user } = useData()
  const { toast } = useToast()
  
  // Estados principales
  const [products, setProducts] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)
  
  // Estados para stock actual (no se guarda en Firebase, solo temporal)
  const [stockActual, setStockActual] = useState<Record<string, number>>({})
  
  // Estados para edición inline
  const [editingField, setEditingField] = useState<{id: string, field: string} | null>(null)
  const [inlineValue, setInlineValue] = useState("")

  // Cargar productos desde Firebase
  const loadProducts = async () => {
    if (!user || !db) return
    
    setLoading(true)
    try {
      const productsQuery = query(
        collection(db, COLLECTIONS.PRODUCTS),
        where("userId", "==", user.uid)
      )
      const snapshot = await getDocs(productsQuery)
      const productsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Producto[]
      
      // Ordenar por nombre
      productsData.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setProducts(productsData)
    } catch (error: any) {
      logger.error("Error al cargar productos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [user])

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

  // Detectar formato y parsear lista de productos
  const parseProductList = (text: string): string[] => {
    const lines = text.split("\n").filter(line => line.trim())
    const productos: string[] = []
    
    for (const line of lines) {
      // Detectar separadores comunes (tab, coma, punto y coma)
      let nombre = line
      
      if (line.includes("\t")) {
        nombre = line.split("\t")[0]
      } else if (line.includes(";")) {
        nombre = line.split(";")[0]
      } else if (line.includes(",")) {
        // Solo si parece CSV (tiene múltiples comas o la coma no está al final)
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
    if (!db || !user) {
      toast({
        title: "Error",
        description: "Firebase no está configurado",
        variant: "destructive",
      })
      return
    }

    const nombresImportados = parseProductList(importText)
    
    if (nombresImportados.length === 0) {
      toast({
        title: "Error",
        description: "No se encontraron productos para importar",
        variant: "destructive",
      })
      return
    }

    // Filtrar productos que ya existen
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
          nombre,
          stockMinimo: 1, // Stock mínimo por defecto
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

  // Guardar cambios inline (stock mínimo, nombre, unidad)
  const handleInlineSave = async (productId: string, field: string, value: string) => {
    if (!db) {
      toast({
        title: "Error",
        description: "Firebase no está configurado",
        variant: "destructive",
      })
      return
    }

    try {
      const updateData: any = {
        updatedAt: serverTimestamp(),
      }

      if (field === "nombre") {
        if (!value.trim()) {
          toast({
            title: "Error",
            description: "El nombre es requerido",
            variant: "destructive",
          })
          setEditingField(null)
          setInlineValue("")
          return
        }
        updateData.nombre = value.trim()
      } else if (field === "stockMinimo") {
        const numValue = parseInt(value, 10)
        if (isNaN(numValue) || numValue < 0) {
          toast({
            title: "Error",
            description: "El stock mínimo debe ser un número mayor o igual a 0",
            variant: "destructive",
          })
          setEditingField(null)
          setInlineValue("")
          return
        }
        updateData.stockMinimo = numValue
      } else if (field === "unidad") {
        updateData.unidad = value.trim() || null
      }

      await updateDoc(doc(db, COLLECTIONS.PRODUCTS, productId), updateData)
      
      toast({
        title: "Actualizado",
        description: "Producto actualizado correctamente",
      })
      
      await loadProducts()
      setEditingField(null)
      setInlineValue("")
    } catch (error: any) {
      logger.error("Error al actualizar producto:", error)
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al actualizar",
        variant: "destructive",
      })
      setEditingField(null)
      setInlineValue("")
    }
  }

  // Eliminar producto
  const handleDeleteProduct = async (productId: string) => {
    if (!db) return
    
    try {
      await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productId))
      
      // Limpiar stock actual del producto eliminado
      setStockActual(prev => {
        const newState = { ...prev }
        delete newState[productId]
        return newState
      })
      
      await loadProducts()
      
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado",
      })
    } catch (error: any) {
      logger.error("Error al eliminar producto:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto",
        variant: "destructive",
      })
    }
  }

  // Eliminar todos los productos
  const handleDeleteAllProducts = async () => {
    if (!db || !user) return
    
    try {
      const batch = writeBatch(db)
      
      for (const product of products) {
        batch.delete(doc(db, COLLECTIONS.PRODUCTS, product.id))
      }
      
      await batch.commit()
      setStockActual({})
      setProducts([])
      setDeleteAllDialogOpen(false)
      
      toast({
        title: "Productos eliminados",
        description: "Se han eliminado todos los productos",
      })
    } catch (error: any) {
      logger.error("Error al eliminar productos:", error)
      toast({
        title: "Error",
        description: "No se pudieron eliminar los productos",
        variant: "destructive",
      })
    }
  }

  // Limpiar stock actual
  const handleClearStock = () => {
    setStockActual({})
    setClearDialogOpen(false)
    toast({
      title: "Stock limpiado",
      description: "Se han limpiado todos los valores de stock actual",
    })
  }

  // Generar texto del pedido
  const generarTextoPedido = (): string => {
    const lineas = productosAPedir.map(p => {
      const pedido = calcularPedido(p.stockMinimo, stockActual[p.id])
      const unidad = p.unidad ? ` ${p.unidad}` : ""
      return `• ${p.nombre}: ${pedido}${unidad}`
    })
    
    return `📦 PEDIDO\n\n${lineas.join("\n")}\n\nTotal: ${productosAPedir.length} productos`
  }

  // Copiar pedido
  const handleCopyPedido = async () => {
    if (productosAPedir.length === 0) {
      toast({
        title: "Sin pedidos",
        description: "No hay productos que pedir (stock actual >= stock mínimo)",
      })
      return
    }

    const texto = generarTextoPedido()
    
    try {
      await navigator.clipboard.writeText(texto)
      toast({
        title: "Copiado",
        description: "Pedido copiado al portapapeles",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive",
      })
    }
  }

  // Enviar por WhatsApp
  const handleWhatsApp = () => {
    if (productosAPedir.length === 0) {
      toast({
        title: "Sin pedidos",
        description: "No hay productos que pedir (stock actual >= stock mínimo)",
      })
      return
    }

    const texto = generarTextoPedido()
    const encoded = encodeURIComponent(texto)
    window.open(`https://wa.me/?text=${encoded}`, "_blank")
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Pedidos</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gestiona tu inventario y genera pedidos automáticamente
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setImportDialogOpen(true)} variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
            {products.length > 0 && (
              <Button onClick={() => setDeleteAllDialogOpen(true)} variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Todo
              </Button>
            )}
          </div>
        </div>

        {/* Acciones de pedido */}
        {products.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-card-foreground flex items-center gap-2">
                <Package className="h-5 w-5" />
                Generar Pedido
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {productosAPedir.length > 0 
                  ? `${productosAPedir.length} producto${productosAPedir.length !== 1 ? "s" : ""} necesita${productosAPedir.length === 1 ? "" : "n"} pedido`
                  : "No hay productos que pedir - el stock está completo"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCopyPedido} disabled={productosAPedir.length === 0}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Pedido
                </Button>
                <Button onClick={handleWhatsApp} disabled={productosAPedir.length === 0} variant="secondary" className="bg-green-600 hover:bg-green-700 text-white">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Enviar por WhatsApp
                </Button>
                <Button onClick={() => setClearDialogOpen(true)} variant="outline">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Limpiar Stock Actual
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabla de productos */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Lista de Productos</CardTitle>
            <CardDescription className="text-muted-foreground">
              {products.length > 0 
                ? `Total: ${products.length} productos` 
                : "Importa una lista de productos para comenzar"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 flex-1" />
                    <Skeleton className="h-12 w-24" />
                    <Skeleton className="h-12 w-24" />
                    <Skeleton className="h-12 w-24" />
                    <Skeleton className="h-12 w-16" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No hay productos registrados.
                </p>
                <Button onClick={() => setImportDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar Lista de Productos
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-foreground">Producto</TableHead>
                      <TableHead className="text-foreground text-center w-28">Stock Mín.</TableHead>
                      <TableHead className="text-foreground text-center w-28">Stock Actual</TableHead>
                      <TableHead className="text-foreground text-center w-28">Pedido</TableHead>
                      <TableHead className="text-foreground text-center w-20">Unidad</TableHead>
                      <TableHead className="text-right text-foreground w-16">Acc.</TableHead>
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
                          className={`border-border ${pedidoCalculado > 0 ? "bg-amber-500/10" : ""}`}
                        >
                          {/* Nombre */}
                          <TableCell className="font-medium text-foreground">
                            {editingThisField === "nombre" ? (
                              <Input
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                onBlur={() => handleInlineSave(product.id, "nombre", inlineValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleInlineSave(product.id, "nombre", inlineValue)
                                  } else if (e.key === "Escape") {
                                    setEditingField(null)
                                    setInlineValue("")
                                  }
                                }}
                                autoFocus
                                className="h-8"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingField({ id: product.id, field: "nombre" })
                                  setInlineValue(product.nombre)
                                }}
                                className="cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2 transition-colors"
                              >
                                {product.nombre}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Stock Mínimo */}
                          <TableCell className="text-center">
                            {editingThisField === "stockMinimo" ? (
                              <Input
                                type="number"
                                min="0"
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                onBlur={() => handleInlineSave(product.id, "stockMinimo", inlineValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleInlineSave(product.id, "stockMinimo", inlineValue)
                                  } else if (e.key === "Escape") {
                                    setEditingField(null)
                                    setInlineValue("")
                                  }
                                }}
                                autoFocus
                                className="h-8 w-20 mx-auto text-center"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingField({ id: product.id, field: "stockMinimo" })
                                  setInlineValue(product.stockMinimo.toString())
                                }}
                                className="cursor-pointer hover:bg-muted rounded px-2 py-1 transition-colors inline-block min-w-[3rem]"
                              >
                                {product.stockMinimo}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Stock Actual */}
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
                              className="h-8 w-20 mx-auto text-center"
                            />
                          </TableCell>
                          
                          {/* Pedido Calculado */}
                          <TableCell className="text-center">
                            <span className={`font-bold ${pedidoCalculado > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                              {pedidoCalculado}
                            </span>
                          </TableCell>
                          
                          {/* Unidad */}
                          <TableCell className="text-center text-muted-foreground">
                            {editingThisField === "unidad" ? (
                              <Input
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                onBlur={() => handleInlineSave(product.id, "unidad", inlineValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleInlineSave(product.id, "unidad", inlineValue)
                                  } else if (e.key === "Escape") {
                                    setEditingField(null)
                                    setInlineValue("")
                                  }
                                }}
                                autoFocus
                                placeholder="kg, uds..."
                                className="h-8 w-16 mx-auto text-center"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingField({ id: product.id, field: "unidad" })
                                  setInlineValue(product.unidad || "")
                                }}
                                className="cursor-pointer hover:bg-muted rounded px-2 py-1 transition-colors inline-block min-w-[2rem]"
                              >
                                {product.unidad || "-"}
                              </div>
                            )}
                          </TableCell>
                          
                          {/* Acciones */}
                          <TableCell className="text-right">
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

        {/* Dialog de importación */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="bg-card sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">Importar Productos</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Pega una lista de productos. Se detectará automáticamente el formato (texto simple, CSV, etc.)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="importText" className="text-foreground">
                  Lista de Productos
                </Label>
                <Textarea
                  id="importText"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Pega aquí tu lista de productos...&#10;&#10;Ejemplos:&#10;Leche&#10;Pan&#10;Huevos&#10;&#10;O en formato CSV:&#10;Leche,10,unidades&#10;Pan,5,paquetes"
                  className="border-input bg-background text-foreground min-h-48 font-mono text-sm"
                  rows={10}
                />
                <p className="text-xs text-muted-foreground">
                  El sistema detectará automáticamente si usas comas, punto y coma, tabs o líneas simples.
                  Solo se importará el nombre del producto (primera columna).
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setImportDialogOpen(false)
                setImportText("")
              }}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={!importText.trim()}>
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog confirmar limpiar stock */}
        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Limpiar Stock Actual?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borrarán todos los valores de stock actual que has ingresado. 
                Los productos y sus configuraciones de stock mínimo se mantendrán.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearStock}>
                Limpiar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog confirmar eliminar todos */}
        <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
          <AlertDialogContent className="border-2 border-destructive">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <AlertDialogTitle className="text-xl text-destructive">
                  ⚠️ Eliminar Todos los Productos
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-base">
                Esta acción eliminará <strong className="text-destructive">{products.length} productos</strong> de forma permanente.
                Esta acción NO se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAllProducts}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                ⚠️ Eliminar Todo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}

