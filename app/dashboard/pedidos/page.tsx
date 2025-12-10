"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Plus, Trash2, Copy, MessageCircle, RotateCcw, Upload, Package, 
  Construction, Pencil, Check, X, Cog, ExternalLink, Link as LinkIcon,
  FileText, Download, Bell, Loader2, CheckCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { useStockChatContext } from "@/contexts/stock-chat-context"
import { usePedidos } from "@/hooks/use-pedidos"
import { useEnlacePublico } from "@/hooks/use-enlace-publico"
import { useRemitos } from "@/hooks/use-remitos"
import { useRecepciones } from "@/hooks/use-recepciones"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, setDoc, serverTimestamp, getDoc, updateDoc, deleteDoc } from "firebase/firestore"
import type { Remito, Recepcion } from "@/lib/types"
import { PedidoTimeline } from "@/components/pedidos/pedido-timeline"
import { crearRemitoPedido, crearRemitoRecepcion } from "@/lib/remito-utils"
import Link from "next/link"
import { PedidosSidebar } from "@/components/pedidos/pedidos-sidebar"
import { ProductosTable } from "@/components/pedidos/productos-table"
import { RecepcionForm } from "@/components/pedidos/recepcion-form"
import { 
  PedidoFormDialog, 
  ImportDialog, 
  DeletePedidoDialog, 
  ClearStockDialog,
  ConfirmarNuevoEnlaceDialog,
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
    updatePedidoEstado,
    updateRemitoEnvio,
    updateEnlacePublico,
  } = usePedidos(user)

  const { crearEnlacePublico, buscarEnlacesActivosPorPedido, obtenerEnlacePublico, loading: loadingEnlace } = useEnlacePublico(user)
  const { crearRemito, obtenerRemitosPorPedido, descargarPDFRemito, obtenerRemito } = useRemitos(user)
  const { obtenerRecepcionesPorPedido, crearRecepcion } = useRecepciones(user)
  
  // Función para reiniciar pedido (eliminar remito de envío y volver a estado "creado")
  const reiniciarPedido = async () => {
    if (!selectedPedido || !db || !user) return
    
    if (selectedPedido.estado !== "enviado") {
      toast({
        title: "Error",
        description: "Solo se pueden reiniciar pedidos en estado 'enviado'",
        variant: "destructive",
      })
      return
    }
    
    try {
      // 1. Intentar eliminar el remito de envío si existe
      if (selectedPedido.remitoEnvioId) {
        try {
          await deleteDoc(doc(db, COLLECTIONS.REMITOS, selectedPedido.remitoEnvioId))
          console.log("Remito de envío eliminado:", selectedPedido.remitoEnvioId)
        } catch (deleteError: any) {
          console.error("Error al eliminar remito (continuando de todas formas):", deleteError)
          // Si falla la eliminación del remito, continuamos de todas formas
          // El remito quedará huérfano pero el pedido se reiniciará
        }
      }
      
      // 2. Actualizar el pedido: cambiar estado a "creado" y eliminar remitoEnvioId y fechaEnvio
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id), {
        estado: "creado",
        remitoEnvioId: null,
        fechaEnvio: null,
        updatedAt: serverTimestamp(),
      })
      
      toast({
        title: "Pedido reiniciado",
        description: "El pedido ha vuelto a estado 'creado'",
      })
      
      // Recargar remitos
      const remitosData = await obtenerRemitosPorPedido(selectedPedido.id)
      setRemitos(remitosData)
    } catch (error: any) {
      console.error("Error al reiniciar pedido:", error)
      toast({
        title: "Error",
        description: error?.message?.includes("permissions") 
          ? "Error de permisos. Asegúrate de que las reglas de Firestore estén desplegadas."
          : `No se pudo reiniciar el pedido: ${error?.message || "Error desconocido"}`,
        variant: "destructive",
      })
    }
  }
  
  // Estado para remitos
  const [remitos, setRemitos] = useState<Remito[]>([])
  
  // Estado para recepciones
  const [recepciones, setRecepciones] = useState<Recepcion[]>([])
  
  // Estado para enlace público activo
  const [enlaceActivo, setEnlaceActivo] = useState<{ id: string } | null>(null)
  
  // Estado para recepción
  const [productosEnviados, setProductosEnviados] = useState<Array<{
    productoId: string
    productoNombre: string
    cantidadPedida: number
    cantidadEnviada: number
  }>>([])
  const [observacionesRemito, setObservacionesRemito] = useState<string | null>(null)
  const [loadingRecepcion, setLoadingRecepcion] = useState(false)
  
  // Mejorar la lógica de merge: los cambios locales tienen prioridad sobre los globales
  // Esto evita que el listener de Firestore sobrescriba los cambios del usuario
  const stockActual = useMemo(() => {
    // Si hay cambios locales, combinarlos con los globales (locales tienen prioridad)
    if (Object.keys(stockActualLocal).length > 0) {
      return { ...stockActualGlobal, ...stockActualLocal }
    }
    // Si no hay cambios locales, usar los globales
    return stockActualGlobal || stockActualLocal
  }, [stockActualGlobal, stockActualLocal])
  
  // Estado para ajustes manuales de pedido (no afecta el stock real)
  const [ajustesPedido, setAjustesPedido] = useState<Record<string, number>>({})
  
  // Función para calcular pedido con ajuste
  const calcularPedidoConAjuste = useCallback((stockMinimo: number, stockActualValue: number | undefined, productoId: string): number => {
    const pedidoBase = calcularPedido(stockMinimo, stockActualValue)
    const ajuste = ajustesPedido[productoId] ?? 0
    return Math.max(0, pedidoBase + ajuste)
  }, [calcularPedido, ajustesPedido])
  
  // Función para cambiar el ajuste de pedido
  const handleAjustePedidoChange = useCallback((productId: string, ajuste: number) => {
    setAjustesPedido(prev => {
      if (ajuste === 0) {
        const nuevo = { ...prev }
        delete nuevo[productId]
        return nuevo
      }
      return { ...prev, [productId]: ajuste }
    })
  }, [])
  
  // Recalcular productosAPedir con el stock global y ajustes
  const productosAPedirActualizados = useMemo(() => {
    return products.filter(p => calcularPedidoConAjuste(p.stockMinimo, stockActual[p.id], p.id) > 0)
  }, [products, stockActual, calcularPedidoConAjuste])
  
  // Dialog states
  const [createPedidoOpen, setCreatePedidoOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deletePedidoDialogOpen, setDeletePedidoDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [confirmarNuevoEnlaceOpen, setConfirmarNuevoEnlaceOpen] = useState(false)
  
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
  const [activeTab, setActiveTab] = useState<"productos" | "remitos" | "recepcion">("productos")

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

  // Cargar datos de recepción cuando se selecciona la pestaña de recepción
  useEffect(() => {
    const cargarDatosRecepcion = async () => {
      if (activeTab !== "recepcion" || !selectedPedido?.id) {
        setProductosEnviados([])
        setObservacionesRemito(null)
        return
      }

      if (!db) return

      setLoadingRecepcion(true)
      try {
        // Obtener productos enviados desde el remito de envío (si el pedido está en estado "enviado")
        if (selectedPedido.estado === "enviado" || selectedPedido.estado === "recibido") {
          let remitoEnvio = null
          if (selectedPedido.remitoEnvioId) {
            remitoEnvio = await obtenerRemito(selectedPedido.remitoEnvioId)
          }
          
          // Si no se encontró por ID, buscar en todos los remitos del pedido
          if (!remitoEnvio || !remitoEnvio.productos || remitoEnvio.productos.length === 0) {
            const remitos = await obtenerRemitosPorPedido(selectedPedido.id)
            
            if (selectedPedido.remitoEnvioId) {
              remitoEnvio = remitos.find(r => r.id === selectedPedido.remitoEnvioId && r.tipo === "envio")
            }
            
            if (!remitoEnvio) {
              remitoEnvio = remitos.find(r => r.tipo === "envio")
            }
          }
          
          if (remitoEnvio && remitoEnvio.productos && remitoEnvio.productos.length > 0) {
            // Guardar observaciones del remito si existen
            if (remitoEnvio.observaciones) {
              setObservacionesRemito(remitoEnvio.observaciones)
            }
            
            // Filtrar y mapear productos con cantidadEnviada > 0
            const productos = remitoEnvio.productos
              .filter((p: any) => {
                const cantidadEnviada = p.cantidadEnviada || 0
                return cantidadEnviada > 0
              })
              .map((p: any) => ({
                productoId: p.productoId,
                productoNombre: p.productoNombre,
                cantidadPedida: p.cantidadPedida || 0,
                cantidadEnviada: p.cantidadEnviada || 0,
              }))
            
            setProductosEnviados(productos)
          }
        } else {
          // Fallback: buscar en enlace público si existe (para pedidos antiguos)
          if (selectedPedido.enlacePublicoId) {
            const enlace = await obtenerEnlacePublico(selectedPedido.enlacePublicoId)
            
            if (enlace?.productosDisponibles) {
              const productos: typeof productosEnviados = []
              
              // Necesitamos obtener los productos del pedido para tener los nombres
              const { collection, query, where, getDocs } = await import("firebase/firestore")
              const productosQuery = query(
                collection(db, COLLECTIONS.PRODUCTS),
                where("pedidoId", "==", selectedPedido.id)
              )
              const productosSnapshot = await getDocs(productosQuery)
              const productosData = productosSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as any[]

              // Construir lista de productos enviados
              Object.entries(enlace.productosDisponibles).forEach(([productoId, data]: [string, any]) => {
                if (data.disponible && data.cantidadEnviada) {
                  const producto = productosData.find(p => p.id === productoId)
                  if (producto) {
                    productos.push({
                      productoId: producto.id,
                      productoNombre: producto.nombre,
                      cantidadPedida: producto.stockMinimo || 0,
                      cantidadEnviada: data.cantidadEnviada,
                    })
                  }
                }
              })

              setProductosEnviados(productos)
            }
          }
        }
      } catch (error) {
        console.error("Error al cargar datos de recepción:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos de recepción",
          variant: "destructive",
        })
      } finally {
        setLoadingRecepcion(false)
      }
    }

    cargarDatosRecepcion()
  }, [activeTab, selectedPedido?.id, selectedPedido?.estado, selectedPedido?.remitoEnvioId, selectedPedido?.enlacePublicoId, obtenerRemito, obtenerRemitosPorPedido, obtenerEnlacePublico, toast])

  // Cargar remitos, recepciones y enlaces activos cuando cambia el pedido seleccionado
  useEffect(() => {
    const cargarDatos = async () => {
      if (!selectedPedido?.id) {
        setRemitos([])
        setRecepciones([])
        setEnlaceActivo(null)
        return
      }
      
      try {
        const remitosData = await obtenerRemitosPorPedido(selectedPedido.id)
        setRemitos(remitosData)
        
        const recepcionesData = await obtenerRecepcionesPorPedido(selectedPedido.id)
        setRecepciones(recepcionesData)
        
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
        setRecepciones([])
        setEnlaceActivo(null)
      }
    }
    
    cargarDatos()
  }, [selectedPedido?.id, obtenerRemitosPorPedido, obtenerRecepcionesPorPedido, buscarEnlacesActivosPorPedido])

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

  // Generar texto del pedido con ajustes
  const generarTextoPedidoConAjustes = useCallback((): string => {
    if (!selectedPedido) return ""
    
    const lineas = productosAPedirActualizados.map(p => {
      const cantidad = calcularPedidoConAjuste(p.stockMinimo, stockActual[p.id], p.id)
      let texto = selectedPedido.formatoSalida
      texto = texto.replace(/{nombre}/g, p.nombre)
      texto = texto.replace(/{cantidad}/g, cantidad.toString())
      texto = texto.replace(/{unidad}/g, p.unidad || "")
      return texto.trim()
    })
    
    // Usar mensaje previo personalizado o el default con emoji
    const encabezado = selectedPedido.mensajePrevio?.trim() || `📦 ${selectedPedido.nombre}`
    
    return `${encabezado}\n\n${lineas.join("\n")}\n\nTotal: ${productosAPedirActualizados.length} productos`
  }, [selectedPedido, productosAPedirActualizados, stockActual, calcularPedidoConAjuste])

  const handleCopyPedido = async () => {
    if (productosAPedirActualizados.length === 0) {
      toast({ title: "Sin pedidos", description: "No hay productos que pedir" })
      return
    }
    try {
      await navigator.clipboard.writeText(generarTextoPedidoConAjustes())
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
    const encoded = encodeURIComponent(generarTextoPedidoConAjustes())
    window.open(`https://wa.me/?text=${encoded}`, "_blank")
  }

  const handleGenerarEnlace = async () => {
    if (!selectedPedido) return

    // Verificar si el pedido está esperando recepción
    if (selectedPedido.estado === "enviado") {
      toast({
        title: "No se puede generar enlace",
        description: "Este pedido está esperando recepción. Completa la recepción antes de generar un nuevo enlace.",
        variant: "destructive",
      })
      return
    }

    // Verificar si el pedido está recibido (pero no completado, ya que completado permite nuevo link)
    if (selectedPedido.estado === "recibido") {
      toast({
        title: "No se puede generar enlace",
        description: "Este pedido está en proceso de recepción. Completa la recepción antes de generar un nuevo enlace.",
        variant: "destructive",
      })
      return
    }

    // Si ya existe un enlace activo, pedir confirmación
    if (enlaceActivo) {
      setConfirmarNuevoEnlaceOpen(true)
      return
    }

    // Si no hay enlace activo, generar directamente
    await ejecutarGenerarEnlace()
  }

  // Función para ejecutar la generación del enlace
  const ejecutarGenerarEnlace = async () => {
    if (!selectedPedido) return

    try {
      // Calcular cantidades a pedir solo para productos que realmente necesitan ser pedidos
      const cantidadesPedidas: Record<string, number> = {}
      products.forEach(p => {
        const cantidad = calcularPedidoConAjuste(p.stockMinimo, stockActual[p.id], p.id)
        if (cantidad > 0) {
          cantidadesPedidas[p.id] = cantidad // Solo guardar productos que necesitan ser pedidos
          console.log(`Producto ${p.nombre}: stockMinimo=${p.stockMinimo}, stockActual=${stockActual[p.id]}, cantidadPedida=${cantidad}`)
        }
      })
      console.log("Cantidades a pedir calculadas (solo > 0):", cantidadesPedidas)
      
      const nuevoEnlace = await crearEnlacePublico(selectedPedido.id, cantidadesPedidas)
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
    if (!selectedPedido) return

    // Si el pedido está en estado "enviado" o "recibido", cambiar a la pestaña de recepción
    if (selectedPedido.estado === "enviado" || selectedPedido.estado === "recibido") {
      setActiveTab("recepcion")
      return
    }

    // Si hay enlace activo y no está enviado, ver el pedido público
    if (enlaceActivo) {
      const url = `${window.location.origin}/pedido-publico/${enlaceActivo.id}`
      window.open(url, "_blank")
    }
  }

  // Handler para confirmar recepción
  const handleConfirmarRecepcion = async (
    recepcionData: Omit<Recepcion, "id" | "createdAt">
  ) => {
    if (!selectedPedido) return

    setLoadingRecepcion(true)
    try {
      // Crear recepción
      const recepcion = await crearRecepcion({
        ...recepcionData,
        pedidoId: selectedPedido.id,
        userId: user.uid,
      })

      if (!recepcion) return

      // Buscar remitos anteriores (pedido y envío) para consolidar
      const remitosAnteriores = await obtenerRemitosPorPedido(selectedPedido.id)
      const remitoPedido = remitosAnteriores.find(r => r.tipo === "pedido") || null
      const remitoEnvio = remitosAnteriores.find(r => r.tipo === "envio") || null

      // Generar remito de recepción consolidado
      const remitoData = crearRemitoRecepcion(selectedPedido, recepcion, remitoPedido, remitoEnvio)
      const remito = await crearRemito(remitoData, selectedPedido.nombre)

      if (remito && db) {
        // Actualizar recepción con remito ID
        await updateDoc(doc(db, COLLECTIONS.RECEPCIONES, recepcion.id), {
          remitoId: remito.id,
        })

        // Actualizar estado del pedido
        // Si la recepción no es parcial, marcar como completado automáticamente
        const nuevoEstado = recepcionData.esParcial ? "recibido" : "completado"
        await updatePedidoEstado(selectedPedido.id, nuevoEstado, undefined, new Date())

        // Descargar PDF del remito
        await descargarPDFRemito(remito)

        // Recargar datos
        const remitosData = await obtenerRemitosPorPedido(selectedPedido.id)
        setRemitos(remitosData)
        
        const recepcionesData = await obtenerRecepcionesPorPedido(selectedPedido.id)
        setRecepciones(recepcionesData)

        // Recargar pedido desde Firestore
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id))
        if (pedidoDoc.exists()) {
          setSelectedPedido({ id: pedidoDoc.id, ...pedidoDoc.data() } as any)
        }

        toast({
          title: "Recepción registrada",
          description: "La recepción se ha registrado y el remito se ha generado",
        })

        // Cambiar a la pestaña de remitos para ver el nuevo remito
        setActiveTab("remitos")
      }
    } catch (error) {
      console.error("Error al confirmar recepción:", error)
      toast({
        title: "Error",
        description: "No se pudo registrar la recepción",
        variant: "destructive",
      })
    } finally {
      setLoadingRecepcion(false)
    }
  }

  // Funciones de control del pedido
  const handleGenerarRemitoEnvio = async () => {
    if (!selectedPedido || !products.length) return

    const remitoData = crearRemitoPedido(selectedPedido, products, stockActual, calcularPedido, ajustesPedido)
    const remito = await crearRemito(remitoData, selectedPedido.nombre)
    
    if (remito) {
      await updateRemitoEnvio(selectedPedido.id, remito.id)
      await updatePedidoEstado(selectedPedido.id, "enviado", new Date())
      await descargarPDFRemito(remito)
      
      // Recargar remitos y pedido
      const remitosData = await obtenerRemitosPorPedido(selectedPedido.id)
      setRemitos(remitosData)
      
      // Recargar pedido desde Firestore
      if (db) {
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id))
        if (pedidoDoc.exists()) {
          setSelectedPedido({ id: pedidoDoc.id, ...pedidoDoc.data() } as any)
        }
      }
    }
  }

  const handleGenerarEnlacePublicoDesdeControl = async () => {
    if (!selectedPedido) return

    // Calcular cantidades a pedir solo para productos que realmente necesitan ser pedidos
    const cantidadesPedidas: Record<string, number> = {}
    products.forEach(p => {
      const cantidad = calcularPedidoConAjuste(p.stockMinimo, stockActual[p.id], p.id)
      if (cantidad > 0) {
        cantidadesPedidas[p.id] = cantidad // Solo guardar productos que necesitan ser pedidos
      }
    })
    
    const enlace = await crearEnlacePublico(selectedPedido.id, cantidadesPedidas)
    if (enlace) {
      await updateEnlacePublico(selectedPedido.id, enlace.id)
      setEnlaceActivo({ id: enlace.id })
      
      const url = `${window.location.origin}/pedido-publico/${enlace.id}`
      navigator.clipboard.writeText(url)
      toast({
        title: "Enlace copiado",
        description: "El enlace público se ha copiado al portapapeles",
      })
    }
  }


  const handleStockChange = async (productId: string, value: number) => {
    // Actualizar estado local inmediatamente para feedback visual
    setStockActual(prev => ({ ...prev, [productId]: value }))
    
    // Actualizar en Firestore para sincronizar con el contexto global
    try {
      if (!db || !user || !selectedPedido) return
      
      const stockDocId = `${user.uid}_${productId}`
      const stockDocRef = doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId)
      
      await setDoc(stockDocRef, {
        productoId: productId, // Corregir: usar productoId en lugar de productId
        pedidoId: selectedPedido.id, // Agregar pedidoId
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
                  {/* Fila 1: Nombre + pestañas + acciones */}
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
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
                      <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
                        <h2 className="text-base font-bold text-foreground truncate">{selectedPedido.nombre}</h2>
                        <Button variant="ghost" size="icon" onClick={handleStartEditName} className="h-6 w-6 shrink-0 text-muted-foreground">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Tabs: Productos / Remitos / Recepción */}
                    <div className="flex gap-1 border-l border-r border-border px-2 flex-shrink-0">
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
                      {(selectedPedido.estado === "enviado" || selectedPedido.estado === "recibido") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 px-3 rounded-none border-b-2 border-transparent",
                            activeTab === "recepcion" && "border-primary text-primary font-medium"
                          )}
                          onClick={() => setActiveTab("recepcion")}
                        >
                          Recepción
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex gap-1 shrink-0 ml-auto">
                      {selectedPedido.estado === "enviado" && (
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 text-amber-600 hover:text-amber-700" 
                          onClick={reiniciarPedido}
                          title="Reiniciar pedido (volver a estado 'creado' y eliminar remito de envío)"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
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
                        <span className="hidden sm:inline text-xs">Copiar pedido</span>
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={handleGenerarEnlace}
                        disabled={productosAPedirActualizados.length === 0 || selectedPedido?.estado === "enviado" || selectedPedido?.estado === "recibido" || loadingEnlace}
                        title="Generar nuevo enlace público"
                      >
                        {loadingEnlace ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 sm:mr-1 animate-spin" />
                            <span className="hidden sm:inline text-xs">Generando...</span>
                          </>
                        ) : (
                          <>
                            <LinkIcon className="h-3.5 w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline text-xs">Generar link</span>
                          </>
                        )}
                      </Button>
                      {(enlaceActivo || selectedPedido?.estado === "enviado") && (
                        <Button 
                          size="sm"
                          variant="outline"
                          className={cn(
                            "h-7 px-2 relative",
                            selectedPedido?.estado === "enviado" && "bg-amber-50 border-amber-300 hover:bg-amber-100 dark:bg-amber-950 dark:border-amber-800"
                          )}
                          onClick={handleVerPedido}
                          title={
                            selectedPedido?.estado === "enviado" 
                              ? "Controlar recepción del pedido enviado"
                              : "Ver pedido público (solo lectura)"
                          }
                        >
                          {selectedPedido?.estado === "enviado" && (
                            <Bell className="h-3.5 w-3.5 sm:mr-1 text-amber-600 dark:text-amber-400 animate-pulse" />
                          )}
                          {selectedPedido?.estado !== "enviado" && (
                            <ExternalLink className="h-3.5 w-3.5 sm:mr-1" />
                          )}
                          <span className="hidden sm:inline text-xs">
                            {selectedPedido?.estado === "enviado" ? "Controlar recepción" : "Ver pedido"}
                          </span>
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
                  ajustesPedido={ajustesPedido}
                  onAjustePedidoChange={handleAjustePedidoChange}
                  configMode={showConfig}
                />
              ) : activeTab === "recepcion" ? (
                <div className="space-y-3 md:space-y-4">
                  {loadingRecepcion ? (
                    <div className="flex items-center justify-center h-64 md:h-96">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : productosEnviados.length === 0 ? (
                    <div className="rounded-lg border bg-card p-4 md:p-6 text-center">
                      <Package className="h-8 w-8 md:h-10 md:w-10 mx-auto text-muted-foreground mb-2 md:mb-3" />
                      <h3 className="text-sm md:text-base font-semibold mb-1">No hay productos para recibir</h3>
                      <p className="text-muted-foreground text-xs md:text-sm">
                        Primero debe generarse un remito de envío para poder registrar la recepción.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-card p-2.5 md:p-4 space-y-3 md:space-y-4">
                      {observacionesRemito && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-2.5 md:p-3">
                          <h4 className="font-semibold text-xs mb-1.5 md:mb-2 text-blue-900 dark:text-blue-100">
                            Observaciones del envío:
                          </h4>
                          <p className="text-xs text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                            {observacionesRemito}
                          </p>
                        </div>
                      )}
                      <RecepcionForm
                        productosEnviados={productosEnviados}
                        onConfirmar={handleConfirmarRecepcion}
                        loading={loadingRecepcion}
                        esParcial={false}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Timeline y Acciones fusionados */}
                  {selectedPedido && (
                    <div className="rounded-lg border bg-card">
                      <div className="p-3 border-b border-border">
                        <h3 className="text-sm font-semibold">Estado del Pedido</h3>
                      </div>
                      <div className="p-3">
                        <PedidoTimeline pedido={selectedPedido} />
                      </div>
                      <div className="p-3 border-t border-border">
                        <div className="flex flex-wrap gap-2">
                          {selectedPedido.estado === "creado" && productosAPedirActualizados.length > 0 && (
                            <Button onClick={handleGenerarRemitoEnvio} size="sm">
                              <FileText className="h-4 w-4 mr-2" />
                              Generar Remito de Envío
                            </Button>
                          )}
                          
                          {selectedPedido.estado === "enviado" && !enlaceActivo && (
                            <Button onClick={handleGenerarEnlacePublicoDesdeControl} size="sm" variant="outline">
                              <LinkIcon className="h-4 w-4 mr-2" />
                              Generar Enlace Público
                            </Button>
                          )}

                          {enlaceActivo && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const url = `${window.location.origin}/pedido-publico/${enlaceActivo.id}`
                                navigator.clipboard.writeText(url)
                                toast({ title: "Enlace copiado" })
                              }}
                            >
                              <LinkIcon className="h-4 w-4 mr-2" />
                              Copiar Enlace Público
                            </Button>
                          )}

                          {(selectedPedido.estado === "enviado" || selectedPedido.estado === "recibido") && (
                            <Button 
                              size="sm"
                              onClick={() => setActiveTab("recepcion")}
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Registrar Recepción
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remitos */}
                  <div className="rounded-lg border bg-card space-y-3">
                    <div className="p-3 border-b border-border">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Remitos ({remitos.length})
                        {remitos.some(r => r.final) && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (Completado)
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="p-3">
                      {remitos.length === 0 ? (
                      <div className="text-center py-6">
                        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          No hay remitos para este pedido
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Mostrar primero el remito final si existe, luego los demás */}
                        {[...remitos]
                          .sort((a, b) => {
                            if (a.final && !b.final) return -1
                            if (!a.final && b.final) return 1
                            return 0
                          })
                          .map((remito) => (
                          <div
                            key={remito.id}
                            className="flex items-center justify-between p-2.5 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {remito.tipo === "pedido" ? "📋 Remito de Pedido" : remito.tipo === "envio" ? "📤 Remito de Envío" : remito.tipo === "recepcion" ? "📥 Remito de Recepción" : "↩️ Remito de Devolución"} - {remito.numero}
                                {remito.final && " (Final)"}
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
                      )}
                    </div>
                  </div>

                  {/* Recepciones */}
                  {recepciones.length > 0 && (
                    <div className="rounded-lg border bg-card space-y-3">
                      <div className="p-3 border-b border-border">
                        <h3 className="text-sm font-semibold">Recepciones</h3>
                      </div>
                      <div className="p-3">
                        <div className="space-y-2">
                          {recepciones.map((recepcion) => (
                            <div
                              key={recepcion.id}
                              className="p-3 rounded-lg border bg-background"
                            >
                              <p className="text-xs font-medium">
                                Recepción {recepcion.esParcial ? "(Parcial)" : "(Completa)"}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {recepcion.fecha?.toDate 
                                  ? recepcion.fecha.toDate().toLocaleDateString("es-AR", { 
                                      day: "2-digit", 
                                      month: "2-digit", 
                                      year: "numeric" 
                                    })
                                  : "Sin fecha"}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Productos: {recepcion.productos.length}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
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
