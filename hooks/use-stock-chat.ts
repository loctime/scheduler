"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  limit,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { 
  ChatMessage, 
  StockAccionParsed, 
  StockMovimiento, 
  StockActual,
  Producto,
  Pedido,
  TipoAccion
} from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

interface UseStockChatOptions {
  userId?: string
  userName?: string
  user?: { uid: string } | null
}

interface OllamaStatus {
  status: "checking" | "ok" | "error"
  message?: string
  modeloDisponible?: boolean
}

interface AccionPendiente {
  id: string
  accion: StockAccionParsed
  timestamp: Date
}

export function useStockChat({ userId, userName, user }: UseStockChatOptions) {
  const { toast } = useToast()
  const { userData } = useData()
  const { config } = useConfig(user)
  const nombreEmpresa = config?.nombreEmpresa
  const nombreAsistente = nombreEmpresa ? `${nombreEmpresa} Assistant` : "Stock Assistant"
  
  const ownerId = useMemo(
    () => getOwnerIdForActor(user, userData),
    [user, userData]
  )
  const actorUserId = userId || user?.uid
  
  // Estados del chat
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({ status: "checking" })
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Estados de stock
  const [productos, setProductos] = useState<Producto[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [stockActual, setStockActual] = useState<Record<string, number>>({})
  const [movimientos, setMovimientos] = useState<StockMovimiento[]>([])
  const [loadingStock, setLoadingStock] = useState(true)

  // Acción pendiente de confirmación
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente | null>(null)
  
  // Modo del chat (ingreso/egreso/stock). null = modo pregunta (por defecto)
  const [modo, setModo] = useState<"ingreso" | "egreso" | "pregunta" | "stock" | null>(null)
  
  // Modo IA: activar/desactivar uso de Ollama para generar respuestas
  const [modoIA, setModoIA] = useState(false)
  
  // Pedido seleccionado para filtrar productos (solo en modos ingreso/egreso/stock)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<string | null>(null)
  
  // Lista acumulada de productos para ingreso/egreso
  const [productosAcumulados, setProductosAcumulados] = useState<Array<{
    productoId: string
    producto: string
    cantidad: number
    unidad?: string
    accion: "entrada" | "salida"
  }>>([])
  
  // Historial de cambios de stock para deshacer (modo stock)
  const [ultimoCambioStock, setUltimoCambioStock] = useState<{
    productoId: string
    producto: string
    stockAnterior: number
    stockNuevo: number
    unidad?: string
  } | null>(null)
  
  // Lista acumulada de cambios de stock (modo batch)
  const [cambiosStockAcumulados, setCambiosStockAcumulados] = useState<Array<{
    productoId: string
    producto: string
    cantidad: number
    stockAnterior: number
    unidad?: string
  }>>([])
  
  // Modo batch activo para stock
  const [modoBatchStock, setModoBatchStock] = useState(false)

  // Verificar conexión con Ollama (opcional)
  const checkOllamaConnection = useCallback(async () => {
    setOllamaStatus({ status: "checking" })
    try {
      const response = await fetch("/api/stock-chat")
      const data = await response.json()
      
      if (data.status === "ok") {
        // Ollama es opcional - siempre devolvemos "ok", solo indicamos si está disponible
        if (data.ollamaDisponible) {
          setOllamaStatus({
            status: "ok",
            modeloDisponible: data.modelosDisponibles?.length > 0,
            message: data.message || "Ollama conectado"
          })
        } else {
          // Ollama no disponible pero la app funciona - tratamos como "ok" sin bloquear
          setOllamaStatus({
            status: "ok",
            modeloDisponible: false,
            message: data.message || "Ollama no disponible (modo sin IA)"
          })
        }
      } else {
        // Si hay error en el endpoint, aún permitimos usar la app
        setOllamaStatus({
          status: "ok",
          modeloDisponible: false,
          message: "Ollama no disponible (modo sin IA)"
        })
      }
    } catch (error) {
      // En caso de error, no bloquear - la app funciona sin Ollama
      setOllamaStatus({
        status: "ok",
        modeloDisponible: false,
        message: "Ollama no disponible (modo sin IA)"
      })
    }
  }, [])

  // Cargar pedidos del usuario
  useEffect(() => {
    if (!db || !ownerId) return

    const pedidosRef = collection(db, COLLECTIONS.PEDIDOS)
    const q = query(pedidosRef, where("ownerId", "==", ownerId))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const pedidosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Pedido[]
        setPedidos(pedidosData)
      },
      (error) => {
        // Manejar errores de permisos silenciosamente
        if (error.code === 'permission-denied') {
          console.warn("Error de permisos al cargar pedidos:", error)
        } else {
          console.error("Error al cargar pedidos:", error)
        }
      }
    )

    return () => unsubscribe()
  }, [ownerId])

  // Cargar productos del usuario
  useEffect(() => {
    if (!db || !ownerId) {
      setLoadingStock(false)
      return
    }

    const productosRef = collection(db, COLLECTIONS.PRODUCTS)
    const q = query(productosRef, where("ownerId", "==", ownerId))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const productosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Producto[]
        
        // Filtrar productos que tengan pedidoId válido (solo cuando ya tenemos pedidos cargados)
        // Si no hay pedidos cargados aún, esperamos a que se carguen
        const productosFiltrados = pedidos.length > 0
          ? productosData.filter(p => {
              // Solo incluir productos que tengan pedidoId y que ese pedido exista
              if (!p.pedidoId) return false
              return pedidos.some(ped => ped.id === p.pedidoId)
            })
          : productosData
        
        // Ordenar por orden, y si tienen el mismo orden, alfabéticamente (igual que en pedidos)
        productosFiltrados.sort((a, b) => {
          const ordenA = a.orden ?? 0
          const ordenB = b.orden ?? 0
          if (ordenA !== ordenB) {
            return ordenA - ordenB
          }
          return a.nombre.localeCompare(b.nombre)
        })
        
        setProductos(productosFiltrados)
        setLoadingStock(false)
      },
      (error) => {
        // Manejar errores de permisos silenciosamente
        if (error.code === 'permission-denied') {
          console.warn("Error de permisos al cargar productos:", error)
        } else {
          console.error("Error al cargar productos:", error)
        }
        setLoadingStock(false)
      }
    )

    return () => unsubscribe()
  }, [ownerId, pedidos])

  // Cargar stock actual
  useEffect(() => {
    if (!db || !ownerId) return

    const stockRef = collection(db, COLLECTIONS.STOCK_ACTUAL)
    const q = query(stockRef, where("ownerId", "==", ownerId))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const stockData: Record<string, number> = {}
        snapshot.docs.forEach(doc => {
          const data = doc.data() as StockActual
          stockData[data.productoId] = data.cantidad
        })
        setStockActual(stockData)
      },
      (error) => {
        // Manejar errores de permisos silenciosamente
        if (error.code === 'permission-denied') {
          console.warn("Error de permisos al cargar stock actual:", error)
        } else {
          console.error("Error al cargar stock actual:", error)
        }
      }
    )

    return () => unsubscribe()
  }, [ownerId])

  // Cargar historial de movimientos recientes
  useEffect(() => {
    if (!db || !ownerId) return

    const movimientosRef = collection(db, COLLECTIONS.STOCK_MOVIMIENTOS)
    const q = query(
      movimientosRef, 
      where("ownerId", "==", ownerId),
      orderBy("createdAt", "desc"),
      limit(50)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const movData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockMovimiento[]
      setMovimientos(movData)
    })

    return () => unsubscribe()
  }, [ownerId])

  // Agregar mensaje al chat
  const addMessage = useCallback((mensaje: Omit<ChatMessage, "id" | "timestamp">) => {
    const newMessage: ChatMessage = {
      ...mensaje,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, newMessage])
    return newMessage
  }, [])

  // Verificar Ollama al montar
  useEffect(() => {
    checkOllamaConnection()
  }, [checkOllamaConnection])

  // Estado para rastrear pedidos ya notificados
  const pedidosNotificadosRef = useRef<Set<string>>(new Set())

  // Mensaje de bienvenida
  useEffect(() => {
    if (messages.length === 0 && ollamaStatus.status === "ok" && !loadingStock) {
      // Contar pedidos que tienen productos
      // Verificar cuáles pedidos tienen productos asociados
      const pedidosConProductos = pedidos.filter(pedido => {
        return productos.some(prod => prod.pedidoId === pedido.id)
      })
      
      const cantidadPedidos = pedidosConProductos.length
      
      const welcomeMsg = cantidadPedidos === 0
        ? "¡Hola! Cargá productos desde la sección Pedidos para empezar. ¿En qué te ayudo?"
        : `¡Hola! Tenés ${cantidadPedidos} pedido${cantidadPedidos > 1 ? "s" : ""} con productos. ¿En qué te ayudo?\n\n💡 Seleccioná el modo de trabajo en la parte de abajo, y el pedido a trabajar en la parte de arriba.`
      
      addMessage({
        tipo: "sistema",
        contenido: welcomeMsg,
      })
    }
  }, [ollamaStatus.status, productos, pedidos, loadingStock, addMessage, messages.length])

  // Detectar pedidos pendientes de recibir y notificar
  useEffect(() => {
    if (!pedidos.length || loadingStock || messages.length === 0) return

    // Buscar pedidos pendientes de recibir (estado "enviado" o "recibido")
    const pedidosPendientes = pedidos.filter(pedido => 
      pedido.estado === "enviado" || pedido.estado === "recibido"
    )

    // Notificar solo los pedidos que aún no han sido notificados
    pedidosPendientes.forEach(pedido => {
      if (!pedidosNotificadosRef.current.has(pedido.id)) {
        pedidosNotificadosRef.current.add(pedido.id)
        
        // Agregar mensaje de notificación con botón de acción
        addMessage({
          tipo: "sistema",
          contenido: `📦 Pedido "${pedido.nombre}" pendiente a recibir`,
          accionesRapidas: [
            {
              texto: "Recibir",
              accion: () => {
                // Navegar a la página de recepción
                if (typeof window !== "undefined") {
                  window.location.href = `/dashboard/pedidos/${pedido.id}/recepcion`
                }
              }
            }
          ]
        })
      }
    })

    // Limpiar pedidos que ya no están pendientes del set de notificados
    const pedidosCompletados = pedidos.filter(pedido => 
      pedido.estado === "completado" && pedidosNotificadosRef.current.has(pedido.id)
    )
    pedidosCompletados.forEach(pedido => {
      pedidosNotificadosRef.current.delete(pedido.id)
    })
  }, [pedidos, loadingStock, addMessage, messages.length])

  // ==================== ACCIONES DE BASE DE DATOS ====================

  // Crear producto
  const crearProducto = useCallback(async (
    nombre: string,
    unidad?: string,
    stockMinimo?: number,
    pedidoId?: string
  ) => {
    if (!db || !ownerId || !actorUserId) throw new Error("No hay conexión")

    // Usar el primer pedido si no se especifica
    const pedidoIdFinal = pedidoId || pedidos[0]?.id
    if (!pedidoIdFinal) {
      throw new Error("No hay pedidos. Creá uno primero en la sección Pedidos.")
    }

    const nuevoProducto: Omit<Producto, "id"> = {
      pedidoId: pedidoIdFinal,
      nombre,
      stockMinimo: stockMinimo || 1,
      unidad: unidad || "u",
      ownerId,
      userId: actorUserId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), nuevoProducto)
    return { id: docRef.id, ...nuevoProducto }
  }, [db, ownerId, actorUserId, pedidos])

  // Editar producto
  const editarProducto = useCallback(async (
    productoId: string,
    cambios: Partial<Pick<Producto, "nombre" | "unidad" | "stockMinimo">>
  ) => {
    if (!db || !ownerId || !actorUserId) throw new Error("No hay conexión")

    const docRef = doc(db, COLLECTIONS.PRODUCTS, productoId)
    await updateDoc(docRef, {
      ...cambios,
      ownerId,
      userId: actorUserId,
      updatedAt: serverTimestamp(),
    })
  }, [db, ownerId, actorUserId])

  // Eliminar producto
  const eliminarProducto = useCallback(async (productoId: string) => {
    if (!db || !ownerId) throw new Error("No hay conexión")

    await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productoId))
    
    // También eliminar el stock actual
    const stockDocId = `${ownerId}_${productoId}`
    try {
      await deleteDoc(doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId))
    } catch (e) {
      // Puede no existir
    }
  }, [db, ownerId])

  // Actualizar stock
  const actualizarStock = useCallback(async (
    productoId: string,
    tipo: "entrada" | "salida",
    cantidad: number,
    motivo?: string
  ) => {
    if (!db || !ownerId || !actorUserId) throw new Error("No hay conexión")

    const producto = productos.find(p => p.id === productoId)
    if (!producto) throw new Error("Producto no encontrado")

    const stockAnterior = stockActual[productoId] || 0
    const nuevoStock = tipo === "entrada" 
      ? stockAnterior + cantidad 
      : stockAnterior - cantidad

    if (nuevoStock < 0) {
      const mensajeError = stockAnterior === 0
        ? `❌ No podés quitar ${cantidad} ${producto.unidad || "unidades"} de ${producto.nombre} porque el stock está en 0. Primero agregá stock.`
        : `❌ No podés quitar ${cantidad} ${producto.unidad || "unidades"} de ${producto.nombre}. Solo tenés ${stockAnterior} ${producto.unidad || "unidades"} disponibles.`
      throw new Error(mensajeError)
    }

    // Crear movimiento (solo incluir campos que no sean undefined)
    const movimiento: Omit<StockMovimiento, "id"> = {
      productoId,
      productoNombre: producto.nombre,
      tipo,
      cantidad,
      unidad: producto.unidad || "u", // Valor por defecto si no tiene unidad
      ownerId,
      userId: actorUserId,
      userName,
      createdAt: serverTimestamp(),
      // Solo incluir campos opcionales si tienen valor
      ...(motivo && { motivo }),
      ...(producto.pedidoId && { pedidoId: producto.pedidoId }),
    }

    console.log(`[STOCK] Intentando crear movimiento:`, {
      ownerId,
      userUid: user?.uid,
      userDataRole: userData?.role,
      userDataOwnerId: userData?.ownerId,
      movimiento: { ...movimiento, createdAt: '[serverTimestamp]' }
    })

    try {
      await addDoc(collection(db, COLLECTIONS.STOCK_MOVIMIENTOS), movimiento)
      console.log(`[STOCK] Movimiento creado exitosamente`)
    } catch (error: any) {
      console.error(`[STOCK] Error al crear movimiento:`, {
        error,
        code: error?.code,
        message: error?.message,
        ownerId,
        userUid: user?.uid
      })
      throw error
    }

    // Actualizar stock actual
    const stockDocId = `${ownerId}_${productoId}`
    const stockDocRef = doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId)
    
    const stockData = {
      productoId,
      cantidad: nuevoStock,
      ultimaActualizacion: serverTimestamp(),
      ownerId,
      userId: actorUserId,
      // Solo incluir pedidoId si tiene valor
      ...(producto.pedidoId && { pedidoId: producto.pedidoId }),
    }
    
    console.log(`[STOCK] Intentando crear/actualizar stock:`, {
      stockDocId,
      ownerId,
      userUid: user?.uid,
      userDataRole: userData?.role,
      userDataOwnerId: userData?.ownerId,
      stockData
    })
    
    try {
      await setDoc(stockDocRef, stockData)
      console.log(`[STOCK] Stock actualizado exitosamente`)
    } catch (error: any) {
      console.error(`[STOCK] Error al actualizar stock:`, {
        error,
        code: error?.code,
        message: error?.message,
        stockDocId,
        ownerId,
        userUid: user?.uid
      })
      throw error
    }

    return { stockAnterior, nuevoStock, producto }
  }, [db, ownerId, actorUserId, userName, productos, stockActual, user, userData])

  // Actualizar stock directamente (reemplazar valor)
  const actualizarStockDirecto = useCallback(async (
    productoId: string,
    cantidad: number,
    motivo?: string
  ) => {
    if (!db || !ownerId || !actorUserId) throw new Error("No hay conexión")

    const producto = productos.find(p => p.id === productoId)
    if (!producto) throw new Error("Producto no encontrado")

    if (cantidad < 0) {
      throw new Error(`❌ El stock no puede ser negativo. Intentaste establecer ${cantidad} ${producto.unidad || "unidades"} para ${producto.nombre}.`)
    }

    const stockAnterior = stockActual[productoId] || 0
    const diferencia = cantidad - stockAnterior

    // Crear movimiento para registrar el cambio
    // Si la diferencia es positiva, es una entrada; si es negativa, es una salida
    const tipoMovimiento: "entrada" | "salida" = diferencia >= 0 ? "entrada" : "salida"
    const cantidadMovimiento = Math.abs(diferencia)

    if (cantidadMovimiento > 0) {
      const movimiento: Omit<StockMovimiento, "id"> = {
        productoId,
        productoNombre: producto.nombre,
        tipo: tipoMovimiento,
        cantidad: cantidadMovimiento,
        unidad: producto.unidad || "u",
        ownerId,
        userId: actorUserId,
        userName,
        createdAt: serverTimestamp(),
        motivo: motivo || `Actualización directa: ${stockAnterior} → ${cantidad}`,
        ...(producto.pedidoId && { pedidoId: producto.pedidoId }),
      }

      await addDoc(collection(db, COLLECTIONS.STOCK_MOVIMIENTOS), movimiento)
    }

    // Actualizar stock actual
    const stockDocId = `${ownerId}_${productoId}`
    const stockDocRef = doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId)
    
    await setDoc(stockDocRef, {
      productoId,
      cantidad: cantidad,
      ultimaActualizacion: serverTimestamp(),
      ownerId,
      userId: actorUserId,
      // Solo incluir pedidoId si tiene valor
      ...(producto.pedidoId && { pedidoId: producto.pedidoId }),
    })

    return { stockAnterior, nuevoStock: cantidad, producto }
  }, [db, ownerId, actorUserId, userName, productos, stockActual])

  // Inicializar stock de productos
  const inicializarStockProductos = useCallback(async (cantidadInicial: number = 0) => {
    if (!db || !ownerId || !actorUserId) throw new Error("No hay conexión")
    if (productos.length === 0) throw new Error("No hay productos para inicializar")

    let inicializados = 0
    for (const producto of productos) {
      const stockDocId = `${ownerId}_${producto.id}`
      const stockDocRef = doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId)
      
      // Solo inicializar si no tiene stock aún
      if (stockActual[producto.id] === undefined || stockActual[producto.id] === 0) {
        await setDoc(stockDocRef, {
          productoId: producto.id,
          cantidad: cantidadInicial,
          ultimaActualizacion: serverTimestamp(),
          ownerId,
          userId: actorUserId,
          // Solo incluir pedidoId si tiene valor
          ...(producto.pedidoId && { pedidoId: producto.pedidoId }),
        })
        inicializados++
      }
    }
    return inicializados
  }, [db, ownerId, actorUserId, productos, stockActual])

  // ==================== EJECUTAR ACCIÓN ====================

  const ejecutarAccion = useCallback(async (accion: StockAccionParsed): Promise<string> => {
    console.log(`[EJECUTAR] Iniciando ejecución de acción:`, accion)
    
    switch (accion.accion) {
      case "entrada":
      case "salida": {
        console.log(`[EJECUTAR] Acción: ${accion.accion}`, accion)
        
        // Validación: no ejecutar entrada/salida si no hay datos válidos
        if (!accion.productoId && !accion.producto) {
          console.error(`[EJECUTAR] Error: No hay producto ni productoId`, accion)
          return "No pude identificar el producto. ¿Podés ser más específico?"
        }
        
        if (!accion.productoId) {
          // Si no hay productoId pero hay nombre, sugerir crear el producto
          if (accion.producto) {
            return `❌ No encontré "${accion.producto}" en tu inventario. Decime "creá un producto ${accion.producto} en ${accion.unidad || "unidades"}" para crearlo primero.`
          }
          console.error(`[EJECUTAR] Error: Producto no identificado`, accion)
          throw new Error("Producto no identificado")
        }
        
        // Validar que el producto pertenezca al pedido seleccionado (si hay uno)
        if (pedidoSeleccionado && (modo === "ingreso" || modo === "egreso")) {
          const producto = productos.find(p => p.id === accion.productoId)
          if (!producto || producto.pedidoId !== pedidoSeleccionado) {
            const pedido = pedidos.find(p => p.id === pedidoSeleccionado)
            return `❌ El producto "${producto?.nombre || accion.producto}" no pertenece al pedido "${pedido?.nombre || "seleccionado"}". Seleccioná el pedido correcto o usá un producto de ese pedido.`
          }
        }
        
        if (!accion.cantidad || accion.cantidad <= 0) {
          console.error(`[EJECUTAR] Error: Cantidad inválida o faltante`, accion)
          return `Para ${accion.accion === "entrada" ? "agregar" : "quitar"} stock necesito saber la cantidad. Por ejemplo: "saco 2 cajas de ${accion.producto || "X"}"`
        }
        
        // Validar stock antes de intentar quitar
        if (accion.accion === "salida") {
          const stockActualProducto = stockActual[accion.productoId] || 0
          if (stockActualProducto < accion.cantidad) {
            const producto = productos.find(p => p.id === accion.productoId)
            const mensajeError = stockActualProducto === 0
              ? `❌ No podés quitar ${accion.cantidad} ${accion.unidad || producto?.unidad || "unidades"} de ${producto?.nombre || "ese producto"} porque el stock está en 0. Primero agregá stock.`
              : `❌ No podés quitar ${accion.cantidad} ${accion.unidad || producto?.unidad || "unidades"} de ${producto?.nombre || "ese producto"}. Solo tenés ${stockActualProducto} ${producto?.unidad || "unidades"} disponibles.`
            return mensajeError
          }
        }
        
        try {
          const resultado = await actualizarStock(
            accion.productoId,
            accion.accion,
            accion.cantidad,
            accion.mensaje
          )
          
          const emoji = accion.accion === "entrada" ? "📥" : "📤"
          const verbo = accion.accion === "entrada" ? "Agregado" : "Quitado"
          return `${emoji} ${verbo}: ${accion.cantidad} ${accion.unidad || resultado.producto.unidad || "u"} de ${resultado.producto.nombre}.\nStock: ${resultado.stockAnterior} → ${resultado.nuevoStock}`
        } catch (error) {
          // El error ya tiene un mensaje amigable
          throw error
        }
      }

      case "actualizar_stock": {
        console.log(`[EJECUTAR] Acción: actualizar_stock`, accion)
        
        if (!accion.productoId && !accion.producto) {
          console.error(`[EJECUTAR] Error: No hay producto ni productoId`, accion)
          return "No pude identificar el producto. ¿Podés ser más específico?"
        }
        
        if (!accion.productoId) {
          if (accion.producto) {
            return `❌ No encontré "${accion.producto}" en tu inventario. Decime "creá un producto ${accion.producto} en ${accion.unidad || "unidades"}" para crearlo primero.`
          }
          console.error(`[EJECUTAR] Error: Producto no identificado`, accion)
          throw new Error("Producto no identificado")
        }
        
        // Validar que el producto pertenezca al pedido seleccionado (si hay uno)
        if (pedidoSeleccionado && modo === "stock") {
          const producto = productos.find(p => p.id === accion.productoId)
          if (!producto || producto.pedidoId !== pedidoSeleccionado) {
            const pedido = pedidos.find(p => p.id === pedidoSeleccionado)
            return `❌ El producto "${producto?.nombre || accion.producto}" no pertenece al pedido "${pedido?.nombre || "seleccionado"}". Seleccioná el pedido correcto o usá un producto de ese pedido.`
          }
        }
        
        if (accion.cantidad === undefined || accion.cantidad === null || accion.cantidad < 0) {
          console.error(`[EJECUTAR] Error: Cantidad inválida o faltante`, accion)
          return `Para actualizar el stock necesito saber la cantidad. Por ejemplo: "${accion.producto || "producto"} 20"`
        }
        
        try {
          const resultado = await actualizarStockDirecto(
            accion.productoId,
            accion.cantidad,
            accion.mensaje
          )
          
          return `📊 Stock actualizado: ${resultado.producto.nombre}\nStock: ${resultado.stockAnterior} → ${resultado.nuevoStock} ${resultado.producto.unidad || "unidades"}`
        } catch (error) {
          throw error
        }
      }

      case "crear_producto": {
        if (!accion.producto) throw new Error("Nombre de producto requerido")
        
        const nuevo = await crearProducto(
          accion.producto,
          accion.unidad,
          accion.stockMinimo,
          accion.pedidoId
        )
        
        // Si se especificó stock inicial (stockMinimo), inicializar el stock actual
        if (accion.stockMinimo && accion.stockMinimo > 0) {
          try {
            await actualizarStock(nuevo.id, "entrada", accion.stockMinimo, "Stock inicial al crear producto")
            return `✅ Producto "${accion.producto}" creado correctamente con stock inicial de ${accion.stockMinimo} ${accion.unidad || "unidades"} (unidad: ${accion.unidad || "u"}, stock mínimo: ${accion.stockMinimo})`
          } catch (error) {
            // Si falla la inicialización del stock, al menos el producto se creó
            console.error("Error inicializando stock:", error)
            return `✅ Producto "${accion.producto}" creado correctamente (unidad: ${accion.unidad || "u"}, stock mínimo: ${accion.stockMinimo || 1}). Nota: Hubo un problema al inicializar el stock.`
          }
        }
        
        return `✅ Producto "${accion.producto}" creado correctamente (unidad: ${accion.unidad || "u"}, stock mínimo: ${accion.stockMinimo || 1})`
      }

      case "editar_producto": {
        if (!accion.productoId) throw new Error("Producto no identificado")
        
        const cambios: any = {}
        if (accion.producto) cambios.nombre = accion.producto
        if (accion.unidad) cambios.unidad = accion.unidad
        if (accion.stockMinimo) cambios.stockMinimo = accion.stockMinimo
        
        await editarProducto(accion.productoId, cambios)
        return `✅ Producto actualizado correctamente`
      }

      case "eliminar_producto": {
        if (!accion.productoId) throw new Error("Producto no identificado")
        
        const producto = productos.find(p => p.id === accion.productoId)
        await eliminarProducto(accion.productoId)
        return `🗑️ Producto "${producto?.nombre}" eliminado`
      }

      case "consulta_stock": {
        if (accion.productoId) {
          const producto = productos.find(p => p.id === accion.productoId)
          const cantidad = stockActual[accion.productoId] || 0
          return `📊 ${producto?.nombre}: ${cantidad} ${producto?.unidad || "unidades"} (mínimo: ${producto?.stockMinimo || 1})`
        }
        return accion.mensaje || "No encontré ese producto"
      }

      case "listar_productos": {
        if (productos.length === 0) {
          if (pedidos.length > 0) {
            return "📦 No tenés productos cargados todavía, pero tenés pedidos configurados. Podés decirme \"importá los productos de pedidos\" o crear productos nuevos."
          }
          return "📦 No tenés productos cargados todavía. Podés crearlos diciéndome algo como \"creá un producto Tomate en cajas\" o ir a la sección Pedidos."
        }
        const lista = productos.map(p => {
          const stock = stockActual[p.id] ?? 0
          const estado = stock < p.stockMinimo ? "⚠️" : "✅"
          const pedido = pedidos.find(ped => ped.id === p.pedidoId)
          return `${estado} ${p.nombre}: ${stock} ${p.unidad || "u"}${pedido ? ` (${pedido.nombre})` : ""}`
        }).join("\n")
        return `📦 Tus ${productos.length} productos:\n${lista}`
      }

      case "listar_pedidos": {
        if (pedidos.length === 0) {
          return "📋 No tenés pedidos/proveedores configurados. Podés crearlos desde la sección 'Pedidos' del menú."
        }
        const lista = pedidos.map(p => {
          const prods = productos.filter(prod => prod.pedidoId === p.id)
          return `📋 ${p.nombre}: ${prods.length} productos`
        }).join("\n")
        return `🏪 Tus ${pedidos.length} pedidos/proveedores:\n${lista}`
      }

      case "ver_pedido": {
        const pedido = accion.pedidoId 
          ? pedidos.find(p => p.id === accion.pedidoId)
          : pedidos.find(p => p.nombre.toLowerCase().includes(accion.producto?.toLowerCase() || ""))
        
        if (!pedido) {
          return "No encontré ese pedido. Decime \"mostrar pedidos\" para ver la lista."
        }
        
        const prods = productos.filter(p => p.pedidoId === pedido.id)
        if (prods.length === 0) {
          return `📋 El pedido "${pedido.nombre}" no tiene productos cargados.`
        }
        
        const lista = prods.map(p => {
          const stock = stockActual[p.id] ?? 0
          return `• ${p.nombre}: ${stock} ${p.unidad || "u"}`
        }).join("\n")
        return `📋 Productos de "${pedido.nombre}" (${prods.length}):\n${lista}`
      }

      case "importar_productos":
      case "inicializar_stock": {
        if (productos.length === 0) {
          return "❌ No hay productos para importar. Primero cargá productos desde la sección 'Pedidos'."
        }
        
        const cantidadInicial = (accion as any).cantidadInicial || 0
        const inicializados = await inicializarStockProductos(cantidadInicial)
        
        if (inicializados === 0) {
          return "ℹ️ Todos los productos ya tienen stock inicializado."
        }
        return `✅ Stock inicializado para ${inicializados} productos con ${cantidadInicial} unidades cada uno.`
      }

      case "stock_bajo": {
        const bajos = productos.filter(p => (stockActual[p.id] || 0) < p.stockMinimo)
        if (bajos.length === 0) {
          return "✅ ¡Todo bien! No tenés productos con stock bajo"
        }
        const lista = bajos.map(p => {
          const stock = stockActual[p.id] || 0
          return `⚠️ ${p.nombre}: ${stock}/${p.stockMinimo} ${p.unidad || "u"}`
        }).join("\n")
        return `📉 Productos con stock bajo (${bajos.length}):\n${lista}`
      }

      case "generar_pedido": {
        const bajos = productos.filter(p => (stockActual[p.id] || 0) < p.stockMinimo)
        if (bajos.length === 0) {
          return "✅ No necesitás pedir nada, todo está en stock"
        }
        
        // Agrupar por pedido/proveedor
        const porPedido: Record<string, typeof bajos> = {}
        bajos.forEach(p => {
          const pedidoId = p.pedidoId || "sin_pedido"
          if (!porPedido[pedidoId]) porPedido[pedidoId] = []
          porPedido[pedidoId].push(p)
        })
        
        let resultado = `📝 Lista de pedido (${bajos.length} productos):\n`
        for (const [pedidoId, prods] of Object.entries(porPedido)) {
          const pedido = pedidos.find(p => p.id === pedidoId)
          resultado += `\n📋 ${pedido?.nombre || "Sin proveedor"}:\n`
          prods.forEach(p => {
            const stock = stockActual[p.id] || 0
            const pedir = p.stockMinimo - stock
            resultado += `  • ${p.nombre}: pedir ${pedir} ${p.unidad || "u"}\n`
          })
        }
        return resultado
      }

      case "ayuda":
        return `🤖 Puedo ayudarte con:

📦 **Stock**: "saco 2 cajas de tomate", "agregá 5 kg de harina"
➕ **Crear productos**: "creá un producto Mayonesa en unidades"
📊 **Consultas**: "cuánto tengo de queso", "mostrar productos"
🏪 **Pedidos**: "mostrar pedidos", "qué tiene el pedido Verdulería"
📝 **Generar pedido**: "qué me falta pedir", "generá lista de pedido"
🔄 **Importar**: "inicializá el stock con los productos de pedidos"
✏️ **Editar**: "cambiá el mínimo de tomate a 10"

¡Preguntame lo que necesites!`

      case "conversacion":
      case "consulta_general":
        return accion.mensaje || "¿En qué te puedo ayudar?"

      default:
        return accion.mensaje || "No entendí. ¿Podés reformular?"
    }
  }, [productos, pedidos, stockActual, actualizarStock, actualizarStockDirecto, crearProducto, editarProducto, eliminarProducto, inicializarStockProductos, pedidoSeleccionado, modo])

  // ==================== USAR OLLAMA PARA GENERAR RESPUESTA ====================
  
  const generarRespuestaConOllama = useCallback(async (mensaje: string, contexto: string): Promise<string> => {
    // Obtener URL de Ollama y modelos disponibles desde el servidor
    const statusResponse = await fetch("/api/stock-chat")
    const statusData = await statusResponse.json()
    const OLLAMA_URL = statusData.url
    const modelosDisponibles = statusData.modelosDisponibles || []
    
    if (!OLLAMA_URL || modelosDisponibles.length === 0) {
      throw new Error("Ollama no está configurado o no hay modelos disponibles")
    }

    // Usar el primer modelo disponible
    const modelo = modelosDisponibles[0]

    const prompt = `Eres un asistente inteligente y amigable. Responde de forma natural en español argentino.

Puedes ayudar con:
- Preguntas sobre inventario, stock, productos y pedidos (usa el contexto si está disponible)
- Preguntas generales, matemáticas, conversación casual
- Cualquier otra consulta

Contexto del sistema (si aplica):
${contexto}

Usuario pregunta: ${mensaje}

Responde de forma concisa, útil y amigable. Si es una pregunta sobre el inventario, usa el contexto. Si es una pregunta general, responde normalmente.`

    try {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelo,
          prompt: prompt,
          stream: false,
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!response.ok) {
        throw new Error("Error al generar respuesta con Ollama")
      }

      const data = await response.json()
      return data.response || "No pude generar una respuesta."
    } catch (error) {
      console.error("Error usando Ollama:", error)
      throw error
    }
  }, [])

  // ==================== ENVIAR MENSAJE ====================

  const enviarMensaje = useCallback(async (texto: string) => {
    if (!texto.trim() || isProcessing) return

    const textoLower = texto.toLowerCase().trim()

    // Manejar confirmaciones
    if (accionPendiente) {
      const esConfirmacion = ["si", "sí", "ok", "dale", "confirmo", "yes", "confirmar"].some(
        palabra => textoLower === palabra || textoLower.startsWith(palabra + " ")
      )
      const esCancelacion = ["no", "cancelar", "cancela", "nope", "mejor no"].some(
        palabra => textoLower === palabra || textoLower.startsWith(palabra + " ")
      )

      if (esConfirmacion) {
        addMessage({ tipo: "usuario", contenido: texto })
        setIsProcessing(true)
        
        try {
          const resultado = await ejecutarAccion(accionPendiente.accion)
          addMessage({ tipo: "sistema", contenido: resultado })
        } catch (error) {
          addMessage({
            tipo: "error",
            contenido: error instanceof Error ? error.message : "Error ejecutando acción"
          })
        } finally {
          setAccionPendiente(null)
          setIsProcessing(false)
        }
        return
      }

      if (esCancelacion) {
        addMessage({ tipo: "usuario", contenido: texto })
        addMessage({ tipo: "sistema", contenido: "👍 Cancelado. ¿Qué otra cosa necesitás?" })
        setAccionPendiente(null)
        return
      }
    }

    // null = modo pregunta (por defecto)
    const modoActual = modo || "pregunta"

    // Agregar mensaje del usuario inmediatamente para mejor UX
    addMessage({ tipo: "usuario", contenido: texto })
    setIsProcessing(true)

    // Filtrar productos según pedido seleccionado (solo en modos ingreso/egreso/stock)
    // Optimizado: solo filtrar si es necesario
    const productosFiltrados = (modoActual === "ingreso" || modoActual === "egreso" || modoActual === "stock") && pedidoSeleccionado
      ? productos.filter(p => p.pedidoId === pedidoSeleccionado)
      : productos

    // Preparar datos de forma eficiente (solo los campos necesarios)
    // Usar slice para evitar mutaciones y optimizar memoria
    const productosPreparados = productosFiltrados.map(p => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      stockMinimo: p.stockMinimo,
      pedidoId: p.pedidoId,
      orden: p.orden,
    }))

    const pedidosPreparados = pedidos.map(p => ({ 
      id: p.id, 
      nombre: p.nombre,
      formatoSalida: p.formatoSalida,
      mensajePrevio: p.mensajePrevio,
    }))

    // Crear nuevo AbortController para esta petición
    abortControllerRef.current = new AbortController()

    try {
      // Si modo IA está activo y Ollama está disponible, usar Ollama
      if (modoIA && ollamaStatus.status === "ok" && ollamaStatus.modeloDisponible) {
        try {
          // Construir contexto para Ollama (solo si hay datos relevantes)
          let contexto = ""
          if (productosPreparados.length > 0 || pedidos.length > 0) {
            contexto = `Información del sistema de inventario:
- Productos disponibles: ${productosPreparados.length}
- Pedidos/Proveedores: ${pedidos.length}
- Productos con stock registrado: ${Object.keys(stockActual).length}

Lista de productos (primeros 20):
${productosPreparados.slice(0, 20).map(p => {
  const stock = stockActual[p.id] ?? 0
  return `- ${p.nombre} (${stock} ${p.unidad || "unidades"})`
}).join("\n")}

Lista de pedidos:
${pedidos.map(p => `- ${p.nombre}`).join("\n")}`
          } else {
            contexto = "No hay información de inventario disponible aún."
          }

          const respuestaIA = await generarRespuestaConOllama(texto, contexto)
          addMessage({ tipo: "sistema", contenido: respuestaIA })
          setIsProcessing(false)
          return
        } catch (errorIA) {
          console.error("Error usando Ollama, usando procesamiento básico:", errorIA)
          // Si falla Ollama, continuar con el procesamiento básico
          addMessage({ 
            tipo: "error", 
            contenido: "Error al usar IA. Cambiando a modo básico..." 
          })
        }
      }

      // Llamar al API (procesamiento básico)
      const response = await fetch("/api/stock-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: texto,
          modo: modoActual,
          pedidoSeleccionado: (modoActual === "ingreso" || modoActual === "egreso" || modoActual === "stock") ? pedidoSeleccionado : null,
          productos: productosPreparados,
          stockActual,
          pedidos: pedidosPreparados,
          nombreEmpresa,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detalle || error.error || "Error procesando mensaje")
      }

      const data = await response.json()
      const accion: StockAccionParsed = data.accion

      // Logs solo en desarrollo
      if (process.env.NODE_ENV === "development") {
        console.log(`[CHAT] Acción recibida:`, accion)
        console.log(`[CHAT] Mensaje original: "${texto}"`)
      }

      // Manejar cambio de modo
      if (accion.accion === "cambiar_modo") {
        setModo((accion as any).modo || null) // null = modo pregunta
        addMessage({
          tipo: "sistema",
          contenido: accion.mensaje || "Modo cambiado",
          accion,
        })
        setIsProcessing(false)
        return
      }

      // Manejar selección de pedido (puede ser null para limpiar)
      if (accion.accion === "seleccionar_pedido") {
        setPedidoSeleccionado((accion as any).pedidoId || null)
        addMessage({
          tipo: "sistema",
          contenido: accion.mensaje || "Pedido seleccionado",
          accion,
        })
        setIsProcessing(false)
        return
      }

      // ==================== COMANDOS ESPECIALES EN MODO INGRESO/EGRESO ====================
      
      // Manejar ver lista acumulada
      if (accion.accion === "ver_lista_acumulada") {
        if (productosAcumulados.length === 0) {
          addMessage({
            tipo: "sistema",
            contenido: "📋 La lista está vacía. Agregá productos escribiendo 'producto cantidad'.",
            accion,
          })
        } else {
          const resumen = productosAcumulados.map(p => 
            `• ${p.cantidad} ${p.unidad || "unidades"} de ${p.producto}`
          ).join("\n")
          const verbo = modo === "ingreso" ? "agregar" : "quitar"
          const totalCantidad = productosAcumulados.reduce((sum, p) => sum + p.cantidad, 0)
          addMessage({
            tipo: "sistema",
            contenido: `📋 **Lista actual (${productosAcumulados.length} productos, ${totalCantidad} unidades):**\n\n${resumen}\n\nEscribí "confirmar" para ${verbo} todo.`,
            accion,
          })
        }
        setIsProcessing(false)
        return
      }

      // Manejar deshacer último
      if (accion.accion === "deshacer_ultimo") {
        if (productosAcumulados.length === 0) {
          addMessage({
            tipo: "sistema",
            contenido: "❌ No hay productos para deshacer. La lista está vacía.",
            accion,
          })
        } else {
          const ultimo = productosAcumulados[productosAcumulados.length - 1]
          setProductosAcumulados(prev => prev.slice(0, -1))
          addMessage({
            tipo: "sistema",
            contenido: `✅ Eliminado: ${ultimo.cantidad} ${ultimo.unidad || "unidades"} de ${ultimo.producto}`,
            accion,
          })
        }
        setIsProcessing(false)
        return
      }

      // Manejar quitar producto específico de la lista
      if (accion.accion === "quitar_de_lista" && (accion as any).producto) {
        const nombreProducto = (accion as any).producto.toLowerCase()
        const encontrado = productosAcumulados.find(p => 
          p.producto.toLowerCase().includes(nombreProducto) ||
          nombreProducto.includes(p.producto.toLowerCase())
        )
        
        if (!encontrado) {
          addMessage({
            tipo: "sistema",
            contenido: `❌ No encontré "${(accion as any).producto}" en la lista.`,
            accion,
          })
        } else {
          setProductosAcumulados(prev => prev.filter(p => 
            !(p.productoId === encontrado.productoId && p.accion === encontrado.accion)
          ))
          addMessage({
            tipo: "sistema",
            contenido: `✅ Eliminado: ${encontrado.cantidad} ${encontrado.unidad || "unidades"} de ${encontrado.producto}`,
            accion,
          })
        }
        setIsProcessing(false)
        return
      }

      // Manejar cambiar cantidad de producto en la lista
      if (accion.accion === "cambiar_cantidad" && (accion as any).producto && (accion as any).cantidad) {
        const nombreProducto = (accion as any).producto.toLowerCase()
        const nuevaCantidad = (accion as any).cantidad
        
        const encontrado = productosAcumulados.find(p => 
          p.producto.toLowerCase().includes(nombreProducto) ||
          nombreProducto.includes(p.producto.toLowerCase())
        )
        
        if (!encontrado) {
          addMessage({
            tipo: "sistema",
            contenido: `❌ No encontré "${(accion as any).producto}" en la lista.`,
            accion,
          })
        } else {
          setProductosAcumulados(prev => prev.map(p => {
            if (p.productoId === encontrado.productoId && p.accion === encontrado.accion) {
              return { ...p, cantidad: nuevaCantidad }
            }
            return p
          }))
          addMessage({
            tipo: "sistema",
            contenido: `✅ Cantidad actualizada: ${nuevaCantidad} ${encontrado.unidad || "unidades"} de ${encontrado.producto}`,
            accion,
          })
        }
        setIsProcessing(false)
        return
      }

      // Manejar agregar múltiples productos
      if (accion.accion === "agregar_multiples" && (accion as any).productos) {
        const productosParaAgregar = (accion as any).productos as Array<{ producto: string, cantidad: number }>
        const productosEncontrados: Array<{
          productoId: string
          producto: string
          cantidad: number
          unidad?: string
          accion: "entrada" | "salida"
        }> = []
        const productosNoEncontrados: string[] = []
        
        // Filtrar productos según pedido seleccionado
        const productosFiltrados = pedidoSeleccionado && (modo === "ingreso" || modo === "egreso")
          ? productos.filter(p => p.pedidoId === pedidoSeleccionado)
          : productos
        
        for (const item of productosParaAgregar) {
          // Buscar producto
          const palabras = item.producto.split(/\s+/).filter((p: string) => p.length > 1)
          if (palabras.length === 0) continue
          
          const textoBusqueda = palabras.join(" ").toLowerCase()
          let productoEncontrado = productosFiltrados.find(p => 
            p.nombre.toLowerCase() === textoBusqueda
          )
          
          if (!productoEncontrado) {
            const productosQueContienen = productosFiltrados.filter(p => {
              const nombreLower = p.nombre.toLowerCase()
              return palabras.every((pal: string) => 
                nombreLower.includes(pal.toLowerCase())
              )
            })
            
            if (productosQueContienen.length === 1) {
              productoEncontrado = productosQueContienen[0]
            } else if (productosQueContienen.length > 1) {
              productoEncontrado = productosQueContienen.reduce((prev, curr) => 
                curr.nombre.length < prev.nombre.length ? curr : prev
              )
            }
          }
          
          if (productoEncontrado) {
            // Validar stock si es egreso
            if (modo === "egreso") {
              const stockActualProducto = stockActual[productoEncontrado.id] ?? 0
              if (stockActualProducto < item.cantidad) {
                productosNoEncontrados.push(`${item.producto} (solo hay ${stockActualProducto})`)
                continue
              }
            }
            
            productosEncontrados.push({
              productoId: productoEncontrado.id,
              producto: productoEncontrado.nombre,
              cantidad: item.cantidad,
              unidad: productoEncontrado.unidad,
              accion: modo === "ingreso" ? "entrada" : "salida",
            })
          } else {
            productosNoEncontrados.push(item.producto)
          }
        }
        
        if (productosEncontrados.length > 0) {
          setProductosAcumulados(prev => {
            const nuevaLista = [...prev]
            for (const prod of productosEncontrados) {
              const existe = nuevaLista.find(p => p.productoId === prod.productoId && p.accion === prod.accion)
              if (existe) {
                const index = nuevaLista.indexOf(existe)
                nuevaLista[index] = { ...existe, cantidad: existe.cantidad + prod.cantidad }
              } else {
                nuevaLista.push(prod)
              }
            }
            return nuevaLista
          })
          
          const resumen = productosEncontrados.map(p => 
            `• ${p.cantidad} ${p.unidad || "unidades"} de ${p.producto}`
          ).join("\n")
          
          let mensaje = `✅ Agregados ${productosEncontrados.length} productos:\n\n${resumen}`
          if (productosNoEncontrados.length > 0) {
            mensaje += `\n\n❌ No se encontraron: ${productosNoEncontrados.join(", ")}`
          }
          mensaje += `\n\nEscribí "confirmar" para aplicar todos los cambios.`
          
          addMessage({
            tipo: "sistema",
            contenido: mensaje,
            accion,
          })
        } else {
          addMessage({
            tipo: "sistema",
            contenido: `❌ No se encontraron productos. Verificá los nombres: ${productosNoEncontrados.join(", ")}`,
            accion,
          })
        }
        setIsProcessing(false)
        return
      }

      // Manejar acciones rápidas con confirmación (desde modo pregunta)
      if ((accion.accion === "entrada" || accion.accion === "salida") && accion.requiereConfirmacion) {
        setAccionPendiente({
          id: crypto.randomUUID(),
          accion: accion,
          timestamp: new Date(),
        })
        addMessage({
          tipo: "confirmacion",
          contenido: accion.mensaje || "¿Confirmás esta acción?",
          accion: accion,
          requiereConfirmacion: true,
        })
        setIsProcessing(false)
        return
      }

      // ==================== COMANDOS ESPECIALES EN MODO STOCK ====================
      
      // Ver último cambio de stock
      if (accion.accion === "ver_ultimo_cambio_stock") {
        if (!ultimoCambioStock) {
          addMessage({
            tipo: "sistema",
            contenido: "❌ No hay cambios recientes para mostrar.",
            accion,
          })
        } else {
          addMessage({
            tipo: "sistema",
            contenido: `📊 **Último cambio:**\n${ultimoCambioStock.producto}: ${ultimoCambioStock.stockAnterior} → ${ultimoCambioStock.stockNuevo} ${ultimoCambioStock.unidad || "unidades"}`,
            accion,
          })
        }
        setIsProcessing(false)
        return
      }
      
      // Deshacer último cambio de stock
      if (accion.accion === "deshacer_ultimo_stock") {
        if (!ultimoCambioStock) {
          addMessage({
            tipo: "sistema",
            contenido: "❌ No hay cambios para deshacer.",
            accion,
          })
        } else {
          setIsProcessing(true)
          try {
            const resultado = await actualizarStockDirecto(
              ultimoCambioStock.productoId,
              ultimoCambioStock.stockAnterior,
              `Deshacer: revertir a ${ultimoCambioStock.stockAnterior}`
            )
            addMessage({
              tipo: "sistema",
              contenido: `✅ Deshecho: ${ultimoCambioStock.producto}\nStock: ${ultimoCambioStock.stockNuevo} → ${ultimoCambioStock.stockAnterior} ${ultimoCambioStock.unidad || "unidades"}`,
              accion,
            })
            setUltimoCambioStock(null)
          } catch (error) {
            addMessage({
              tipo: "error",
              contenido: error instanceof Error ? error.message : "Error deshaciendo cambio",
              accion,
            })
          } finally {
            setIsProcessing(false)
          }
        }
        return
      }
      
      // Toggle modo batch para stock
      if (accion.accion === "toggle_batch_stock") {
        const nuevoModo = !modoBatchStock
        setModoBatchStock(nuevoModo)
        if (nuevoModo && cambiosStockAcumulados.length > 0) {
          setCambiosStockAcumulados([])
        }
        addMessage({
          tipo: "sistema",
          contenido: nuevoModo 
            ? "✅ Modo batch activado. Los cambios se acumularán hasta que escribas 'confirmar'."
            : "✅ Modo batch desactivado. Los cambios se aplicarán inmediatamente.",
          accion,
        })
        setIsProcessing(false)
        return
      }
      
      // Ver lista de cambios pendientes (modo batch)
      if (accion.accion === "ver_lista_cambios_stock") {
        if (!modoBatchStock) {
          addMessage({
            tipo: "sistema",
            contenido: "ℹ️ El modo batch no está activado. Escribí 'batch' para activarlo.",
            accion,
          })
        } else if (cambiosStockAcumulados.length === 0) {
          addMessage({
            tipo: "sistema",
            contenido: "📋 No hay cambios pendientes. Los cambios se acumularán cuando los hagas.",
            accion,
          })
        } else {
          const resumen = cambiosStockAcumulados.map(c => 
            `• ${c.producto}: ${c.stockAnterior} → ${c.cantidad} ${c.unidad || "unidades"}`
          ).join("\n")
          addMessage({
            tipo: "sistema",
            contenido: `📋 **Cambios pendientes (${cambiosStockAcumulados.length}):**\n\n${resumen}\n\nEscribí "confirmar" para aplicar todos los cambios.`,
            accion,
          })
        }
        setIsProcessing(false)
        return
      }
      
      // Actualizar múltiples productos en modo stock
      if (accion.accion === "actualizar_stock_multiples" && (accion as any).productos) {
        const productosParaActualizar = (accion as any).productos as Array<{ producto: string, cantidad: number }>
        const cambiosEncontrados: Array<{
          productoId: string
          producto: string
          cantidad: number
          stockAnterior: number
          unidad?: string
        }> = []
        const productosNoEncontrados: string[] = []
        
        const productosFiltrados = pedidoSeleccionado
          ? productos.filter(p => p.pedidoId === pedidoSeleccionado)
          : productos
        
        for (const item of productosParaActualizar) {
          const palabras = item.producto.split(/\s+/).filter((p: string) => p.length > 1)
          if (palabras.length === 0) continue
          
          const textoBusqueda = palabras.join(" ").toLowerCase()
          let productoEncontrado = productosFiltrados.find(p => 
            p.nombre.toLowerCase() === textoBusqueda
          )
          
          if (!productoEncontrado) {
            const productosQueContienen = productosFiltrados.filter(p => {
              const nombreLower = p.nombre.toLowerCase()
              return palabras.every((pal: string) => 
                nombreLower.includes(pal.toLowerCase())
              )
            })
            
            if (productosQueContienen.length === 1) {
              productoEncontrado = productosQueContienen[0]
            } else if (productosQueContienen.length > 1) {
              productoEncontrado = productosQueContienen.reduce((prev, curr) => 
                curr.nombre.length < prev.nombre.length ? curr : prev
              )
            }
          }
          
          if (productoEncontrado) {
            cambiosEncontrados.push({
              productoId: productoEncontrado.id,
              producto: productoEncontrado.nombre,
              cantidad: item.cantidad,
              stockAnterior: stockActual[productoEncontrado.id] ?? 0,
              unidad: productoEncontrado.unidad,
            })
          } else {
            productosNoEncontrados.push(item.producto)
          }
        }
        
        if (cambiosEncontrados.length > 0) {
          if (modoBatchStock) {
            // Acumular cambios
            setCambiosStockAcumulados(prev => {
              const nuevaLista = [...prev]
              for (const cambio of cambiosEncontrados) {
                const existe = nuevaLista.find(c => c.productoId === cambio.productoId)
                if (existe) {
                  const index = nuevaLista.indexOf(existe)
                  nuevaLista[index] = cambio
                } else {
                  nuevaLista.push(cambio)
                }
              }
              return nuevaLista
            })
            
            const resumen = cambiosEncontrados.map(c => 
              `• ${c.producto}: ${c.stockAnterior} → ${c.cantidad} ${c.unidad || "unidades"}`
            ).join("\n")
            
            let mensaje = `✅ Agregados ${cambiosEncontrados.length} cambios:\n\n${resumen}`
            if (productosNoEncontrados.length > 0) {
              mensaje += `\n\n❌ No se encontraron: ${productosNoEncontrados.join(", ")}`
            }
            mensaje += `\n\nEscribí "confirmar" para aplicar todos los cambios.`
            
            addMessage({
              tipo: "sistema",
              contenido: mensaje,
              accion,
            })
          } else {
            // Aplicar inmediatamente
            setIsProcessing(true)
            try {
              const resultados: string[] = []
              for (const cambio of cambiosEncontrados) {
                try {
                  await actualizarStockDirecto(
                    cambio.productoId,
                    cambio.cantidad,
                    `Actualización múltiple: ${cambio.stockAnterior} → ${cambio.cantidad}`
                  )
                  resultados.push(`✅ ${cambio.producto}: ${cambio.stockAnterior} → ${cambio.cantidad} ${cambio.unidad || "unidades"}`)
                } catch (error) {
                  resultados.push(`❌ ${cambio.producto}: ${error instanceof Error ? error.message : "Error"}`)
                }
              }
              
              const mensajeFinal = resultados.length === 1
                ? resultados[0]
                : `✅ **Cambios aplicados:**\n\n${resultados.join("\n")}`
              
              addMessage({
                tipo: "sistema",
                contenido: mensajeFinal,
                accion,
              })
            } catch (error) {
              addMessage({
                tipo: "error",
                contenido: error instanceof Error ? error.message : "Error actualizando stocks",
                accion,
              })
            } finally {
              setIsProcessing(false)
            }
          }
        } else {
          addMessage({
            tipo: "sistema",
            contenido: `❌ No se encontraron productos. Verificá los nombres: ${productosNoEncontrados.join(", ")}`,
            accion,
          })
        }
        setIsProcessing(false)
        return
      }
      
      // Si la acción es "actualizar_stock" (modo stock), ejecutarla directamente o acumularla
      if (accion.accion === "actualizar_stock") {
        const stockAnterior = (accion as any).stockAnterior ?? (stockActual[(accion as any).productoId] ?? 0)
        
        if (modoBatchStock) {
          // Acumular cambio
          setCambiosStockAcumulados(prev => {
            const nuevaLista = prev.filter(c => c.productoId !== (accion as any).productoId)
            nuevaLista.push({
              productoId: (accion as any).productoId,
              producto: (accion as any).producto || "",
              cantidad: accion.cantidad || 0,
              stockAnterior,
              unidad: (accion as any).unidad,
            })
            return nuevaLista
          })
          
          addMessage({
            tipo: "sistema",
            contenido: accion.mensaje || `✅ Cambio agregado a la lista. Escribí "confirmar" para aplicar todos los cambios.`,
            accion,
          })
          setIsProcessing(false)
          return
        } else {
          // Aplicar inmediatamente
          setIsProcessing(true)
          try {
            const resultado = await ejecutarAccion(accion)
            
            // Guardar último cambio para poder deshacer
            setUltimoCambioStock({
              productoId: (accion as any).productoId,
              producto: (accion as any).producto || "",
              stockAnterior,
              stockNuevo: accion.cantidad || 0,
              unidad: (accion as any).unidad,
            })
            
            addMessage({
              tipo: "sistema",
              contenido: resultado,
              accion,
            })
          } catch (error) {
            addMessage({
              tipo: "error",
              contenido: error instanceof Error ? error.message : "Error actualizando stock",
              accion,
            })
          } finally {
            setIsProcessing(false)
          }
          return
        }
      }
      
      // Confirmar cambios acumulados en modo batch stock
      if ((textoLower === "confirmar" || textoLower === "confirmo" || textoLower === "sí" || textoLower === "si" || textoLower === "ok") && modoBatchStock && cambiosStockAcumulados.length > 0) {
        addMessage({ tipo: "usuario", contenido: texto })
        
        const resumenPreConfirmacion = cambiosStockAcumulados.map(c => 
          `• ${c.producto}: ${c.stockAnterior} → ${c.cantidad} ${c.unidad || "unidades"}`
        ).join("\n")
        
        addMessage({
          tipo: "sistema",
          contenido: `📋 **Confirmando ${cambiosStockAcumulados.length} cambios:**\n\n${resumenPreConfirmacion}\n\nAplicando cambios...`,
        })
        
        setIsProcessing(true)
        
        try {
          const resultados: string[] = []
          for (const cambio of cambiosStockAcumulados) {
            try {
              await actualizarStockDirecto(
                cambio.productoId,
                cambio.cantidad,
                `Actualización batch: ${cambio.stockAnterior} → ${cambio.cantidad}`
              )
              resultados.push(`✅ ${cambio.producto}: ${cambio.stockAnterior} → ${cambio.cantidad} ${cambio.unidad || "unidades"}`)
            } catch (error) {
              resultados.push(`❌ ${cambio.producto}: ${error instanceof Error ? error.message : "Error desconocido"}`)
            }
          }
          
          const mensajeFinal = resultados.length === 1
            ? resultados[0]
            : `✅ **Cambios aplicados:**\n\n${resultados.join("\n")}`
          
          addMessage({
            tipo: "sistema",
            contenido: mensajeFinal,
          })
          
          // Limpiar lista acumulada
          setCambiosStockAcumulados([])
        } catch (error) {
          addMessage({
            tipo: "error",
            contenido: error instanceof Error ? error.message : "Error ejecutando cambios",
          })
        } finally {
          setIsProcessing(false)
        }
        return
      }
      
      // Cancelar cambios acumulados en modo batch stock
      if ((textoLower === "cancelar" || textoLower === "limpiar" || textoLower === "borrar" || textoLower === "reset") && modoBatchStock && cambiosStockAcumulados.length > 0) {
        addMessage({ tipo: "usuario", contenido: texto })
        setCambiosStockAcumulados([])
        addMessage({
          tipo: "sistema",
          contenido: "✅ Cambios cancelados. Podés empezar de nuevo.",
        })
        return
      }

      // Si hay un producto acumulado (modo ingreso/egreso), agregarlo a la lista
      if ((accion as any).productoAcumulado && (modo === "ingreso" || modo === "egreso")) {
        const productoAcum = (accion as any).productoAcumulado
        
        setProductosAcumulados(prev => {
          // Verificar si el producto ya está en la lista
          const existe = prev.find(p => p.productoId === productoAcum.productoId && p.accion === productoAcum.accion)
          let nuevaLista: typeof prev
          
          if (existe) {
            // Si existe, sumar la cantidad
            nuevaLista = prev.map(p => 
              p.productoId === productoAcum.productoId && p.accion === productoAcum.accion
                ? { ...p, cantidad: p.cantidad + productoAcum.cantidad }
                : p
            )
          } else {
            // Si no existe, agregarlo
            nuevaLista = [...prev, {
              productoId: productoAcum.productoId,
              producto: productoAcum.producto,
              cantidad: productoAcum.cantidad,
              unidad: productoAcum.unidad,
              accion: productoAcum.accion,
            }]
          }
          
          // Generar mensaje con resumen actualizado
          const resumen = nuevaLista.map(p => 
            `• ${p.cantidad} ${p.unidad || "unidades"} de ${p.producto}`
          ).join("\n")
          
          const verbo = modo === "ingreso" ? "agregar" : "quitar"
          const verboPasado = modo === "ingreso" ? "agregar" : "quitar"
          const totalProductos = nuevaLista.length
          
          addMessage({
            tipo: "sistema",
            contenido: `✅ Agregado: ${productoAcum.cantidad} ${productoAcum.unidad || "unidades"} de ${productoAcum.producto}\n\n📋 **Lista completa (${totalProductos} productos):**\n\n${resumen}\n\nEscribí "confirmar" para ${verboPasado} todo o seguí agregando productos.`,
            accion,
          })
          
          return nuevaLista
        })
        return
      }

      // Si el usuario escribe "confirmar" y hay productos acumulados
      if ((textoLower === "confirmar" || textoLower === "confirmo" || textoLower === "sí" || textoLower === "si" || textoLower === "ok") && productosAcumulados.length > 0) {
        addMessage({ tipo: "usuario", contenido: texto })
        
        // Mostrar resumen antes de confirmar
        const resumenPreConfirmacion = productosAcumulados.map(p => 
          `• ${p.cantidad} ${p.unidad || "unidades"} de ${p.producto}`
        ).join("\n")
        const verbo = modo === "ingreso" ? "agregar" : "quitar"
        
        addMessage({
          tipo: "sistema",
          contenido: `📋 **Confirmando ${productosAcumulados.length} productos:**\n\n${resumenPreConfirmacion}\n\nAplicando cambios...`,
        })
        
        setIsProcessing(true)
        
        try {
          const resultados: string[] = []
          for (const productoAcum of productosAcumulados) {
            try {
              const resultado = await ejecutarAccion({
                accion: productoAcum.accion,
                productoId: productoAcum.productoId,
                cantidad: productoAcum.cantidad,
                unidad: productoAcum.unidad,
                confianza: 1.0, // Confianza máxima porque el usuario confirmó explícitamente
              })
              resultados.push(resultado)
            } catch (error) {
              resultados.push(`❌ Error con ${productoAcum.producto}: ${error instanceof Error ? error.message : "Error desconocido"}`)
            }
          }
          
          const mensajeFinal = resultados.length === 1
            ? resultados[0]
            : `✅ **Cambios aplicados:**\n\n${resultados.join("\n")}`
          
          addMessage({
            tipo: "sistema",
            contenido: mensajeFinal,
          })
          
          // Limpiar lista acumulada
          setProductosAcumulados([])
        } catch (error) {
          addMessage({
            tipo: "error",
            contenido: error instanceof Error ? error.message : "Error ejecutando acciones",
          })
        } finally {
          setIsProcessing(false)
        }
        return
      }

      // Si el usuario escribe "cancelar" o "limpiar" y hay productos acumulados
      if ((textoLower === "cancelar" || textoLower === "limpiar" || textoLower === "borrar" || textoLower === "reset") && productosAcumulados.length > 0) {
        addMessage({ tipo: "usuario", contenido: texto })
        setProductosAcumulados([])
        addMessage({
          tipo: "sistema",
          contenido: "✅ Lista limpiada. Podés empezar de nuevo.",
        })
        return
      }

      // NUEVA ARQUITECTURA: Ollama sugiere comandos, el fallback los ejecuta
      if (accion.comandoSugerido) {
        console.log(`[CHAT] Comando sugerido detectado:`, accion.comandoSugerido)
        
        // Validar que el comando tenga los datos necesarios para ejecutarse
        const comando = accion.comandoSugerido as StockAccionParsed
        const necesitaProducto = ["crear_producto", "entrada", "salida", "consulta_stock"].includes(comando.accion)
        const tieneDatosCompletos = !necesitaProducto || 
          (comando.accion === "crear_producto" && comando.producto) ||
          (comando.accion !== "crear_producto" && comando.productoId)
        
        // Si no tiene datos completos, solo mostrar mensaje conversacional
        if (!tieneDatosCompletos) {
          console.log(`[CHAT] Comando sugerido sin datos completos, solo mostrando mensaje`)
          addMessage({
            tipo: "sistema",
            contenido: accion.mensaje || "¿En qué te puedo ayudar?",
            accion,
          })
          return
        }
        
        // Si requiere confirmación, mostrar mensaje y pedir confirmación
        if (accion.requiereConfirmacion) {
          setAccionPendiente({
            id: crypto.randomUUID(),
            accion: comando, // Guardar el comando sugerido para ejecutar
            timestamp: new Date(),
          })
          addMessage({
            tipo: "confirmacion",
            contenido: accion.mensaje || "¿Confirmás esta acción?",
            accion: comando,
            requiereConfirmacion: true,
          })
          return
        }
        
        // Si NO requiere confirmación (consultas), ejecutar directamente
        try {
          console.log(`[CHAT] Ejecutando comando sugerido directamente:`, comando)
          const resultado = await ejecutarAccion(comando)
          console.log(`[CHAT] Resultado:`, resultado)
          
          // Mostrar mensaje de Ollama + resultado de la ejecución
          const mensajeCompleto = accion.mensaje 
            ? `${accion.mensaje}\n\n${resultado}`
            : resultado
          
          addMessage({ 
            tipo: "sistema", 
            contenido: mensajeCompleto, 
            accion: comando 
          })
        } catch (error) {
          console.error(`[CHAT] Error ejecutando comando sugerido:`, error)
          addMessage({
            tipo: "error",
            contenido: error instanceof Error ? error.message : "Error ejecutando comando",
            accion: comando,
          })
        }
        return
      }

      // Si no hay comando sugerido, solo mostrar mensaje conversacional
      console.log(`[CHAT] Respuesta conversacional:`, accion.mensaje)
      addMessage({
        tipo: "sistema",
        contenido: accion.mensaje || "¿En qué te puedo ayudar?",
        accion,
      })

    } catch (error) {
      // Ignorar errores de cancelación
      if (error instanceof Error && error.name === "AbortError") {
        return
      }
      console.error("Error en chat:", error)
      addMessage({
        tipo: "error",
        contenido: error instanceof Error 
          ? error.message 
          : "Error procesando el mensaje. Verificá que Ollama esté corriendo.",
      })
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
    }, [isProcessing, productos, stockActual, pedidos, accionPendiente, addMessage, ejecutarAccion, modo, productosAcumulados, modoIA, ollamaStatus, generarRespuestaConOllama, pedidoSeleccionado, nombreEmpresa])

  // Cancelar mensaje en proceso
  const cancelarMensaje = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsProcessing(false)
      
      // Eliminar el último mensaje del usuario de la lista (para que pueda editarlo)
      setMessages(prev => {
        const nuevosMensajes = [...prev]
        // Buscar y eliminar el último mensaje del usuario
        for (let i = nuevosMensajes.length - 1; i >= 0; i--) {
          if (nuevosMensajes[i].tipo === "usuario") {
            nuevosMensajes.splice(i, 1)
            break
          }
        }
        return nuevosMensajes
      })
    }
  }, [])

  // Limpiar chat
  const limpiarChat = useCallback(() => {
    setMessages([])
    setAccionPendiente(null)
    setProductosAcumulados([])
  }, [])
  
  // Limpiar productos acumulados cuando cambia el modo
  useEffect(() => {
    if (!modo || modo === "pregunta" || modo === "stock") {
      setProductosAcumulados([])
    }
  }, [modo])
  
  // Limpiar cambios de stock acumulados cuando se sale del modo stock
  useEffect(() => {
    if (modo !== "stock") {
      setCambiosStockAcumulados([])
      setModoBatchStock(false)
    }
  }, [modo])

  // Obtener productos con stock bajo
  const productosStockBajo = productos.filter(p => {
    const actual = stockActual[p.id] || 0
    return actual < p.stockMinimo
  })

  return {
    // Chat
    messages,
    isProcessing,
    enviarMensaje,
    limpiarChat,
    cancelarMensaje,
    ollamaStatus,
    checkOllamaConnection,
    accionPendiente,
    nombreAsistente,
    modo,
    setModo,
    modoIA,
    setModoIA,
    productosAcumulados,
    setProductosAcumulados,
    pedidoSeleccionado,
    setPedidoSeleccionado,
    
    // Stock
    productos,
    pedidos,
    stockActual,
    movimientos,
    loadingStock,
    productosStockBajo,
    
    // Acciones directas
    actualizarStock,
    crearProducto,
    editarProducto,
    eliminarProducto,
  }
}
