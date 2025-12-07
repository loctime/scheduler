"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Plus, Trash2, Copy, MessageCircle, RotateCcw, Upload, Package, 
  Construction, Pencil, Check, X, Cog, ExternalLink, Link as LinkIcon,
  FileText, Download
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { useStockChatContext } from "@/contexts/stock-chat-context"
import { usePedidos } from "@/hooks/use-pedidos"
import { useEnlacePublico } from "@/hooks/use-enlace-publico"
import { useRemitos } from "@/hooks/use-remitos"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"
import type { Remito } from "@/lib/types"
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
  
  // Obtener stockActual del contexto global del chat
  const { stockActual: stockActualGlobal } = useStockChatContext()
  
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
    updateProduct,
    deleteProduct,
    clearStock,
    updateProductsOrder,
    calcularPedido,
    generarTextoPedido,
  } = usePedidos(user)

  const { crearEnlacePublico, buscarEnlacesActivosPorPedido } = useEnlacePublico(user)
  const { obtenerRemitosPorPedido, descargarPDFRemito } = useRemitos(user)
  
  // Estado para remitos
  const [remitos, setRemitos] = useState<Remito[]>([])
  
  // Estado para enlace público activo
  const [enlaceActivo, setEnlaceActivo] = useState<{ id: string } | null>(null)
  
  // Usar el stockActual del contexto global (del chat) en lugar del local
  // El local solo se usa para cambios manuales desde la tabla
  const stockActual = stockActualGlobal || stockActualLocal
  
  // Recalcular productosAPedir con el stock global
  const productosAPedirActualizados = useMemo(() => {
    return products.filter(p => calcularPedido(p.stockMinimo, stockActual[p.id]) > 0)
  }, [products, stockActual, calcularPedido])
  
  // Dialog states
  const [createPedidoOpen, setCreatePedidoOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deletePedidoDialogOpen, setDeletePedidoDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  
  // Form states
  const [formName, setFormName] = useState("")
  const [importText, setImportText] = useState("")

  // Inline edit states
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingMensaje, setIsEditingMensaje] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [editingName, setEditingName] = useState("")
  const [editingMensaje, setEditingMensaje] = useState("")
  const nameInputRef = useRef<HTMLInputElement>(null)
  const mensajeInputRef = useRef<HTMLInputElement>(null)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"productos" | "remitos">("productos")

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

  // Ya no cargamos enlaces existentes - siempre generamos nuevos

  // Reset edit states when selectedPedido changes
  useEffect(() => {
    setIsEditingName(false)
    setIsEditingMensaje(false)
    setActiveTab("productos") // Reset tab when changing pedido
    if (selectedPedido) {
      setEditingName(selectedPedido.nombre)
      setEditingMensaje(selectedPedido.mensajePrevio || "")
    }
  }, [selectedPedido])

  // Cargar remitos y enlaces activos cuando cambia el pedido seleccionado
  useEffect(() => {
    const cargarDatos = async () => {
      if (!selectedPedido?.id) {
        setRemitos([])
        setEnlaceActivo(null)
        return
      }
      
      try {
        const remitosData = await obtenerRemitosPorPedido(selectedPedido.id)
        setRemitos(remitosData)
        
        // Buscar enlaces públicos activos para este pedido
        const enlacesActivos = await buscarEnlacesActivosPorPedido(selectedPedido.id)
        if (enlacesActivos.length > 0) {
          // Usar el enlace más reciente (último creado)
          const enlaceMasReciente = enlacesActivos.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0
            const bTime = b.createdAt?.toMillis?.() || 0
            return bTime - aTime
          })[0]
          setEnlaceActivo({ id: enlaceMasReciente.id })
        } else {
          setEnlaceActivo(null)
        }
      } catch (error) {
        console.error("Error al cargar datos:", error)
        setRemitos([])
        setEnlaceActivo(null)
      }
    }
    
    cargarDatos()
  }, [selectedPedido?.id, obtenerRemitosPorPedido, buscarEnlacesActivosPorPedido])

  // Handlers
  const handleOpenCreate = () => {
    setFormName("")
    setCreatePedidoOpen(true)
  }

  const handleCreatePedido = async () => {
    // Usar valores por defecto: stockMin = 1, format = DEFAULT_FORMAT
    const result = await createPedido(formName, 1, DEFAULT_FORMAT)
    if (result) {
      setCreatePedidoOpen(false)
      setFormName("")
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
    if (productosAPedirActualizados.length === 0) {
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
    if (productosAPedirActualizados.length === 0) {
      toast({ title: "Sin pedidos", description: "No hay productos que pedir" })
      return
    }
    const encoded = encodeURIComponent(generarTextoPedido())
    window.open(`https://wa.me/?text=${encoded}`, "_blank")
  }

  const handleGenerarEnlace = async () => {
    if (!selectedPedido) return

    // Verificar si el pedido ya está enviado
    if (selectedPedido.estado === "enviado" || selectedPedido.estado === "recibido" || selectedPedido.estado === "completado") {
      toast({
        title: "No se puede generar enlace",
        description: "Este pedido ya fue enviado. No se pueden generar nuevos enlaces.",
        variant: "destructive",
      })
      return
    }

    try {
      // Siempre crear un nuevo enlace (no reutilizar)
      const nuevoEnlace = await crearEnlacePublico(selectedPedido.id)
      if (nuevoEnlace) {
        setEnlaceActivo({ id: nuevoEnlace.id })
        const url = `${window.location.origin}/pedido-publico/${nuevoEnlace.id}`
        await navigator.clipboard.writeText(url)
        toast({
          title: "Enlace generado y copiado",
          description: "El nuevo enlace público se ha generado y copiado al portapapeles",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo generar el enlace",
        variant: "destructive",
      })
    }
  }

  const handleVerPedido = () => {
    if (!enlaceActivo) return
    const url = `${window.location.origin}/pedido-publico/${enlaceActivo.id}`
    window.open(url, "_blank")
  }

  const handleStockChange = async (productId: string, value: number) => {
    // Actualizar estado local inmediatamente para feedback visual
    setStockActual(prev => ({ ...prev, [productId]: value }))
    
    // Actualizar en Firestore para sincronizar con el contexto global
    try {
      if (!db || !user) return
      
      const stockDocId = `${user.uid}_${productId}`
      const stockDocRef = doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId)
      
      await setDoc(stockDocRef, {
        productId,
        cantidad: value,
        ultimaActualizacion: serverTimestamp(),
        userId: user.uid,
      }, { merge: true })
    } catch (error) {
      console.error("Error actualizando stock:", error)
      // Revertir cambio local si falla
      setStockActual(prev => ({ ...prev, [productId]: stockActualGlobal[productId] ?? 0 }))
    }
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
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => window.location.href = `/dashboard/pedidos/${selectedPedido.id}`}
                        title="Ver detalle y control"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant={showConfig ? "default" : "outline"} 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => setShowConfig(!showConfig)}
                        title="Configuración"
                      >
                        <Cog className="h-5 w-5" />
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

                  {/* Tabs: Productos / Remitos */}
                  <div className="flex gap-1 border-b border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 px-3 rounded-none border-b-2 border-transparent",
                        activeTab === "productos" && "border-primary text-primary font-medium"
                      )}
                      onClick={() => setActiveTab("productos")}
                    >
                      Productos
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 px-3 rounded-none border-b-2 border-transparent",
                        activeTab === "remitos" && "border-primary text-primary font-medium"
                      )}
                      onClick={() => setActiveTab("remitos")}
                    >
                      Remitos {remitos.length > 0 && `(${remitos.length})`}
                    </Button>
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
                        productosAPedirActualizados.length > 0 
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}>
                        {productosAPedir.length > 0 
                          ? `${productosAPedirActualizados.length} a pedir`
                          : "✓ OK"
                        }
                      </span>
                      <div className="flex-1" />
                      <Button 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={handleCopyPedido} 
                        disabled={productosAPedirActualizados.length === 0}
                      >
                        <Copy className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">Copiar</span>
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={handleGenerarEnlace}
                        disabled={productosAPedirActualizados.length === 0 || selectedPedido?.estado === "enviado" || selectedPedido?.estado === "recibido" || selectedPedido?.estado === "completado"}
                        title="Generar nuevo enlace público"
                      >
                        <LinkIcon className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">Generar link</span>
                      </Button>
                      {enlaceActivo && (
                        <Button 
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={handleVerPedido}
                          title="Ver pedido público (solo lectura)"
                        >
                          <ExternalLink className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline text-xs">Ver pedido</span>
                        </Button>
                      )}
                      <Button 
                        size="sm"
                        className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleWhatsApp} 
                        disabled={productosAPedirActualizados.length === 0}
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

              {/* Contenido de las pestañas */}
              {activeTab === "productos" ? (
                <ProductosTable
                  products={products}
                  stockActual={stockActual}
                  onStockChange={handleStockChange}
                  onUpdateProduct={updateProduct}
                  onDeleteProduct={deleteProduct}
                  onImport={() => setImportDialogOpen(true)}
                  onProductsOrderUpdate={updateProductsOrder}
                  calcularPedido={calcularPedido}
                  configMode={showConfig}
                />
              ) : (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  {remitos.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No hay remitos para este pedido
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Remitos ({remitos.length})
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {remitos.map((remito) => (
                          <div
                            key={remito.id}
                            className="flex items-center justify-between p-2.5 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {remito.tipo === "envio" ? "📤 Remito de Envío" : remito.tipo === "recepcion" ? "📥 Remito de Recepción" : "↩️ Remito de Devolución"} - {remito.numero}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {remito.fecha?.toDate 
                                  ? remito.fecha.toDate().toLocaleDateString("es-AR", { 
                                      day: "2-digit", 
                                      month: "2-digit", 
                                      year: "numeric" 
                                    })
                                  : "Sin fecha"}
                                {remito.desde && remito.hacia && ` • ${remito.desde} → ${remito.hacia}`}
                              </p>
                              {remito.productos && remito.productos.length > 0 && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {remito.productos.length} producto{remito.productos.length !== 1 ? "s" : ""}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 ml-2 shrink-0"
                              onClick={() => descargarPDFRemito(remito)}
                              title="Descargar PDF"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
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
