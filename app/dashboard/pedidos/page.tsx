"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Plus, Trash2, Copy, MessageCircle, RotateCcw, Upload, Package, 
  Settings, Construction
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
  const [editPedidoOpen, setEditPedidoOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deletePedidoDialogOpen, setDeletePedidoDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  
  // Form states
  const [formName, setFormName] = useState("")
  const [formStockMin, setFormStockMin] = useState("1")
  const [formFormat, setFormFormat] = useState(DEFAULT_FORMAT)
  const [importText, setImportText] = useState("")

  // Handlers
  const handleOpenCreate = () => {
    setFormName("")
    setFormStockMin("1")
    setFormFormat(DEFAULT_FORMAT)
    setCreatePedidoOpen(true)
  }

  const handleOpenEdit = () => {
    if (!selectedPedido) return
    setFormName(selectedPedido.nombre)
    setFormStockMin(selectedPedido.stockMinimoDefault.toString())
    setFormFormat(selectedPedido.formatoSalida)
    setEditPedidoOpen(true)
  }

  const handleCreatePedido = async () => {
    const result = await createPedido(formName, parseInt(formStockMin, 10) || 1, formFormat)
    if (result) {
      setCreatePedidoOpen(false)
    }
  }

  const handleUpdatePedido = async () => {
    const success = await updatePedido(formName, parseInt(formStockMin, 10) || 1, formFormat)
    if (success) {
      setEditPedidoOpen(false)
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
              {/* Header del pedido */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{selectedPedido.nombre}</h2>
                  <p className="text-sm text-muted-foreground">
                    Formato: <code className="bg-muted px-1 rounded">{selectedPedido.formatoSalida}</code>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleOpenEdit}>
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

      <PedidoFormDialog
        open={editPedidoOpen}
        onOpenChange={setEditPedidoOpen}
        title="Configurar Pedido"
        description={`Modifica la configuración de "${selectedPedido?.nombre}"`}
        name={formName}
        onNameChange={setFormName}
        stockMin={formStockMin}
        onStockMinChange={setFormStockMin}
        format={formFormat}
        onFormatChange={setFormFormat}
        onSubmit={handleUpdatePedido}
        submitLabel="Guardar Cambios"
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
