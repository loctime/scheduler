"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Plus, Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { useStock } from "@/contexts/stock-context"
import { usePedidos } from "@/hooks/use-pedidos"
import { useEnlacePublico } from "@/hooks/use-enlace-publico"
import { useRemitos } from "@/hooks/use-remitos"
import { useRecepciones } from "@/hooks/use-recepciones"
import { usePedidoEngine } from "@/hooks/pedidos/use-pedido-engine"
import { usePedidoRecepcion } from "@/hooks/pedidos/use-pedido-recepcion"
import { usePedidoEnlaces } from "@/hooks/pedidos/use-pedido-enlaces"
import { usePedidoRemitos } from "@/hooks/pedidos/use-pedido-remitos"
import { usePedidoActions } from "@/hooks/pedidos/use-pedido-actions"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, serverTimestamp, getDoc, updateDoc, deleteDoc, deleteField } from "firebase/firestore"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { PedidosSidebar } from "@/components/pedidos/pedidos-sidebar"
import { PedidoHeader } from "@/components/pedidos/PedidoHeader"
import { PedidoActionsWithImageExport } from "@/components/pedidos/PedidoActionsWithImageExport"
import { PedidosTabs } from "@/components/pedidos/PedidosTabs"
import { ProductosTab } from "@/components/pedidos/ProductosTab"
import { RemitosTab } from "@/components/pedidos/RemitosTab"
import { RecepcionTab } from "@/components/pedidos/RecepcionTab"
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

