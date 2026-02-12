"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Plus, Trash2, Copy, MessageCircle, RotateCcw, Upload, Package, 
  Pencil, Check, X, Cog, ExternalLink, Link as LinkIcon,
  FileText, Download, Bell, Loader2, CheckCircle, AlertTriangle, ChevronDown
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { useStockChatContext } from "@/contexts/stock-chat-context"
import { usePedidos } from "@/hooks/use-pedidos"
import { useEnlacePublico } from "@/hooks/use-enlace-publico"
import { useRemitos } from "@/hooks/use-remitos"
import { useRecepciones } from "@/hooks/use-recepciones"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, setDoc, serverTimestamp, getDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where } from "firebase/firestore"
import type { Remito, Recepcion } from "@/lib/types"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PWAUpdateNotification } from "@/components/pwa-update-notification"

const FORMAT_EXAMPLES = [
  { format: "{nombre} ({cantidad})", example: "Leche (8)" },
  { format: "{cantidad} - {nombre}", example: "8 - Leche" },
  { format: "({cantidad}) {nombre}", example: "(8) Leche" },
  { format: "• {nombre}: {cantidad} {unidad}", example: "• Leche: 8 litros" },
  { format: "{nombre} x{cantidad}", example: "Leche x8" },
]

export default function PedidosPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  
  // Obtener stockActual del contexto global del chat
  const { stockActual: stockActualGlobal } = useStockChatContext()

  // El Service Worker se registra automáticamente mediante PWAUpdateNotification
  
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
    generarTextoPedido,
    updatePedidoEstado,
    updateRemitoEnvio,
    updateEnlacePublico,
  } = usePedidos(user)

  const { crearEnlacePublico, buscarEnlacesActivosPorPedido, obtenerEnlacePublico, desactivarEnlacesPorPedido, loading: loadingEnlace } = useEnlacePublico(user)
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
      if (!ownerId) return

      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, selectedPedido.id), {
        estado: "creado",
        remitoEnvioId: null,
        fechaEnvio: null,
        ownerId,
        userId: user.uid,
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
    observacionesEnvio?: string
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
  const [isEditingSheetUrl, setIsEditingSheetUrl] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [editingName, setEditingName] = useState("")
  const [editingMensaje, setEditingMensaje] = useState("")
  const [editingSheetUrl, setEditingSheetUrl] = useState("")
  const nameInputRef = useRef<HTMLInputElement>(null)
  const mensajeInputRef = useRef<HTMLInputElement>(null)
  const sheetUrlInputRef = useRef<HTMLInputElement>(null)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"productos" | "remitos" | "recepcion">("productos")
  // Vista: 'pedir' para ajustar cantidades a pedir, 'stock' para editar stock
  const [viewMode, setViewMode] = useState<"pedir" | "stock">("pedir")

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

  useEffect(() => {
    if (isEditingSheetUrl && sheetUrlInputRef.current) {
      sheetUrlInputRef.current.focus()
      sheetUrlInputRef.current.select()
    }
  }, [isEditingSheetUrl])

  // Ya no cargamos enlaces existentes - siempre generamos nuevos

  // Reset edit states when selectedPedido changes
  useEffect(() => {
    setIsEditingName(false)
    setIsEditingMensaje(false)
    setIsEditingSheetUrl(false)
    setActiveTab("productos") // Reset tab when changing pedido
    if (selectedPedido) {
      setEditingName(selectedPedido.nombre)
      setEditingMensaje(selectedPedido.mensajePrevio || "")
      setEditingSheetUrl(selectedPedido.sheetUrl || "")
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
          
          // Cargar TODOS los productos del pedido primero
          const { collection: col, query: q, where: w, getDocs: getDocsProducts } = await import("firebase/firestore")
          if (!ownerId) return

          const productosQuery = q(
            col(db, COLLECTIONS.PRODUCTS),
            w("pedidoId", "==", selectedPedido.id),
            w("ownerId", "==", ownerId)
          )
          const productosSnapshot = await getDocsProducts(productosQuery)
          const todosLosProductos = productosSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as any[]
          
          // Guardar observaciones del remito si existen
          if (remitoEnvio?.observaciones) {
            setObservacionesRemito(remitoEnvio.observaciones)
          }
          
          // Extraer observaciones del remito que tienen formato "Producto: observación"
          const observacionesPorProducto = new Map<string, string>()
          if (remitoEnvio?.observaciones) {
            const lineas = remitoEnvio.observaciones.split('\n')
            lineas.forEach(linea => {
              if (linea.includes(':')) {
                const [nombreProducto, ...resto] = linea.split(':')
                const observacion = resto.join(':').trim()
                if (observacion) {
                  observacionesPorProducto.set(nombreProducto.trim(), observacion)
                }
              }
            })
          }
          
          // Crear mapa de productos enviados desde el remito (por productoId)
          const productosEnviadosMap = new Map<string, { cantidadEnviada: number; cantidadPedida: number; observaciones?: string }>()
          if (remitoEnvio?.productos) {
            remitoEnvio.productos.forEach((p: any) => {
              productosEnviadosMap.set(p.productoId, {
                cantidadEnviada: p.cantidadEnviada || 0,
                cantidadPedida: p.cantidadPedida || 0,
                observaciones: p.observaciones || undefined, // Observaciones del producto individual
              })
            })
          }
          
          // Combinar todos los productos del pedido con la información del remito
          const productos = todosLosProductos.map((producto) => {
            const infoEnvio = productosEnviadosMap.get(producto.id)
            const cantidadEnviada = infoEnvio?.cantidadEnviada ?? 0
            const cantidadPedida = infoEnvio?.cantidadPedida ?? (producto.stockMinimo || 0)
            // Priorizar observaciones del producto individual, luego las del campo general
            const observacion = infoEnvio?.observaciones || observacionesPorProducto.get(producto.nombre) || undefined
            
            return {
              productoId: producto.id,
              productoNombre: producto.nombre,
              cantidadPedida: cantidadPedida,
              cantidadEnviada: cantidadEnviada,
              observacionesEnvio: observacion,
            }
          })
          
          setProductosEnviados(productos)
        } else {
          // Fallback: buscar en enlace público si existe (para pedidos antiguos)
          if (selectedPedido.enlacePublicoId) {
            const enlace = await obtenerEnlacePublico(selectedPedido.enlacePublicoId)
            
            // Cargar TODOS los productos del pedido
            const { collection: col, query: q, where: w, getDocs: getDocsProducts } = await import("firebase/firestore")
            if (!ownerId) return

            const productosQuery = q(
              col(db, COLLECTIONS.PRODUCTS),
              w("pedidoId", "==", selectedPedido.id),
              w("ownerId", "==", ownerId)
            )
            const productosSnapshot = await getDocsProducts(productosQuery)
            const todosLosProductos = productosSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as any[]
            
            // Crear mapa de productos disponibles desde el enlace
            const productosEnviadosMap = new Map<string, { cantidadEnviada: number; observaciones?: string }>()
            if (enlace?.productosDisponibles) {
              Object.entries(enlace.productosDisponibles).forEach(([productoId, data]: [string, any]) => {
                if (data.disponible !== false) {
                  productosEnviadosMap.set(productoId, {
                    cantidadEnviada: data.cantidadEnviada || 0,
                    observaciones: data.observaciones || undefined,
                  })
                }
              })
            }
            
            // Combinar todos los productos del pedido con la información del enlace
            const productos = todosLosProductos.map((producto) => {
              const infoEnvio = productosEnviadosMap.get(producto.id)
              const cantidadEnviada = infoEnvio?.cantidadEnviada ?? 0
              const cantidadPedida = producto.stockMinimo || 0
              
              return {
                productoId: producto.id,
                productoNombre: producto.nombre,
                cantidadPedida: cantidadPedida,
                cantidadEnviada: cantidadEnviada,
                observacionesEnvio: infoEnvio?.observaciones || undefined,
              }
            })

            setProductosEnviados(productos)
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

  // Listener en tiempo real para enlaces públicos del pedido seleccionado
  useEffect(() => {
    if (!selectedPedido?.id || !db || !user) {
      setEnlaceActivo(null)
      return
    }

    if (!ownerId) return

    const enlacesQuery = query(
      collection(db, COLLECTIONS.ENLACES_PUBLICOS),
      where("pedidoId", "==", selectedPedido.id),
      where("activo", "==", true),
      where("ownerId", "==", ownerId)
    )

    const enlaceRef = selectedPedido.enlacePublicoId ? doc(db, COLLECTIONS.ENLACES_PUBLICOS, selectedPedido.enlacePublicoId) : null
    
    if (enlaceRef) {
      const unsubscribe = onSnapshot(
        enlaceRef,
        (snapshot: any) => {
        if (!snapshot.exists()) {
          setEnlaceActivo(null)
          return
        }
        const data = snapshot.data() as any
        setEnlaceActivo(data.activo ? { id: snapshot.id } : null)
      },
      (error: any) => {
        console.error("Error en listener de enlaces:", error)
      }
    )

    return () => unsubscribe()
    } else {
      // No hay enlacePublicoId, limpiar enlace activo
      setEnlaceActivo(null)
      return () => {}
    }
  }, [selectedPedido?.id, selectedPedido?.enlacePublicoId, db, user])

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
      texto = texto.replace(/{cantidad}/g, (cantidad ?? 0).toString())
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

  // Función para copiar solo la columna "Pedir" y abrir Google Sheet
  const handleLlevarPedidoASheet = async () => {
    if (!selectedPedido?.sheetUrl) {
      toast({ 
        title: "Error", 
        description: "No hay link de Google Sheet configurado", 
        variant: "destructive" 
      })
      return
    }

    if (products.length === 0) {
      toast({ title: "Sin productos", description: "No hay productos para copiar" })
      return
    }

    try {
      // Copiar solo la columna "Pedir" (una línea por producto, respetando el orden actual)
      const cantidadesPedir = products.map(p => {
        const cantidad = calcularPedidoConAjuste(p.stockMinimo, stockActual[p.id], p.id)
        return (cantidad ?? 0).toString()
      })
      
      const textoACopiar = cantidadesPedir.join("\n")
      await navigator.clipboard.writeText(textoACopiar)
      
      // Abrir el Google Sheet en una nueva pestaña
      window.open(selectedPedido.sheetUrl, "_blank")
      
      toast({ 
        title: "Copiado y abierto", 
        description: "Las cantidades se copiaron al portapapeles y se abrió el Google Sheet" 
      })
    } catch (error) {
      console.error("Error al llevar pedido a Sheet:", error)
      toast({ 
        title: "Error", 
        description: "No se pudo copiar o abrir el Sheet", 
        variant: "destructive" 
      })
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
    // Si no hay pedido seleccionado, crear uno nuevo primero
    let pedidoAUsar = selectedPedido
    if (!pedidoAUsar) {
      // Crear un nuevo pedido con nombre por defecto
      const nombrePedido = `Pedido ${new Date().toLocaleDateString('es-AR')}`
      const nuevoPedido = await createPedido(nombrePedido, 1, DEFAULT_FORMAT)
      if (!nuevoPedido) {
        toast({
          title: "Error",
          description: "No se pudo crear el pedido",
          variant: "destructive",
        })
        return
      }
      setSelectedPedido(nuevoPedido)
      pedidoAUsar = nuevoPedido
    }

    // Verificar si el pedido está esperando recepción
    if (pedidoAUsar.estado === "enviado") {
      toast({
        title: "No se puede generar enlace",
        description: "Este pedido está esperando recepción. Completa la recepción antes de generar un nuevo enlace.",
        variant: "destructive",
      })
      return
    }

    // Verificar si el pedido está recibido (pero no completado, ya que completado permite nuevo link)
    if (pedidoAUsar.estado === "recibido") {
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
  // Verificar si el pedido está en processing antes de generar enlace
  const verificarPedidoEnProceso = () => {
    if (selectedPedido?.estado === "processing" && selectedPedido.assignedTo) {
      const assignedToNombre = selectedPedido.assignedToNombre || "otro usuario"
      toast({
        title: "Pedido en proceso",
        description: `Este pedido está siendo procesado por: ${assignedToNombre} - Fábrica. ¿Deseas crear un nuevo enlace?`,
        variant: "default",
      })
      return true
    }
    return false
  }

  const ejecutarGenerarEnlace = async () => {
    // Si no hay pedido seleccionado, crear uno nuevo primero
    let pedidoAUsar = selectedPedido
    if (!pedidoAUsar) {
      // Crear un nuevo pedido con nombre por defecto
      const nombrePedido = `Pedido ${new Date().toLocaleDateString('es-AR')}`
      const nuevoPedido = await createPedido(nombrePedido, 1, DEFAULT_FORMAT)
      if (!nuevoPedido) {
        toast({
          title: "Error",
          description: "No se pudo crear el pedido",
          variant: "destructive",
        })
        return
      }
      setSelectedPedido(nuevoPedido)
      pedidoAUsar = nuevoPedido
    }

    // Verificar si el pedido está en processing y mostrar warning
    if (verificarPedidoEnProceso()) {
      // El warning ya se mostró, continuar con la creación del enlace
    }

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
      
      const nuevoEnlace = await crearEnlacePublico(pedidoAUsar.id, cantidadesPedidas)
      if (nuevoEnlace) {
        setEnlaceActivo({ id: nuevoEnlace.id })
        const url = `${window.location.origin}/pedido-publico/${nuevoEnlace.id}`
        
        // Generar texto del pedido y combinarlo con el link
        const textoPedido = generarTextoPedidoConAjustes()
        const textoCompleto = `${textoPedido}\n\n\n${url}`
        
        await navigator.clipboard.writeText(textoCompleto)
        toast({
          title: "Enlace generado y copiado",
          description: "El pedido y el enlace público se han copiado al portapapeles",
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
    if (!selectedPedido || !ownerId) return

    setLoadingRecepcion(true)
    try {
      // Crear recepción
      const recepcion = await crearRecepcion({
        ...recepcionData,
        pedidoId: selectedPedido.id,
        ownerId,
        userId: user.uid,
      })

      if (!recepcion) return

      // Actualizar stock: sumar cantidad recibida
      if (db && recepcion.productos) {
        for (const productoRecepcion of recepcion.productos) {
          // Sumar la cantidad recibida al stock
          if (productoRecepcion.cantidadRecibida > 0) {
            try {
              const stockDocId = `${ownerId}_${productoRecepcion.productoId}`
              const stockDocRef = doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId)
              
              // Intentar actualizar usando transacción o incremento
              // Primero intentar actualizar (si existe)
              try {
                const stockDoc = await getDoc(stockDocRef)
                if (stockDoc.exists()) {
                  const stockActual = stockDoc.data().cantidad || 0
                  const nuevoStock = stockActual + productoRecepcion.cantidadRecibida
                  await updateDoc(stockDocRef, {
                    cantidad: nuevoStock,
                    ultimaActualizacion: serverTimestamp(),
                    ownerId,
                    userId: user.uid,
                  })
                  setStockActual(prev => ({ ...prev, [productoRecepcion.productoId]: nuevoStock }))
                } else {
                  // Crear nuevo documento
                  await setDoc(stockDocRef, {
                    productoId: productoRecepcion.productoId,
                    pedidoId: selectedPedido.id,
                    cantidad: productoRecepcion.cantidadRecibida,
                    ultimaActualizacion: serverTimestamp(),
                    ownerId,
                    userId: user.uid,
                  })
                  setStockActual(prev => ({ ...prev, [productoRecepcion.productoId]: productoRecepcion.cantidadRecibida }))
                }
              } catch (error: any) {
                // Si falla la lectura o actualización, intentar crear directamente
                if (error?.code === 'permission-denied' || error?.code === 'not-found') {
                  await setDoc(stockDocRef, {
                    productoId: productoRecepcion.productoId,
                    pedidoId: selectedPedido.id,
                    cantidad: productoRecepcion.cantidadRecibida,
                    ultimaActualizacion: serverTimestamp(),
                    ownerId,
                    userId: user.uid,
                  })
                  setStockActual(prev => ({ ...prev, [productoRecepcion.productoId]: productoRecepcion.cantidadRecibida }))
                } else {
                  throw error
                }
              }
            } catch (stockError) {
              console.error("Error al actualizar stock para producto:", productoRecepcion.productoId, stockError)
              // Continuar con otros productos aunque falle uno
            }
          }
        }
      }

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

        // Desactivar enlaces públicos del pedido cuando se completa
        if (nuevoEstado === "completado") {
          await desactivarEnlacesPorPedido(selectedPedido.id)
          // Actualizar estado local inmediatamente (el listener también lo hará, pero esto es más rápido)
          setEnlaceActivo(null)
        }

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
          description: "La recepción se ha registrado, el stock se ha actualizado y el remito se ha generado",
        })

        // Cambiar a la pestaña de remitos para ver el nuevo remito
        setActiveTab("remitos")
      }
    } catch (error: any) {
      console.error("Error al confirmar recepción:", error)
      toast({
        title: "Error",
        description: error?.message || "No se pudo registrar la recepción",
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
      
      // Generar texto del pedido y combinarlo con el link
      const textoPedido = generarTextoPedidoConAjustes()
      const textoCompleto = `${textoPedido}\n\n\n${url}`
      
      navigator.clipboard.writeText(textoCompleto)
      toast({
        title: "Enlace copiado",
        description: "El pedido y el enlace público se han copiado al portapapeles",
      })
    }
  }


  const handleStockChange = async (productId: string, value: number) => {
    // Actualizar estado local inmediatamente para feedback visual
    setStockActual(prev => ({ ...prev, [productId]: value }))
    
    // Actualizar en Firestore para sincronizar con el contexto global
    try {
      if (!db || !user || !selectedPedido || !ownerId) return
      
      const stockDocId = `${ownerId}_${productId}`
      const stockDocRef = doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId)
      
      await setDoc(stockDocRef, {
        productoId: productId, // Corregir: usar productoId en lugar de productId
        pedidoId: selectedPedido.id, // Agregar pedidoId
        cantidad: value,
        ultimaActualizacion: serverTimestamp(),
        ownerId,
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

  // Sheet URL handlers
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
    if (e.key === "Enter") {
      handleSaveSheetUrl()
    } else if (e.key === "Escape") {
      handleCancelEditSheetUrl()
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
      <div className="px-1 sm:px-0">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6">
          {/* Sidebar / Selector de pedidos */}
          <PedidosSidebar
            pedidos={pedidos}
            selectedPedido={selectedPedido}
            onSelectPedido={setSelectedPedido}
            onCreatePedido={handleOpenCreate}
          />

          {/* Contenido principal - Mobile-first */}
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
              {/* Header del pedido - Mobile first */}
              <div className="rounded-lg border border-border bg-card p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 overflow-x-hidden">
                  {/* Fila 1: Nombre + acciones principales - Mobile-first */}
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {isEditingName ? (
                      <div className="flex items-center gap-1 min-w-0 flex-1 sm:flex-initial w-full sm:w-auto">
                        <Input
                          ref={nameInputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={handleNameKeyDown}
                          className="text-sm sm:text-base font-bold h-7 sm:h-8 flex-1 min-w-0"
                          placeholder="Nombre del pedido"
                        />
                        <Button variant="ghost" size="icon" onClick={handleSaveName} className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 text-green-600">
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleCancelEditName} className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
                          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 min-w-0 flex-1 sm:flex-initial">
                        <h2 className="text-sm sm:text-base font-bold text-foreground truncate">{selectedPedido.nombre}</h2>
                        <Button variant="ghost" size="icon" onClick={handleStartEditName} className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 text-muted-foreground">
                          <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </Button>
                      </div>
                    )}
                    
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

                  {/* Mostrar información si el pedido está asignado - Mobile-first */}
                  {selectedPedido?.estado === "processing" && selectedPedido.assignedTo && (
                    <Alert className="mt-2 sm:mt-3 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <AlertTitle className="text-xs sm:text-sm">Pedido en proceso</AlertTitle>
                      <AlertDescription className="text-xs sm:text-sm">
                        Este pedido está siendo procesado por: <strong>{selectedPedido.assignedToNombre || "Usuario de fábrica"}</strong> - Fábrica
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Fila 2: Tabs - Compactas en móvil, sin scroll horizontal */}
                  <div className="flex gap-0.5 sm:gap-1 border-t sm:border-t-0 border-l sm:border-l sm:border-r border-border overflow-x-hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 sm:h-8 px-1.5 sm:px-3 rounded-none border-b-2 border-transparent text-[11px] sm:text-sm font-medium flex-1 sm:flex-initial",
                        activeTab === "productos" && "border-primary text-primary font-medium"
                      )}
                      onClick={() => setActiveTab("productos")}
                    >
                      <span className="hidden sm:inline">Productos</span>
                      <span className="sm:hidden">Productos</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 sm:h-8 px-1.5 sm:px-3 rounded-none border-b-2 border-transparent text-[11px] sm:text-sm font-medium flex-1 sm:flex-initial",
                        activeTab === "remitos" && "border-primary text-primary font-medium"
                      )}
                      onClick={() => setActiveTab("remitos")}
                    >
                      <span className="hidden sm:inline">Remitos {remitos.length > 0 && `(${remitos.length})`}</span>
                      <span className="sm:hidden">
                        Remitos {remitos.length > 0 && `(${remitos.length})`}
                      </span>
                    </Button>
                    {(selectedPedido.estado === "enviado" || selectedPedido.estado === "recibido") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 sm:h-8 px-1.5 sm:px-3 rounded-none border-b-2 border-transparent text-[11px] sm:text-sm font-medium flex-1 sm:flex-initial",
                          activeTab === "recepcion" && "border-primary text-primary font-medium"
                        )}
                        onClick={() => setActiveTab("recepcion")}
                      >
                        <span className="hidden sm:inline">Recepción</span>
                        <span className="sm:hidden">Rec.</span>
                      </Button>
                    )}
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

                      {/* Formato de salida - Mobile-first con scroll horizontal controlado */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                          Formato
                        </label>
                        <div className="flex gap-1 overflow-x-auto mt-0.5 scrollbar-none -mx-1 px-1">
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

                      {/* Link de Google Sheet */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                          Link de Google Sheet del pedido
                        </label>
                        <p className="text-[9px] text-muted-foreground mt-0.5 mb-1">
                          Pegá acá el link del Sheet que usa la empresa para este pedido.
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isEditingSheetUrl ? (
                            <>
                              <Input
                                ref={sheetUrlInputRef}
                                value={editingSheetUrl}
                                onChange={(e) => setEditingSheetUrl(e.target.value)}
                                onKeyDown={handleSheetUrlKeyDown}
                                className="text-sm h-7 flex-1"
                                placeholder="https://docs.google.com/spreadsheets/..."
                              />
                              <Button variant="ghost" size="icon" onClick={handleSaveSheetUrl} className="h-7 w-7 shrink-0 text-green-600">
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={handleCancelEditSheetUrl} className="h-7 w-7 shrink-0">
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <div 
                              onClick={handleStartEditSheetUrl}
                              className="flex-1 text-xs px-2 py-1 rounded border border-border bg-muted/50 cursor-pointer hover:bg-muted truncate"
                            >
                              {selectedPedido.sheetUrl || "Sin configurar"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Acciones de pedido */}
                  {products.length > 0 && (
                    <div className="flex flex-col gap-2 pt-1.5 border-t border-border">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                        "text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
                        productosAPedirActualizados.length > 0 
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}>
                        {productosAPedir.length > 0 
                          ? `${productosAPedirActualizados.length} a pedir`
                          : "✓ OK"
                        }
                      </span>
                        {/* View mode tabs: 'Pedir' (ajustar cantidades) vs 'Stock' (editar stock) */}
                        <div className="flex items-center gap-2 ml-2">
                        <button
                          type="button"
                          aria-pressed={viewMode === "pedir"}
                          onClick={() => setViewMode("pedir")}
                          className={cn(
                            "text-[11px] px-2 py-0.5 rounded transition-colors",
                            viewMode === "pedir" ? "bg-primary text-primary-foreground border border-primary" : "bg-muted hover:bg-accent border border-border"
                          )}
                        >
                          Pedir
                        </button>
                        <button
                          type="button"
                          aria-pressed={viewMode === "stock"}
                          onClick={() => setViewMode("stock")}
                          className={cn(
                            "text-[11px] px-2 py-0.5 rounded transition-colors",
                            viewMode === "stock" ? "bg-primary text-primary-foreground border border-primary" : "bg-muted hover:bg-accent border border-border"
                          )}
                        >
                          Stock
                        </button>
                        </div>
                        <div className="flex-1" />
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              size="sm" 
                              className="h-7 px-2 flex-1 sm:flex-initial"
                              disabled={productosAPedirActualizados.length === 0}
                            >
                              <Copy className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="sm:hidden text-xs">copiar</span>
                              <span className="hidden sm:inline text-xs">copiar</span>
                              <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleCopyPedido}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copiar pedido completo
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={handleLlevarPedidoASheet}
                              disabled={!selectedPedido?.sheetUrl}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Llevar pedido a Sheet
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button 
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 flex-1 sm:flex-initial"
                          onClick={handleGenerarEnlace}
                          disabled={productosAPedirActualizados.length === 0 || selectedPedido?.estado === "enviado" || selectedPedido?.estado === "recibido" || loadingEnlace}
                          title="Generar nuevo enlace público"
                        >
                          {loadingEnlace ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 sm:mr-1 animate-spin" />
                              <span className="sm:hidden text-xs">Generando...</span>
                              <span className="hidden sm:inline text-xs">Generando...</span>
                            </>
                          ) : (
                            <>
                              <LinkIcon className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="sm:hidden text-xs">enviar</span>
                              <span className="hidden sm:inline text-xs">enviar pedido</span>
                            </>
                          )}
                        </Button>
                        {(enlaceActivo || selectedPedido?.estado === "enviado") && (
                          <Button 
                            size="sm"
                            variant="outline"
                            className={cn(
                              "h-7 px-2 relative flex-1 sm:flex-initial",
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
                        {/* WhatsApp and Clear buttons removed per request */}
                      </div>
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
                  onCreateProduct={createProduct}
                  onImport={() => setImportDialogOpen(true)}
                  onProductsOrderUpdate={updateProductsOrder}
                  calcularPedido={calcularPedido}
                  ajustesPedido={ajustesPedido}
                  onAjustePedidoChange={handleAjustePedidoChange}
                  configMode={showConfig}
                  viewMode={viewMode}
                  stockMinimoDefault={selectedPedido?.stockMinimoDefault ?? 0}
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
                                
                                // Generar texto del pedido y combinarlo con el link
                                const textoPedido = generarTextoPedidoConAjustes()
                                const textoCompleto = `${textoPedido}\n\n\n${url}`
                                
                                navigator.clipboard.writeText(textoCompleto)
                                toast({ title: "Pedido y enlace copiados", description: "El pedido y el enlace se han copiado al portapapeles" })
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
      <PWAUpdateNotification swPath="/sw-pwa.js" />
    </DashboardLayout>
  )
}
