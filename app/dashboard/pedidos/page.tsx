"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { useStock } from "@/contexts/stock-context"
import { usePedidos } from "@/hooks/use-pedidos"
import { useEnlacePublico } from "@/hooks/use-enlace-publico"
import { usePedidoEngine } from "@/hooks/pedidos/use-pedido-engine"
import { usePedidoEnlaces } from "@/hooks/pedidos/use-pedido-enlaces"
import { usePedidoActions } from "@/hooks/pedidos/use-pedido-actions"
import { db, COLLECTIONS } from "@/lib/firebase"
import { deleteField, updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { PedidosSidebar } from "@/components/pedidos/pedidos-sidebar"
import { PedidoHeader } from "@/components/pedidos/PedidoHeader"
import { PedidoActionsWithImageExport } from "@/components/pedidos/PedidoActionsWithImageExport"
import { ProductosTab } from "@/components/pedidos/ProductosTab"
import {
  PedidoFormDialog,
  ImportDialog,
  DeletePedidoDialog,
  ClearStockDialog,
  ConfirmarNuevoEnlaceDialog,
  DEFAULT_FORMAT
} from "@/components/pedidos/pedido-dialogs"
import { FacturaImportDialog } from "@/components/pedidos/FacturaImportDialog"
import { useFeatureFlags } from "@/hooks/use-feature-flags"
import { cn } from "@/lib/utils"

type MainTab = "stock" | "config"

export default function PedidosPage() {
  const { user, userData } = useData()
  const router = useRouter()
  const { toast } = useToast()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const flags = useFeatureFlags(ownerId, user?.uid)
  const { stockActual: stockActualGlobal } = useStock()

  const {
    pedidos,
    products,
    selectedPedido,
    loading,
    stockActual: stockActualLocal,
    productosAPedir,
    setSelectedPedido,
    setStockActual,
    createPedido,
    updatePedido,
    deletePedido,
    importProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    clearStock,
    updateProductsOrder,
  } = usePedidos(user)

  const { crearEnlacePublico, loading: loadingEnlace } = useEnlacePublico(user)

  const stockActual = useMemo(() => {
    if (Object.keys(stockActualLocal).length > 0) {
      return { ...stockActualGlobal, ...stockActualLocal }
    }
    return stockActualGlobal || stockActualLocal
  }, [stockActualGlobal, stockActualLocal])

  const engine = usePedidoEngine(selectedPedido, products, stockActual)
  const { resultadoEngine, productosAPedirActualizados } = engine

  const [mainTab, setMainTab] = useState<MainTab>("stock")
  const [showConfigPanel, setShowConfigPanel] = useState(false)

  const enlaces = usePedidoEnlaces({
    selectedPedido,
    ownerId,
    user,
    resultadoEngine,
    createPedido,
    setSelectedPedido,
    crearEnlacePublico,
    DEFAULT_FORMAT,
    onNeedsConfirmacion: () => setConfirmarNuevoEnlaceOpen(true)
  })
  const { enlaceActivo, handleGenerarEnlace, ejecutarGenerarEnlace } = enlaces

  const actions = usePedidoActions({
    selectedPedido,
    products,
    productosAPedirActualizados,
    resultadoEngine,
    stockActual
  })
  const { handleCopyPedido, handleCopyStock, handleLlevarPedidoASheet } = actions

  const [createPedidoOpen, setCreatePedidoOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [facturaImportOpen, setFacturaImportOpen] = useState(false)
  const [deletePedidoDialogOpen, setDeletePedidoDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [confirmarNuevoEnlaceOpen, setConfirmarNuevoEnlaceOpen] = useState(false)
  const [formName, setFormName] = useState("")
  const [formDiasEnvio, setFormDiasEnvio] = useState<number[]>([])
  const [importText, setImportText] = useState("")

  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingMensaje, setIsEditingMensaje] = useState(false)
  const [isEditingSheetUrl, setIsEditingSheetUrl] = useState(false)
  const [editingName, setEditingName] = useState("")
  const [editingMensaje, setEditingMensaje] = useState("")
  const [editingSheetUrl, setEditingSheetUrl] = useState("")
  const [defaultMinStr, setDefaultMinStr] = useState("0")
  const nameInputRef = useRef<HTMLInputElement>(null)
  const mensajeInputRef = useRef<HTMLInputElement>(null)
  const sheetUrlInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setIsEditingName(false)
    setIsEditingMensaje(false)
    setIsEditingSheetUrl(false)
    if (selectedPedido) {
      setEditingName(selectedPedido.nombre)
      setEditingMensaje(selectedPedido.mensajePrevio || "")
      setEditingSheetUrl(selectedPedido.sheetUrl || "")
      setDefaultMinStr(String(selectedPedido.stockMinimoDefault ?? 0))
    }
  }, [selectedPedido])

  useEffect(() => {
    if (mainTab === "config") {
      setShowConfigPanel(true)
    }
  }, [mainTab])

  const handleVerPedido = () => {
    if (!selectedPedido) return
    if (selectedPedido.estado === "enviado" || selectedPedido.estado === "recibido") {
      router.push("/dashboard/recepciones")
      return
    }
    if (enlaceActivo) {
      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/pedido-publico/${enlaceActivo.id}`
      window.open(url, "_blank")
    }
  }

  const handleOpenCreate = () => {
    setFormName("")
    setFormDiasEnvio([])
    setCreatePedidoOpen(true)
  }
  const handleCreatePedido = async () => {
    const result = await createPedido(formName, 1, DEFAULT_FORMAT, formDiasEnvio)
    if (result) {
      setCreatePedidoOpen(false)
      setFormName("")
      setFormDiasEnvio([])
    }
  }
  const handleDeletePedido = async () => {
    const success = await deletePedido()
    if (success) setDeletePedidoDialogOpen(false)
  }
  const handleImport = async () => {
    const success = await importProducts(importText)
    if (success) {
      setImportDialogOpen(false)
      setImportText("")
    }
  }
  const handleClearStock = async () => {
    const success = await clearStock()
    if (success) {
      setClearDialogOpen(false)
    }
  }

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
    if (e.key === "Enter") handleSaveName()
    else if (e.key === "Escape") handleCancelEditName()
  }
  const handleFormatChange = async (newFormat: string) => {
    if (!selectedPedido || newFormat === selectedPedido.formatoSalida) return
    await updatePedido(selectedPedido.nombre, selectedPedido.stockMinimoDefault, newFormat)
  }

  const handleUpdateDiaEnvio = async (dias: number[]) => {
    if (!selectedPedido) return
    await updatePedido(
      selectedPedido.nombre,
      selectedPedido.stockMinimoDefault,
      selectedPedido.formatoSalida,
      selectedPedido.mensajePrevio,
      selectedPedido.sheetUrl,
      dias
    )
  }

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
    if (e.key === "Enter") handleSaveMensaje()
    else if (e.key === "Escape") handleCancelEditMensaje()
  }

  const handleStartEditSheetUrl = () => {
    if (selectedPedido) {
      setEditingSheetUrl(selectedPedido.sheetUrl || "")
      setIsEditingSheetUrl(true)
    }
  }
  const handleSaveSheetUrl = async () => {
    if (!selectedPedido) return
    await updatePedido(
      selectedPedido.nombre,
      selectedPedido.stockMinimoDefault,
      selectedPedido.formatoSalida,
      selectedPedido.mensajePrevio,
      editingSheetUrl.trim() || undefined
    )
    setIsEditingSheetUrl(false)
  }
  const handleCancelEditSheetUrl = () => {
    setEditingSheetUrl(selectedPedido?.sheetUrl || "")
    setIsEditingSheetUrl(false)
  }
  const handleSheetUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveSheetUrl()
    else if (e.key === "Escape") handleCancelEditSheetUrl()
  }

  const handleBlurDefaultMin = async () => {
    if (!selectedPedido) return
    const v = Math.max(0, parseInt(defaultMinStr, 10) || 0)
    setDefaultMinStr(String(v))
    if (v !== selectedPedido.stockMinimoDefault) {
      await updatePedido(selectedPedido.nombre, v, selectedPedido.formatoSalida, selectedPedido.mensajePrevio, selectedPedido.sheetUrl)
    }
  }

  const handleStockChange = async (productId: string, value: number) => {
    setStockActual((prev) => ({ ...prev, [productId]: value }))
    try {
      if (!db || !user || !ownerId) return
      const productRef = doc(db, COLLECTIONS.PRODUCTS, productId)
      await updateDoc(productRef, {
        stockActualUnits: value,
        stockActual: deleteField(),
        updatedAt: serverTimestamp(),
        ownerId,
        userId: user.uid
      })
    } catch (error) {
      console.error("Error actualizando stock:", error)
      setStockActual((prev) => ({ ...prev, [productId]: stockActualGlobal[productId] ?? 0 }))
    }
  }

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
      <div className="px-1 sm:px-0">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6">
          <PedidosSidebar
            pedidos={pedidos}
            selectedPedido={selectedPedido}
            onSelectPedido={setSelectedPedido}
            onCreatePedido={handleOpenCreate}
          />

          <div className="flex-1 space-y-3 sm:space-y-4 lg:space-y-6 min-w-0 overflow-x-hidden">
            {!selectedPedido ? (
              <div className="rounded-lg border border-border bg-card p-4 sm:p-6 text-center">
                <Package className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground mb-2 sm:mb-3" />
                <h3 className="text-sm sm:text-base font-semibold mb-1">Selecciona o crea un pedido</h3>
                <p className="text-muted-foreground text-xs sm:text-sm mb-3">
                  Crea pedidos para organizar productos
                </p>
                <Button onClick={handleOpenCreate} size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-1" />
                  Crear Pedido
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-1 border-b border-border pb-2">
                  <Button
                    type="button"
                    variant={mainTab === "stock" ? "default" : "ghost"}
                    size="sm"
                    className={cn("rounded-none border-b-2 border-transparent", mainTab === "stock" && "border-primary")}
                    onClick={() => setMainTab("stock")}
                  >
                    Stock
                  </Button>
                  <Button
                    type="button"
                    variant={mainTab === "config" ? "default" : "ghost"}
                    size="sm"
                    className={cn("rounded-none border-b-2 border-transparent", mainTab === "config" && "border-primary")}
                    onClick={() => setMainTab("config")}
                  >
                    Configuración del grupo
                  </Button>
                </div>

                {mainTab === "stock" && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border bg-card p-3">
                      <h2 className="text-base sm:text-lg font-bold text-foreground truncate">{selectedPedido.nombre}</h2>
                      <Button type="button" className="shrink-0 w-full sm:w-auto" onClick={() => router.push("/dashboard/pedir")}>
                        Pedir a fábrica →
                      </Button>
                    </div>

                    {products.length > 0 && (
                      <div className="rounded-lg border border-border bg-card p-1.5 sm:p-2">
                        <PedidoActionsWithImageExport
                          selectedPedido={selectedPedido}
                          productosAPedirActualizados={productosAPedirActualizados}
                          user={user}
                          productosAPedirCount={productosAPedirActualizados.length}
                          productosAPedirLength={productosAPedir.length}
                          resultadoEngine={resultadoEngine}
                          enlaceActivo={enlaceActivo}
                          loadingEnlace={loadingEnlace}
                          onCopyPedido={handleCopyPedido}
                          onCopyStock={handleCopyStock}
                          onLlevarPedidoASheet={handleLlevarPedidoASheet}
                          onGenerarEnlace={flags.legacy.publicLinkReadOnly ? () => toast({
                            title: "Enlaces publicos en modo solo lectura",
                            description: "No se pueden crear enlaces nuevos desde el flujo legacy.",
                            variant: "destructive"
                          }) : handleGenerarEnlace}
                          onVerPedido={handleVerPedido}
                          hasSheetUrl={!!selectedPedido?.sheetUrl}
                        />
                      </div>
                    )}

                    <ProductosTab
                      products={products}
                      stockActual={stockActual}
                      onStockChange={handleStockChange}
                      onUpdateProduct={updateProduct}
                      onDeleteProduct={deleteProduct}
                      onCreateProduct={createProduct}
                      onImport={() => setImportDialogOpen(true)}
                      onProductsOrderUpdate={updateProductsOrder}
                      stockMinimoDefault={selectedPedido?.stockMinimoDefault ?? 0}
                    />
                  </div>
                )}

                {mainTab === "config" && (
                  <div className="space-y-3 sm:space-y-4">
                    <PedidoHeader
                      selectedPedido={selectedPedido}
                      showConfig={showConfigPanel}
                      setShowConfig={setShowConfigPanel}
                      isEditingName={isEditingName}
                      editingName={editingName}
                      setEditingName={setEditingName}
                      onStartEditName={handleStartEditName}
                      onSaveName={handleSaveName}
                      onCancelEditName={handleCancelEditName}
                      onNameKeyDown={handleNameKeyDown}
                      isEditingMensaje={isEditingMensaje}
                      editingMensaje={editingMensaje}
                      setEditingMensaje={setEditingMensaje}
                      onStartEditMensaje={handleStartEditMensaje}
                      onSaveMensaje={handleSaveMensaje}
                      onCancelEditMensaje={handleCancelEditMensaje}
                      onMensajeKeyDown={handleMensajeKeyDown}
                      isEditingSheetUrl={isEditingSheetUrl}
                      editingSheetUrl={editingSheetUrl}
                      setEditingSheetUrl={setEditingSheetUrl}
                      onStartEditSheetUrl={handleStartEditSheetUrl}
                      onSaveSheetUrl={handleSaveSheetUrl}
                      onCancelEditSheetUrl={handleCancelEditSheetUrl}
        onSheetUrlKeyDown={handleSheetUrlKeyDown}
        onFormatChange={handleFormatChange}
        onDiasEnvioChange={handleUpdateDiaEnvio}
        onImportClick={() => setImportDialogOpen(true)}
        onFacturaImportClick={() => setFacturaImportOpen(true)}
        onDeleteClick={() => setDeletePedidoDialogOpen(true)}
                      nameInputRef={nameInputRef}
                      mensajeInputRef={mensajeInputRef}
                      sheetUrlInputRef={sheetUrlInputRef}
                    />

                    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                      <Label htmlFor="stock-min-default" className="text-sm font-medium">
                        Stock mínimo por defecto (productos nuevos)
                      </Label>
                      <Input
                        id="stock-min-default"
                        type="number"
                        min={0}
                        className="max-w-xs"
                        value={defaultMinStr}
                        onChange={(e) => setDefaultMinStr(e.target.value)}
                        onBlur={handleBlurDefaultMin}
                      />
                    </div>

                    <ProductosTab
                      products={products}
                      stockActual={stockActual}
                      onStockChange={handleStockChange}
                      onUpdateProduct={updateProduct}
                      onDeleteProduct={deleteProduct}
                      onCreateProduct={createProduct}
                      onImport={() => setImportDialogOpen(true)}
                      onProductsOrderUpdate={updateProductsOrder}
                      stockMinimoDefault={selectedPedido?.stockMinimoDefault ?? 0}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <PedidoFormDialog
        open={createPedidoOpen}
        onOpenChange={setCreatePedidoOpen}
        title="Crear Nuevo Pedido"
        description="Ingresa un nombre para el nuevo pedido"
        name={formName}
        onNameChange={setFormName}
        diasEnvio={formDiasEnvio}
        onDiasEnvioChange={setFormDiasEnvio}
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

      <FacturaImportDialog
        open={facturaImportOpen}
        onOpenChange={setFacturaImportOpen}
        products={products}
        stockActual={stockActual}
        onStockChange={handleStockChange}
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

      <ConfirmarNuevoEnlaceDialog
        open={confirmarNuevoEnlaceOpen}
        onOpenChange={setConfirmarNuevoEnlaceOpen}
        onConfirm={async () => {
          setConfirmarNuevoEnlaceOpen(false)
          await ejecutarGenerarEnlace()
        }}
      />
    </DashboardLayout>
  )
}