export default function PedidosPage() {
  useEffect(() => {
    console.log("[PedidosPage] Componente montado")
    return () => {
      console.log("[PedidosPage] Componente desmontado")
    }
  }, [])

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
    calcularPedido,
    updatePedidoEstado,
    updateRemitoEnvio,
    updateEnlacePublico
  } = usePedidos(user)

  const {
    crearEnlacePublico,
    buscarEnlacesActivosPorPedido,
    obtenerEnlacePublico,
    desactivarEnlacesPorPedido,
    loading: loadingEnlace
  } = useEnlacePublico(user)
  const { crearRemito, obtenerRemitosPorPedido, descargarPDFRemito, obtenerRemito } = useRemitos(user)
  const { obtenerRecepcionesPorPedido, crearRecepcion } = useRecepciones(user)

  const stockActual = useMemo(() => {
    if (Object.keys(stockActualLocal).length > 0) {
      return { ...stockActualGlobal, ...stockActualLocal }
    }
    return stockActualGlobal || stockActualLocal
  }, [stockActualGlobal, stockActualLocal])

  const engine = usePedidoEngine(selectedPedido, products, stockActual)
  const { resultadoEngine, productosAPedirActualizados, ajustesPedido, handleAjustePedidoChange } = engine

  const [activeTab, setActiveTab] = useState<"productos" | "remitos" | "recepcion">("productos")

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
  const { enlaceActivo, setEnlaceActivo, handleGenerarEnlace, ejecutarGenerarEnlace } = enlaces

  const remitos = usePedidoRemitos({
    selectedPedido,
    products,
    stockActual,
    ajustesPedido,
    obtenerRemitosPorPedido,
    obtenerRecepcionesPorPedido,
    buscarEnlacesActivosPorPedido,
    crearRemito,
    updateRemitoEnvio,
    updatePedidoEstado,
    descargarPDFRemito,
    setEnlaceActivo,
    setSelectedPedido,
    calcularPedido
  })
  const { remitos: remitosList, setRemitos, recepciones, setRecepciones, handleGenerarRemitoEnvio } = remitos

  const recepcion = usePedidoRecepcion({
    activeTab,
    selectedPedido,
    ownerId,
    user,
    obtenerRemito,
    obtenerRemitosPorPedido,
    obtenerEnlacePublico,
    crearRecepcion,
    crearRemito,
    descargarPDFRemito,
    updatePedidoEstado,
    desactivarEnlacesPorPedido,
    setStockActual,
    setRemitos,
    setRecepciones,
    setEnlaceActivo,
    setSelectedPedido,
    obtenerRecepcionesPorPedido,
    setActiveTab
  })
  const {
    productosEnviados,
    observacionesRemito,
    loadingRecepcion,
    handleConfirmarRecepcion
  } = recepcion

  const actions = usePedidoActions({
    selectedPedido,
    products,
    productosAPedirActualizados,
    resultadoEngine,
    stockActual
  })
  const { handleCopyPedido, handleCopyStock, handleLlevarPedidoASheet, handleWhatsApp } = actions

  const [createPedidoOpen, setCreatePedidoOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [facturaImportOpen, setFacturaImportOpen] = useState(false)
  const [deletePedidoDialogOpen, setDeletePedidoDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [confirmarNuevoEnlaceOpen, setConfirmarNuevoEnlaceOpen] = useState(false)
  const [formName, setFormName] = useState("")
  const [importText, setImportText] = useState("")

  const [showConfig, setShowConfig] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingMensaje, setIsEditingMensaje] = useState(false)
  const [isEditingSheetUrl, setIsEditingSheetUrl] = useState(false)
  const [editingName, setEditingName] = useState("")
  const [editingMensaje, setEditingMensaje] = useState("")
  const [editingSheetUrl, setEditingSheetUrl] = useState("")
  const nameInputRef = useRef<HTMLInputElement>(null)
  const mensajeInputRef = useRef<HTMLInputElement>(null)
  const sheetUrlInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setIsEditingName(false)
    setIsEditingMensaje(false)
    setIsEditingSheetUrl(false)
    setActiveTab("productos")
    if (selectedPedido) {
      setEditingName(selectedPedido.nombre)
      setEditingMensaje(selectedPedido.mensajePrevio || "")
      setEditingSheetUrl(selectedPedido.sheetUrl || "")
    }
  }, [selectedPedido])

  const reiniciarPedido = async () => {
    if (!selectedPedido || !db || !user) return
    if (selectedPedido.estado !== "enviado") {
      toast({
        title: "Error",
        description: "Solo se pueden reiniciar pedidos en estado 'enviado'",
        variant: "destructive"
      })
      return
    }
    try {
      if (selectedPedido.remitoEnvioId) {
        try {
          await deleteDoc(doc(db, COLLECTIONS.REMITOS, selectedPedido.remitoEnvioId))
        } catch (deleteError: any) {
          console.error("Error al eliminar remito (continuando de todas formas):", deleteError)
        }
      }
      if (!ownerId) return
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id), {
        estado: "creado",
        remitoEnvioId: null,
        fechaEnvio: null,
        ownerId,
        userId: user.uid,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Pedido reiniciado", description: "El pedido ha vuelto a estado 'creado'" })
      const remitosData = await obtenerRemitosPorPedido(selectedPedido.id)
      setRemitos(remitosData)
    } catch (error: any) {
      console.error("Error al reiniciar pedido:", error)
      toast({
        title: "Error",
        description: error?.message?.includes("permissions")
          ? "Error de permisos. Asegúrate de que las reglas de Firestore estén desplegadas."
          : `No se pudo reiniciar el pedido: ${error?.message || "Error desconocido"}`,
        variant: "destructive"
      })
    }
  }

  const handleVerPedido = () => {
    if (!selectedPedido) return
    if (selectedPedido.estado === "enviado" || selectedPedido.estado === "recibido") {
      setActiveTab("recepcion")
      return
    }
    if (enlaceActivo) {
      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/pedido-publico/${enlaceActivo.id}`
      window.open(url, "_blank")
    }
  }

  const handleGenerarEnlacePublicoDesdeControl = async () => {
    if (flags.legacy.publicLinkReadOnly) {
      toast({
        title: "Enlaces publicos en modo solo lectura",
        description: "No se pueden crear enlaces nuevos desde el flujo legacy.",
        variant: "destructive"
      })
      return
    }

    if (!selectedPedido || !resultadoEngine) {
      toast({
        title: "Error",
        description: "No se pudo generar el pedido",
        variant: "destructive"
      })
      return
    }
    const enlace = await crearEnlacePublico(selectedPedido.id, resultadoEngine.cantidadesPedidas)
    if (enlace) {
      await updateEnlacePublico(selectedPedido.id, enlace.id)
      setEnlaceActivo({ id: enlace.id })
      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/pedido-publico/${enlace.id}`
      const textoCompleto = `${resultadoEngine.texto}\n\n\n${url}`
      navigator.clipboard.writeText(textoCompleto)
      toast({
        title: "Enlace copiado",
        description: "El pedido y el enlace público se han copiado al portapapeles"
      })
    }
  }

  const handleCopyEnlacePublico = () => {
    if (!resultadoEngine || !enlaceActivo) {
      toast({ title: "Error", description: "No se pudo generar el pedido", variant: "destructive" })
      return
    }

    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/pedido-publico/${enlaceActivo.id}`
    const textoCompleto = `${resultadoEngine.texto}\n\n\n${url}`
    navigator.clipboard.writeText(textoCompleto)
    toast({ title: "Pedido y enlace copiados", description: "El pedido y el enlace se han copiado al portapapeles" })
  }

  const handleAbrirLogisticaV2 = () => {
    router.push("/dashboard/v2/pedidos")
  }

  const handleOpenCreate = () => {
    setFormName("")
    setCreatePedidoOpen(true)
  }
  const handleCreatePedido = async () => {
    const result = await createPedido(formName, 1, DEFAULT_FORMAT)
    if (result) {
      setCreatePedidoOpen(false)
      setFormName("")
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
                <div className="rounded-lg border border-border bg-card p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 overflow-x-hidden">
                  <PedidoHeader
                    selectedPedido={selectedPedido}
                    showConfig={showConfig}
                    setShowConfig={setShowConfig}
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
                    onReiniciarPedido={reiniciarPedido}
                    onImportClick={() => setImportDialogOpen(true)}
                    onFacturaImportClick={() => setFacturaImportOpen(true)}
                    onDeleteClick={() => setDeletePedidoDialogOpen(true)}
                    nameInputRef={nameInputRef}
                    mensajeInputRef={mensajeInputRef}
                    sheetUrlInputRef={sheetUrlInputRef}
                  />

                  <PedidosTabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    selectedPedido={selectedPedido}
                    remitosCount={remitosList.length}
                    showV2Shortcut={flags.logisticsV2.enabled}
                    onOpenV2={handleAbrirLogisticaV2}
                  />

                  {products.length > 0 && (
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
                  )}
                </div>

                <div className={activeTab === "productos" ? "block" : "hidden"}>
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
                <div className={activeTab === "recepcion" ? "block" : "hidden"}>
                  <RecepcionTab
                    productosEnviados={productosEnviados}
                    observacionesRemito={observacionesRemito}
                    loadingRecepcion={loadingRecepcion}
                    onConfirmar={handleConfirmarRecepcion}
                    legacyDisabled={flags.logisticsV2.enabled}
                  />
                </div>
                <div className={activeTab === "remitos" ? "block" : "hidden"}>
                  <RemitosTab
                    selectedPedido={selectedPedido}
                    productosAPedirCount={productosAPedirActualizados.length}
                    enlaceActivo={enlaceActivo}
                    remitos={remitosList}
                    recepciones={recepciones}
                    resultadoEngine={resultadoEngine}
                    onGenerarRemitoEnvio={handleGenerarRemitoEnvio}
                    onGenerarEnlacePublico={handleGenerarEnlacePublicoDesdeControl}
                    onCopyEnlacePublico={handleCopyEnlacePublico}
                    onRegistrarRecepcion={() => setActiveTab("recepcion")}
                    onDownloadRemito={descargarPDFRemito}
                    legacyDisabled={flags.logisticsV2.enabled}
                  />
                </div>
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

