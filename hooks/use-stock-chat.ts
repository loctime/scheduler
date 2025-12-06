"use client"

import { useState, useCallback, useEffect, useRef } from "react"
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
  const { config } = useConfig(user)
  const nombreEmpresa = config?.nombreEmpresa
  const nombreAsistente = nombreEmpresa ? `${nombreEmpresa} Assistant` : "Stock Assistant"
  
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
  
  // Modo del chat (ingreso/egreso/pregunta)
  const [modo, setModo] = useState<"ingreso" | "egreso" | "pregunta" | null>(null)

  // Verificar conexión con Ollama
  const checkOllamaConnection = useCallback(async () => {
    setOllamaStatus({ status: "checking" })
    try {
      const response = await fetch("/api/stock-chat")
      const data = await response.json()
      
      if (data.status === "ok") {
        setOllamaStatus({
          status: "ok",
          modeloDisponible: data.modeloDisponible,
          message: data.modeloDisponible 
            ? `Conectado (${data.modeloConfigurado})`
            : `Modelo ${data.modeloConfigurado} no encontrado`
        })
      } else {
        setOllamaStatus({
          status: "error",
          message: data.message || "Error conectando con Ollama"
        })
      }
    } catch (error) {
      setOllamaStatus({
        status: "error",
        message: "No se puede conectar con el servidor"
      })
    }
  }, [])

  // Cargar pedidos del usuario
  useEffect(() => {
    if (!db || !userId) return

    const pedidosRef = collection(db, COLLECTIONS.PEDIDOS)
    const q = query(pedidosRef, where("userId", "==", userId))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pedidosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pedido[]
      setPedidos(pedidosData)
    })

    return () => unsubscribe()
  }, [userId])

  // Cargar productos del usuario
  useEffect(() => {
    if (!db || !userId) {
      setLoadingStock(false)
      return
    }

    const productosRef = collection(db, COLLECTIONS.PRODUCTS)
    const q = query(productosRef, where("userId", "==", userId))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Producto[]
      setProductos(productosData)
      setLoadingStock(false)
    })

    return () => unsubscribe()
  }, [userId])

  // Cargar stock actual
  useEffect(() => {
    if (!db || !userId) return

    const stockRef = collection(db, COLLECTIONS.STOCK_ACTUAL)
    const q = query(stockRef, where("userId", "==", userId))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stockData: Record<string, number> = {}
      snapshot.docs.forEach(doc => {
        const data = doc.data() as StockActual
        stockData[data.productoId] = data.cantidad
      })
      setStockActual(stockData)
    })

    return () => unsubscribe()
  }, [userId])

  // Cargar historial de movimientos recientes
  useEffect(() => {
    if (!db || !userId) return

    const movimientosRef = collection(db, COLLECTIONS.STOCK_MOVIMIENTOS)
    const q = query(
      movimientosRef, 
      where("userId", "==", userId),
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
  }, [userId])

  // Verificar Ollama al montar
  useEffect(() => {
    checkOllamaConnection()
  }, [checkOllamaConnection])

  // Mensaje de bienvenida
  useEffect(() => {
    if (messages.length === 0 && ollamaStatus.status === "ok") {
      const welcomeMsg = productos.length === 0
        ? "¡Hola! Soy tu asistente de inventario. Todavía no tenés productos cargados. Podés decirme algo como \"creá un producto Tomate en cajas\" o ir a la sección Pedidos para cargarlos. ¿En qué te ayudo?"
        : `¡Hola! Tenés ${productos.length} productos en tu inventario. Podés preguntarme sobre tu stock, agregar o quitar productos, ver qué te falta... ¿Qué necesitás?`
      
      addMessage({
        tipo: "sistema",
        contenido: welcomeMsg,
      })
    }
  }, [ollamaStatus.status, productos.length])

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

  // ==================== ACCIONES DE BASE DE DATOS ====================

  // Crear producto
  const crearProducto = useCallback(async (
    nombre: string,
    unidad?: string,
    stockMinimo?: number,
    pedidoId?: string
  ) => {
    if (!db || !userId) throw new Error("No hay conexión")

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
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), nuevoProducto)
    return { id: docRef.id, ...nuevoProducto }
  }, [db, userId, pedidos])

  // Editar producto
  const editarProducto = useCallback(async (
    productoId: string,
    cambios: Partial<Pick<Producto, "nombre" | "unidad" | "stockMinimo">>
  ) => {
    if (!db || !userId) throw new Error("No hay conexión")

    const docRef = doc(db, COLLECTIONS.PRODUCTS, productoId)
    await updateDoc(docRef, {
      ...cambios,
      updatedAt: serverTimestamp(),
    })
  }, [db, userId])

  // Eliminar producto
  const eliminarProducto = useCallback(async (productoId: string) => {
    if (!db || !userId) throw new Error("No hay conexión")

    await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productoId))
    
    // También eliminar el stock actual
    const stockDocId = `${userId}_${productoId}`
    try {
      await deleteDoc(doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId))
    } catch (e) {
      // Puede no existir
    }
  }, [db, userId])

  // Actualizar stock
  const actualizarStock = useCallback(async (
    productoId: string,
    tipo: "entrada" | "salida",
    cantidad: number,
    motivo?: string
  ) => {
    if (!db || !userId) throw new Error("No hay conexión")

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
      userId,
      userName,
      createdAt: serverTimestamp(),
      // Solo incluir campos opcionales si tienen valor
      ...(motivo && { motivo }),
      ...(producto.pedidoId && { pedidoId: producto.pedidoId }),
    }

    await addDoc(collection(db, COLLECTIONS.STOCK_MOVIMIENTOS), movimiento)

    // Actualizar stock actual
    const stockDocId = `${userId}_${productoId}`
    const stockDocRef = doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId)
    
    await setDoc(stockDocRef, {
      productoId,
      cantidad: nuevoStock,
      ultimaActualizacion: serverTimestamp(),
      userId,
      // Solo incluir pedidoId si tiene valor
      ...(producto.pedidoId && { pedidoId: producto.pedidoId }),
    })

    return { stockAnterior, nuevoStock, producto }
  }, [db, userId, userName, productos, stockActual])

  // Inicializar stock de productos
  const inicializarStockProductos = useCallback(async (cantidadInicial: number = 0) => {
    if (!db || !userId) throw new Error("No hay conexión")
    if (productos.length === 0) throw new Error("No hay productos para inicializar")

    let inicializados = 0
    for (const producto of productos) {
      const stockDocId = `${userId}_${producto.id}`
      const stockDocRef = doc(db, COLLECTIONS.STOCK_ACTUAL, stockDocId)
      
      // Solo inicializar si no tiene stock aún
      if (stockActual[producto.id] === undefined || stockActual[producto.id] === 0) {
        await setDoc(stockDocRef, {
          productoId: producto.id,
          cantidad: cantidadInicial,
          ultimaActualizacion: serverTimestamp(),
          userId,
          // Solo incluir pedidoId si tiene valor
          ...(producto.pedidoId && { pedidoId: producto.pedidoId }),
        })
        inicializados++
      }
    }
    return inicializados
  }, [db, userId, productos, stockActual])

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
  }, [productos, pedidos, stockActual, actualizarStock, crearProducto, editarProducto, eliminarProducto, inicializarStockProductos])

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

    // Validar que haya modo activo
    console.log(`[CHAT] Enviando mensaje: "${texto}", modo actual:`, modo)
    if (!modo) {
      console.log(`[CHAT] No hay modo activo, solicitando selección`)
      addMessage({ tipo: "usuario", contenido: texto })
      addMessage({
        tipo: "sistema",
        contenido: "Seleccioná un modo primero: 'Ingreso' para agregar stock, 'Egreso' para quitar stock, o 'Pregunta' para consultar stock."
      })
      return
    }
    console.log(`[CHAT] Modo activo confirmado:`, modo)

    // Agregar mensaje del usuario
    addMessage({ tipo: "usuario", contenido: texto })
    setIsProcessing(true)

    // Crear nuevo AbortController para esta petición
    abortControllerRef.current = new AbortController()

    try {
      // Llamar al API
      const response = await fetch("/api/stock-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: texto,
          modo, // Incluir el modo activo
          productos: productos.map(p => ({
            id: p.id,
            nombre: p.nombre,
            unidad: p.unidad,
            stockMinimo: p.stockMinimo,
            pedidoId: p.pedidoId,
          })),
          stockActual,
          pedidos: pedidos.map(p => ({ 
            id: p.id, 
            nombre: p.nombre,
            formatoSalida: p.formatoSalida,
            mensajePrevio: p.mensajePrevio,
          })),
          productos: productos.map(p => ({
            id: p.id,
            nombre: p.nombre,
            unidad: p.unidad,
            stockMinimo: p.stockMinimo,
            pedidoId: p.pedidoId,
          })),
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

      console.log(`[CHAT] Acción recibida:`, accion)
      console.log(`[CHAT] Mensaje original: "${texto}"`)
      console.log(`[CHAT] Tiene comando sugerido:`, !!accion.comandoSugerido)

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
  }, [isProcessing, productos, stockActual, pedidos, accionPendiente, addMessage, ejecutarAccion, modo])

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
  }, [])

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
