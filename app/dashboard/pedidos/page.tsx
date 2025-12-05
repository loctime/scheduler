"use client"

import { useState, useRef, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Plus, Trash2, Copy, MessageCircle, RotateCcw, Upload, Package, 
  Construction, Pencil, Check, X, Settings2
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
  const [showConfig, setShowConfig] = useState(false)
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
      {/* Banner de desarrollo - compacto en móvil */}
      <div className="mb-4 lg:mb-6 rounded-lg border-2 border-dashed border-amber-500/50 bg-amber-500/10 p-3">
        <div className="flex items-center gap-2">
          <Construction className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            🚧 En desarrollo
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Sidebar / Selector de pedidos */}
        <PedidosSidebar
          pedidos={pedidos}
          selectedPedido={selectedPedido}
          onSelectPedido={setSelectedPedido}
          onCreatePedido={handleOpenCreate}
        />

        {/* Contenido principal */}
        <div className="flex-1 space-y-4 lg:space-y-6 min-w-0">
          {!selectedPedido ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold mb-1">Selecciona o crea un pedido</h3>
              <p className="text-muted-foreground text-sm mb-3">
                Crea pedidos para organizar productos
              </p>
              <Button onClick={handleOpenCreate} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Crear Pedido
              </Button>
            </div>
          ) : (
            <>
              {/* Header del pedido - Mobile first */}
              <div className="rounded-lg border border-border bg-card p-1.5 space-y-1.5">
                  {/* Fila 1: Nombre + acciones */}
                  <div className="flex items-center justify-between gap-1.5">
                    {isEditingName ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <Input
                          ref={nameInputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={handleNameKeyDown}
                          className="text-base font-bold h-8"
                          placeholder="Nombre del pedido"
                        />
                        <Button variant="ghost" size="icon" onClick={handleSaveName} className="h-8 w-8 shrink-0 text-green-600">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleCancelEditName} className="h-8 w-8 shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 min-w-0">
                        <h2 className="text-base font-bold text-foreground truncate">{selectedPedido.nombre}</h2>
                        <Button variant="ghost" size="icon" onClick={handleStartEditName} className="h-6 w-6 shrink-0 text-muted-foreground">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-1 shrink-0">
                      <Button 
                        variant={showConfig ? "default" : "outline"} 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => setShowConfig(!showConfig)}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setImportDialogOpen(true)}>
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletePedidoDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Sección colapsable: Encabezado + Formato */}
                  {showConfig && (
                    <div className="space-y-2 pt-1.5 border-t border-border">
                      {/* Encabezado del mensaje */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                          Encabezado
                        </label>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isEditingMensaje ? (
                            <>
                              <Input
                                ref={mensajeInputRef}
                                value={editingMensaje}
                                onChange={(e) => setEditingMensaje(e.target.value)}
                                onKeyDown={handleMensajeKeyDown}
                                className="text-sm h-7 flex-1"
                                placeholder="Ej: Pedido de insumos:"
                              />
                              <Button variant="ghost" size="icon" onClick={handleSaveMensaje} className="h-7 w-7 shrink-0 text-green-600">
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={handleCancelEditMensaje} className="h-7 w-7 shrink-0">
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <div 
                              onClick={handleStartEditMensaje}
                              className="flex-1 text-xs px-2 py-1 rounded border border-border bg-muted/50 cursor-pointer hover:bg-muted truncate"
                            >
                              {selectedPedido.mensajePrevio || `📦 ${selectedPedido.nombre}`}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Formato de salida */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                          Formato
                        </label>
                        <div className="flex gap-1 overflow-x-auto mt-0.5 scrollbar-none">
                          {FORMAT_EXAMPLES.map((ex, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleFormatChange(ex.format)}
                              className={cn(
                                "text-[11px] px-2 py-1 rounded border transition-colors whitespace-nowrap shrink-0",
                                selectedPedido.formatoSalida === ex.format 
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
                  )}

                  {/* Acciones de pedido */}
                  {products.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-border">
                      <span className={cn(
                        "text-[11px] font-medium px-1.5 py-0.5 rounded-full",
                        productosAPedir.length > 0 
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}>
                        {productosAPedir.length > 0 
                          ? `${productosAPedir.length} a pedir`
                          : "✓ OK"
                        }
                      </span>
                      <div className="flex-1" />
                      <Button 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={handleCopyPedido} 
                        disabled={productosAPedir.length === 0}
                      >
                        <Copy className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">Copiar</span>
                      </Button>
                      <Button 
                        size="sm"
                        className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleWhatsApp} 
                        disabled={productosAPedir.length === 0}
                      >
                        <MessageCircle className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">WA</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => setClearDialogOpen(true)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
              </div>

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
