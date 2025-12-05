"use client"

import { useState, useRef, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { 
  Plus, Trash2, Copy, MessageCircle, RotateCcw, Upload, Package, 
  Construction, Pencil, Check, X
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { usePedidos } from "@/hooks/use-pedidos"
import { PedidosSidebar } from "@/components/pedidos/pedidos-sidebar"
import { ProductosTable } from "@/components/pedidos/productos-table"
import { 
  PedidoFormDialog, 
  ImportDialog, 
  DeletePedidoDialog, 
  ClearStockDialog,
  DEFAULT_FORMAT 
} from "@/components/pedidos/pedido-dialogs"
import { cn } from "@/lib/utils"

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
  
  const {
    pedidos,
    products,
    selectedPedido,
    loading,
    stockActual,
    productosAPedir,
    setSelectedPedido,
    setStockActual,
    createPedido,
    updatePedido,
    deletePedido,
    importProducts,
    updateProduct,
    deleteProduct,
    clearStock,
    calcularPedido,
    generarTextoPedido,
  } = usePedidos(user)
  
  // Dialog states
  const [createPedidoOpen, setCreatePedidoOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deletePedidoDialogOpen, setDeletePedidoDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  
  // Form states
  const [formName, setFormName] = useState("")
  const [formStockMin, setFormStockMin] = useState("1")
  const [formFormat, setFormFormat] = useState(DEFAULT_FORMAT)
  const [importText, setImportText] = useState("")

  // Inline edit states
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingMensaje, setIsEditingMensaje] = useState(false)
  const [editingName, setEditingName] = useState("")
  const [editingMensaje, setEditingMensaje] = useState("")
  const nameInputRef = useRef<HTMLInputElement>(null)
  const mensajeInputRef = useRef<HTMLInputElement>(null)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  useEffect(() => {
    if (isEditingMensaje && mensajeInputRef.current) {
      mensajeInputRef.current.focus()
      mensajeInputRef.current.select()
    }
  }, [isEditingMensaje])

  // Reset edit states when selectedPedido changes
  useEffect(() => {
    setIsEditingName(false)
    setIsEditingMensaje(false)
    if (selectedPedido) {
      setEditingName(selectedPedido.nombre)
      setEditingMensaje(selectedPedido.mensajePrevio || "")
    }
  }, [selectedPedido])

  // Handlers
  const handleOpenCreate = () => {
    setFormName("")
    setFormStockMin("1")
    setFormFormat(DEFAULT_FORMAT)
    setCreatePedidoOpen(true)
  }

  const handleCreatePedido = async () => {
    const result = await createPedido(formName, parseInt(formStockMin, 10) || 1, formFormat)
    if (result) {
      setCreatePedidoOpen(false)
    }
  }

  const handleDeletePedido = async () => {
    const success = await deletePedido()
    if (success) {
      setDeletePedidoDialogOpen(false)
    }
  }

  const handleImport = async () => {
    const success = await importProducts(importText)
    if (success) {
      setImportDialogOpen(false)
      setImportText("")
    }
  }

  const handleClearStock = () => {
    clearStock()
    setClearDialogOpen(false)
  }

  const handleCopyPedido = async () => {
    if (productosAPedir.length === 0) {
      toast({ title: "Sin pedidos", description: "No hay productos que pedir" })
      return
    }
    try {
      await navigator.clipboard.writeText(generarTextoPedido())
      toast({ title: "Copiado", description: "Pedido copiado al portapapeles" })
    } catch {
      toast({ title: "Error", description: "No se pudo copiar", variant: "destructive" })
    }
  }

  const handleWhatsApp = () => {
    if (productosAPedir.length === 0) {
      toast({ title: "Sin pedidos", description: "No hay productos que pedir" })
      return
    }
    const encoded = encodeURIComponent(generarTextoPedido())
    window.open(`https://wa.me/?text=${encoded}`, "_blank")
  }

  const handleStockChange = (productId: string, value: number) => {
    setStockActual(prev => ({ ...prev, [productId]: value }))
  }

  // Inline edit handlers
  const handleStartEditName = () => {
    if (selectedPedido) {
      setEditingName(selectedPedido.nombre)
      setIsEditingName(true)
    }
  }

  const handleSaveName = async () => {
    if (!selectedPedido) return
    if (!editingName.trim()) {
      setEditingName(selectedPedido.nombre)
      setIsEditingName(false)
      return
    }
    if (editingName !== selectedPedido.nombre) {
      await updatePedido(editingName, selectedPedido.stockMinimoDefault, selectedPedido.formatoSalida)
    }
    setIsEditingName(false)
  }

  const handleCancelEditName = () => {
    setEditingName(selectedPedido?.nombre || "")
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName()
    } else if (e.key === "Escape") {
      handleCancelEditName()
    }
  }

  const handleFormatChange = async (newFormat: string) => {
    if (!selectedPedido || newFormat === selectedPedido.formatoSalida) return
    await updatePedido(selectedPedido.nombre, selectedPedido.stockMinimoDefault, newFormat)
  }

  // Mensaje previo handlers
  const handleStartEditMensaje = () => {
    if (selectedPedido) {
      setEditingMensaje(selectedPedido.mensajePrevio || "")
      setIsEditingMensaje(true)
    }
  }

  const handleSaveMensaje = async () => {
    if (!selectedPedido) return
    await updatePedido(
      selectedPedido.nombre, 
      selectedPedido.stockMinimoDefault, 
      selectedPedido.formatoSalida,
      editingMensaje.trim() || undefined
    )
    setIsEditingMensaje(false)
  }

  const handleCancelEditMensaje = () => {
    setEditingMensaje(selectedPedido?.mensajePrevio || "")
    setIsEditingMensaje(false)
  }

  const handleMensajeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveMensaje()
    } else if (e.key === "Escape") {
      handleCancelEditMensaje()
    }
  }

  // Loading state
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
              Esta funcionalidad está en construcción. Algunas características pueden cambiar.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Sidebar */}
        <PedidosSidebar
          pedidos={pedidos}
          selectedPedido={selectedPedido}
          onSelectPedido={setSelectedPedido}
          onCreatePedido={handleOpenCreate}
        />

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
                <Button onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Pedido
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Header del pedido con edición inline */}
              <Card className="border-border bg-card">
                <CardContent className="pt-6 space-y-4">
                  {/* Nombre editable y acciones */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {isEditingName ? (
                      <div className="flex items-center gap-2 max-w-md w-full">
                        <Input
                          ref={nameInputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={handleNameKeyDown}
                          className="text-2xl font-bold h-auto py-1 px-2"
                          placeholder="Nombre del pedido"
                        />
                        <Button variant="ghost" size="icon" onClick={handleSaveName} className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleCancelEditName} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold text-foreground">{selectedPedido.nombre}</h2>
                        <Button variant="ghost" size="icon" onClick={handleStartEditName} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
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

                  {/* Mensaje previo editable */}
                  <div className="flex items-center gap-2">
                    {isEditingMensaje ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          ref={mensajeInputRef}
                          value={editingMensaje}
                          onChange={(e) => setEditingMensaje(e.target.value)}
                          onKeyDown={handleMensajeKeyDown}
                          className="text-sm h-8 flex-1"
                          placeholder="Ej: Pedido de insumos para fábrica:"
                        />
                        <Button variant="ghost" size="icon" onClick={handleSaveMensaje} className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleCancelEditMensaje} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Encabezado: <span className="text-foreground">{selectedPedido.mensajePrevio || `📦 ${selectedPedido.nombre}`}</span>
                        </span>
                        <Button variant="ghost" size="icon" onClick={handleStartEditMensaje} className="h-6 w-6 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Formato de salida - solo botones */}
                  <div className="flex flex-wrap gap-1.5">
                    {FORMAT_EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleFormatChange(ex.format)}
                        className={cn(
                          "text-sm px-3 py-1.5 rounded-md border transition-colors",
                          selectedPedido.formatoSalida === ex.format 
                            ? "bg-primary text-primary-foreground border-primary" 
                            : "bg-muted hover:bg-accent border-border"
                        )}
                      >
                        {ex.example}
                      </button>
                    ))}
                  </div>

                  {/* Acciones de pedido */}
                  {products.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                      <span className="text-sm text-muted-foreground mr-2">
                        {productosAPedir.length > 0 
                          ? `${productosAPedir.length} producto${productosAPedir.length !== 1 ? "s" : ""} para pedir`
                          : "Stock completo"
                        }
                      </span>
                      <Button size="sm" onClick={handleCopyPedido} disabled={productosAPedir.length === 0}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copiar
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handleWhatsApp} 
                        disabled={productosAPedir.length === 0}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setClearDialogOpen(true)}>
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Limpiar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabla de productos */}
              <ProductosTable
                products={products}
                stockActual={stockActual}
                onStockChange={handleStockChange}
                onUpdateProduct={updateProduct}
                onDeleteProduct={deleteProduct}
                onImport={() => setImportDialogOpen(true)}
                calcularPedido={calcularPedido}
              />
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <PedidoFormDialog
        open={createPedidoOpen}
        onOpenChange={setCreatePedidoOpen}
        title="Crear Nuevo Pedido"
        description="Configura un nuevo pedido para organizar tus productos"
        name={formName}
        onNameChange={setFormName}
        stockMin={formStockMin}
        onStockMinChange={setFormStockMin}
        format={formFormat}
        onFormatChange={setFormFormat}
        onSubmit={handleCreatePedido}
        submitLabel="Crear Pedido"
      />

      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importText={importText}
        onImportTextChange={setImportText}
        onImport={handleImport}
        stockMinimoDefault={selectedPedido?.stockMinimoDefault}
      />

      <DeletePedidoDialog
        open={deletePedidoDialogOpen}
        onOpenChange={setDeletePedidoDialogOpen}
        pedidoName={selectedPedido?.nombre}
        productsCount={products.length}
        onDelete={handleDeletePedido}
      />

      <ClearStockDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        onClear={handleClearStock}
      />
    </DashboardLayout>
  )
}
