import { NextRequest, NextResponse } from "next/server"
import type { StockAccionParsed, TipoAccion } from "@/lib/types"

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "phi3:mini"

interface OllamaGenerateResponse {
  model: string
  created_at: string
  response: string
  done: boolean
}

interface OllamaChatResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
}

interface ProductoInfo {
  id: string
  nombre: string
  unidad?: string
  stockMinimo?: number
  stockActual?: number
  pedidoId?: string
  pedidoNombre?: string
}

interface PedidoInfo {
  id: string
  nombre: string
  productosCount: number
}

interface ContextoChat {
  productos: ProductoInfo[]
  pedidos: PedidoInfo[]
  stockBajo: ProductoInfo[]
  totalProductos: number
  totalPedidos: number
}

// Fallback: detectar acción por palabras clave cuando Ollama falla
function detectarAccionPorPalabrasClave(
  mensaje: string, 
  productos: ProductoInfo[]
): StockAccionParsed {
  const msgLower = mensaje.toLowerCase().trim()
  
  console.log(`[DETECTOR] Analizando mensaje: "${msgLower}"`)
  
  // PRIORIDAD 0: Mensajes muy cortos o ambiguos siempre son conversación
  if (msgLower.length <= 5 || /^(hola|buenas|hey|hi|ok|okay|si|sí|no|gracias|chau|bye)$/.test(msgLower)) {
    console.log(`[DETECTOR] Detectado: MENSAJE_CORTO/CONVERSACION`)
    if (/^(hola|buenas|hey|hi)/.test(msgLower)) {
      return { 
        accion: "conversacion", 
        mensaje: "¡Hola! Soy tu asistente de inventario. Podés preguntarme sobre tu stock, agregar o quitar productos, crear productos nuevos... ¿En qué te ayudo?", 
        confianza: 1.0 
      }
    }
    return { 
      accion: "conversacion", 
      mensaje: "¿En qué te puedo ayudar con tu inventario?", 
      confianza: 1.0 
    }
  }
  
  // PRIORIDAD 1: Detectar saludo (después de validar mensajes cortos)
  if (/^(hola|buenas|hey|hi|buen día|buenos días|buenas tardes|buenas noches)/.test(msgLower)) {
    console.log(`[DETECTOR] Detectado: SALUDO`)
    return { 
      accion: "conversacion", 
      mensaje: "¡Hola! Soy tu asistente de inventario. Podés preguntarme sobre tu stock, agregar o quitar productos, crear productos nuevos... ¿En qué te ayudo?", 
      confianza: 1.0 
    }
  }
  
  // Detectar consulta de stock (cuánto, stock actual, qué hay de X)
  const consultaStock = /(cuánto|cuanto|cual|cuál|stock|hay|tengo|queda|quedan|disponible|actual).*(de|del|la|el|las|los)/.test(msgLower) ||
                        /(qué|que|cual|cuál).*(stock|hay|tengo|queda|disponible|actual)/.test(msgLower) ||
                        /stock.*actual/.test(msgLower) ||
                        /(cuál|cuál es|cual es).*stock/.test(msgLower)
  
  if (consultaStock) {
    // Extraer palabras relevantes del mensaje
    const palabrasRelevantes = msgLower
      .replace(/(cuánto|cuanto|stock|hay|tengo|queda|quedan|disponible|actual|de|del|la|el|las|los|qué|que|es|está|cual|cuál)/g, "")
      .trim()
      .split(/\s+/)
      .filter(p => p.length > 2)
    
    let productoEncontrado: ProductoInfo | undefined
    
    // Estrategia 1: Buscar frase completa (ej: "individual de verdura")
    const fraseCompleta = palabrasRelevantes.join(" ")
    if (fraseCompleta.length > 5) {
      productoEncontrado = productos.find(p => {
        const nombreLower = p.nombre.toLowerCase()
        // Coincidencia exacta o parcial de la frase
        if (nombreLower.includes(fraseCompleta) || fraseCompleta.includes(nombreLower)) {
          return true
        }
        // Todas las palabras deben estar en el nombre (en cualquier orden)
        const palabrasFrase = fraseCompleta.split(/\s+/).filter(p => p.length > 2)
        return palabrasFrase.length > 0 && palabrasFrase.every(pal => nombreLower.includes(pal))
      })
    }
    
    // Estrategia 2: Buscar por palabras clave (coincidencia de todas las palabras importantes)
    if (!productoEncontrado && palabrasRelevantes.length > 1) {
      productoEncontrado = productos.find(p => {
        const nombreLower = p.nombre.toLowerCase()
        // Al menos 2 palabras deben coincidir
        const coincidencias = palabrasRelevantes.filter(pal => 
          nombreLower.includes(pal) || 
          nombreLower.split(/\s+/).some(n => n.includes(pal) || pal.includes(n))
        )
        return coincidencias.length >= Math.min(2, palabrasRelevantes.length)
      })
    }
    
    // Estrategia 3: Buscar por palabra más larga (probablemente el nombre principal)
    if (!productoEncontrado) {
      const palabraMasLarga = palabrasRelevantes.sort((a, b) => b.length - a.length)[0]
      if (palabraMasLarga) {
        productoEncontrado = productos.find(p => {
          const nombreLower = p.nombre.toLowerCase()
          return nombreLower.includes(palabraMasLarga) ||
                 nombreLower.split(/\s+/).some(pal => 
                   pal.includes(palabraMasLarga) || 
                   palabraMasLarga.includes(pal)
                 )
        })
      }
    }
    
    // Estrategia 4: Coincidencia parcial de cualquier palabra
    if (!productoEncontrado) {
      for (const palabra of palabrasRelevantes) {
        productoEncontrado = productos.find(p => 
          p.nombre.toLowerCase().includes(palabra) ||
          p.nombre.toLowerCase().split(/\s+/).some(pal => 
            pal.includes(palabra) || palabra.includes(pal)
          )
        )
        if (productoEncontrado) break
      }
    }
    
    if (productoEncontrado) {
      console.log(`[DETECTOR] Detectado: CONSULTA_STOCK - Producto: ${productoEncontrado.nombre}`)
      return {
        accion: "consulta_stock",
        producto: productoEncontrado.nombre,
        productoId: productoEncontrado.id,
        mensaje: `Consultando stock de ${productoEncontrado.nombre}...`,
        confianza: 0.9,
      }
    } else {
      console.log(`[DETECTOR] Detectado: CONSULTA_STOCK - Producto no encontrado`)
      // Sugerir productos similares
      const sugerencias = productos
        .filter(p => {
          const nombreLower = p.nombre.toLowerCase()
          return palabrasRelevantes.some(pal => nombreLower.includes(pal) || pal.length > 3)
        })
        .slice(0, 3)
        .map(p => p.nombre)
      
      const mensajeSugerencia = sugerencias.length > 0
        ? `No encontré ese producto. ¿Te referís a alguno de estos?\n${sugerencias.map(s => `• ${s}`).join("\n")}\n\nO decime "mostrar productos" para ver todos.`
        : `No encontré ese producto. Decime "mostrar productos" para ver la lista completa.`
      
      return {
        accion: "consulta_stock",
        mensaje: mensajeSugerencia,
        confianza: 0.5,
      }
    }
  }
  
  // Detectar listar productos
  if (/mostrar|listar|ver|productos|inventario|qué tengo/.test(msgLower)) {
    if (/pedido|proveedor/.test(msgLower)) {
      console.log(`[DETECTOR] Detectado: LISTAR_PEDIDOS`)
      return { accion: "listar_pedidos", mensaje: "Mostrando pedidos...", confianza: 0.8 }
    }
    console.log(`[DETECTOR] Detectado: LISTAR_PRODUCTOS`)
    return { accion: "listar_productos", mensaje: "Mostrando productos...", confianza: 0.8 }
  }
  
  // Detectar stock bajo
  if (/falta|bajo|mínimo|pedir|reponer|qué me falta/.test(msgLower)) {
    console.log(`[DETECTOR] Detectado: STOCK_BAJO`)
    return { accion: "stock_bajo", mensaje: "Verificando stock bajo...", confianza: 0.8 }
  }
  
  // Detectar ayuda
  if (/ayuda|help|qué puedo|cómo funciona/.test(msgLower)) {
    console.log(`[DETECTOR] Detectado: AYUDA`)
    return { accion: "ayuda", mensaje: "Mostrando ayuda...", confianza: 0.9 }
  }
  
  // Detectar entrada/salida con cantidad (solo si hay cantidad explícita y verbos claros)
  // Ser más estricto: necesita cantidad Y verbo claro
  const matchCantidad = msgLower.match(/(\d+)\s*(cajas?|kg|kilos?|unidades?|u|botellas?|packs?)?/)
  const esSalida = /saco|sacá|quito|uso|usé|gasto|consumo|llevé|vendí|vendo|sale|salieron/.test(msgLower)
  const esEntrada = /agrego|agregá|pongo|sumo|llegó|llegaron|recibí|meto|agrega|agregar|entró|entraron|compré|comprar/.test(msgLower)
  
  // Si no hay cantidad explícita, no es una acción de stock
  if (!matchCantidad && (esSalida || esEntrada)) {
    console.log(`[DETECTOR] Verbo detectado pero sin cantidad, tratando como conversación`)
    return {
      accion: "conversacion",
      mensaje: esSalida 
        ? "Para quitar stock necesito saber la cantidad. Por ejemplo: 'saco 2 cajas de tomate' o 'quito 5 kg de harina'."
        : "Para agregar stock necesito saber la cantidad. Por ejemplo: 'agregá 10 unidades de leche' o 'llegaron 3 cajas de pan'.",
      confianza: 0.7
    }
  }
  
  // NO detectar entrada/salida si es un saludo simple
  const esSaludoSimple = /^(hola|buenas|hey|hi|buen día|buenos días)$/.test(msgLower)
  
  if (matchCantidad && (esSalida || esEntrada) && !esSaludoSimple) {
    console.log(`[DETECTOR] Detectado: ${esSalida ? "SALIDA" : "ENTRADA"} con cantidad`)
    const cantidad = Math.abs(parseInt(matchCantidad[1])) // Asegurar cantidad positiva
    const unidad = matchCantidad[2] || "u"
    
    // Validar cantidad
    if (cantidad <= 0 || isNaN(cantidad)) {
      console.warn(`[DETECTOR] Cantidad inválida: ${matchCantidad[1]}, ignorando detección`)
      // Continuar con otras detecciones
    } else {
    
    // Buscar producto mencionado
    const productoEncontrado = productos.find(p => 
      msgLower.includes(p.nombre.toLowerCase())
    )
    
      if (productoEncontrado) {
        return {
          accion: esSalida ? "salida" : "entrada",
          producto: productoEncontrado.nombre,
          productoId: productoEncontrado.id,
          cantidad,
          unidad,
          mensaje: `${esSalida ? "Quitando" : "Agregando"} ${cantidad} ${unidad} de ${productoEncontrado.nombre}...`,
          confianza: 0.85,
        }
      } else {
        // Producto no encontrado - sugerir crear
        const nombreProducto = msgLower.replace(/(agrego|agregá|pongo|sumo|llegó|llegaron|recibí|meto|agrega|agregar|saco|sacá|quito|uso|usé|gasto|consumo|llevé|\d+|al stock|del stock)/g, "").trim()
        return {
          accion: "crear_producto",
          producto: nombreProducto || "producto",
          unidad: unidad,
          stockMinimo: 1,
          mensaje: `No encontré "${nombreProducto || "ese producto"}" en tu inventario. ¿Querés que lo cree con unidad "${unidad}"?`,
          confianza: 0.7,
          requiereConfirmacion: true,
        }
      }
    }
  }
  
  // Detectar entrada/salida sin cantidad específica (solo "agrega X")
  if ((esEntrada || esSalida) && !matchCantidad && !esSaludoSimple) {
    console.log(`[DETECTOR] Detectado: ${esEntrada ? "ENTRADA" : "SALIDA"} sin cantidad`)
    // Buscar producto mencionado
    const productoEncontrado = productos.find(p => 
      msgLower.includes(p.nombre.toLowerCase())
    )
    
    if (productoEncontrado) {
      return {
        accion: "consulta_stock",
        producto: productoEncontrado.nombre,
        productoId: productoEncontrado.id,
        mensaje: `Encontré "${productoEncontrado.nombre}". ¿Cuántas unidades querés ${esEntrada ? "agregar" : "quitar"}?`,
        confianza: 0.7,
      }
    } else {
      // Producto no encontrado - sugerir crear
      const nombreProducto = msgLower.replace(/(agrego|agregá|pongo|sumo|llegó|llegaron|recibí|meto|agrega|agregar|saco|sacá|quito|uso|usé|gasto|consumo|llevé|al stock|del stock)/g, "").trim()
      return {
        accion: "crear_producto",
        producto: nombreProducto || "producto",
        unidad: "u",
        stockMinimo: 1,
        mensaje: `No encontré "${nombreProducto || "ese producto"}" en tu inventario. ¿Querés que lo cree? Decime también la unidad (ej: cajas, kg, unidades).`,
        confianza: 0.7,
        requiereConfirmacion: true,
      }
    }
  }
  
  // Detectar crear producto
  if (/crea|creá|nuevo|nueva|agregar al inventario/.test(msgLower)) {
    console.log(`[DETECTOR] Detectado: CREAR_PRODUCTO`)
    return {
      accion: "crear_producto",
      mensaje: "Para crear un producto decime: nombre, unidad (ej: cajas, kg) y stock mínimo.",
      confianza: 0.7,
      requiereConfirmacion: true,
    }
  }
  
  // Default
  console.log(`[DETECTOR] Detectado: DESCONOCIDO - Usando respuesta genérica`)
  return {
    accion: "conversacion",
    mensaje: "No estoy seguro de qué querés hacer. Probá con: 'mostrar productos', 'qué me falta pedir', o 'saco 2 cajas de X'.",
    confianza: 0.4,
  }
}

// Prompt simplificado para modelos pequeños
function buildSystemPrompt(contexto: ContextoChat, nombreEmpresa?: string) {
  const { productos, pedidos, totalProductos, totalPedidos } = contexto
  
  const listaProductos = productos.slice(0, 10).map(p => 
    `${p.nombre}(ID:${p.id},stock:${p.stockActual ?? 0})`
  ).join(", ") || "ninguno"

  const nombreAsistente = nombreEmpresa 
    ? `${nombreEmpresa} Assistant`
    : "Stock Assistant"

  return `Eres un asistente de inventario conversacional. Tu nombre es "${nombreAsistente}". 
Responde SOLO con JSON válido.

TU ROL: Interpretar la intención del usuario y SUGERIR comandos, NO ejecutarlos directamente.
Mantén una conversación natural y fluida. El sistema ejecutará los comandos que sugieras.

PRODUCTOS DISPONIBLES (usa el ID exacto cuando sugieras comandos):
${listaProductos}

TOTAL: ${totalProductos} productos, ${totalPedidos} pedidos

COMANDOS DISPONIBLES (que podés sugerir):
- listar_productos: mostrar productos (no necesita parámetros)
- listar_pedidos: mostrar pedidos (no necesita parámetros)
- entrada: agregar stock (necesita productoId EXACTO de la lista, cantidad, unidad opcional)
- salida: quitar stock (necesita productoId EXACTO de la lista, cantidad, unidad opcional)
- crear_producto: crear nuevo (necesita producto, unidad, stockMinimo)
- stock_bajo: productos con poco stock (no necesita parámetros)
- consulta_stock: consultar stock de un producto (necesita productoId EXACTO de la lista)

IMPORTANTE: Cuando sugieras entrada/salida/consulta_stock, DEBES usar el productoId EXACTO de la lista de productos arriba.
Si no encontrás el producto en la lista, NO incluyas productoId en comandoSugerido, solo responde conversacionalmente.

FORMATO DE RESPUESTA:
{
  "accion": "conversacion",  // Siempre "conversacion" para mantener el diálogo
  "mensaje": "Tu respuesta natural al usuario",
  "confianza": 0.9,
  "comandoSugerido": {  // OPCIONAL: solo si entendiste una acción clara
    "accion": "salida",
    "productoId": "abc123",
    "cantidad": 2,
    "unidad": "cajas"
  },
  "requiereConfirmacion": true  // true si hay comandoSugerido y es una acción que modifica datos
}

IMPORTANTE:
- Si el mensaje es un saludo, solo responde conversacionalmente
- Si entendiste una acción clara, incluye "comandoSugerido" con los datos necesarios
- Para acciones que modifican datos (entrada, salida, crear_producto), usa "requiereConfirmacion": true
- Para consultas (listar_productos, consulta_stock), usa "requiereConfirmacion": false

Ejemplos:
- "hola" 
  → {"accion":"conversacion","mensaje":"¡Hola! ¿En qué te ayudo?","confianza":1.0}

- "necesito sacar 2 cajas de tomate"
  → {
      "accion":"conversacion",
      "mensaje":"Entiendo que querés quitar 2 cajas de tomate. ¿Confirmás que ejecute el comando?",
      "confianza":0.9,
      "comandoSugerido":{"accion":"salida","productoId":"buscar_id_de_tomate","cantidad":2,"unidad":"cajas"},
      "requiereConfirmacion":true
    }

- "qué productos tengo?"
  → {
      "accion":"conversacion",
      "mensaje":"Te muestro todos tus productos...",
      "confianza":0.9,
      "comandoSugerido":{"accion":"listar_productos"},
      "requiereConfirmacion":false
    }

- "agregá 5 kg de harina"
  → {
      "accion":"conversacion",
      "mensaje":"Voy a agregar 5 kg de harina al stock. ¿Confirmás?",
      "confianza":0.9,
      "comandoSugerido":{"accion":"entrada","productoId":"buscar_id_de_harina","cantidad":5,"unidad":"kg"},
      "requiereConfirmacion":true
    }`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mensaje, productos = [], stockActual = {}, pedidos = [], nombreEmpresa } = body

    if (!mensaje) {
      return NextResponse.json(
        { error: "El mensaje es requerido" },
        { status: 400 }
      )
    }

    // Construir contexto enriquecido
    const productosConStock: ProductoInfo[] = productos.map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      stockMinimo: p.stockMinimo,
      stockActual: stockActual[p.id] ?? 0,
      pedidoId: p.pedidoId,
      pedidoNombre: pedidos.find((ped: any) => ped.id === p.pedidoId)?.nombre,
    }))

    const pedidosInfo: PedidoInfo[] = pedidos.map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      productosCount: productos.filter((prod: any) => prod.pedidoId === p.id).length,
    }))

    const stockBajo = productosConStock.filter(
      p => (p.stockActual ?? 0) < (p.stockMinimo ?? 1)
    )

    const contexto: ContextoChat = {
      productos: productosConStock,
      pedidos: pedidosInfo,
      stockBajo,
      totalProductos: productos.length,
      totalPedidos: pedidos.length,
    }

    // Construir el prompt completo
    const systemPrompt = buildSystemPrompt(contexto, nombreEmpresa)
    
    // Usar fallback inteligente como mecanismo principal (más rápido y confiable)
    // Ollama con phi3:mini es muy lento, así que lo usamos solo si está configurado y responde rápido
    const usarOllama = process.env.USE_OLLAMA === "true"
    
    console.log(`[STOCK-CHAT] Mensaje recibido: "${mensaje}"`)
    console.log(`[STOCK-CHAT] USE_OLLAMA: ${usarOllama}`)
    console.log(`[STOCK-CHAT] Productos disponibles: ${productosConStock.length}`)
    
    if (!usarOllama) {
      // Usar fallback inteligente directamente
      const accionDetectada = detectarAccionPorPalabrasClave(mensaje, productosConStock)
      console.log(`[STOCK-CHAT] Acción detectada (fallback):`, accionDetectada)
      return NextResponse.json({
        accion: accionDetectada,
        modo: "fallback",
      })
    }

    // Si Ollama está habilitado, intentar con timeout corto (10 segundos)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    let ollamaResponse: Response
    try {
      ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: mensaje }
          ],
          stream: false,
          format: "json",
          options: {
            temperature: 0.1,
            num_predict: 150,
          },
        }),
        signal: controller.signal,
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      // Timeout o error - usar fallback
      return NextResponse.json({
        accion: detectarAccionPorPalabrasClave(mensaje, productosConStock),
        modo: "fallback",
      })
    }
    clearTimeout(timeoutId)

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text()
      console.error("Error de Ollama:", errorText)
      return NextResponse.json(
        { 
          error: "Error al conectar con Ollama",
          detalle: `Asegúrate de que Ollama esté corriendo en ${OLLAMA_URL}`,
          ollamaError: errorText
        },
        { status: 503 }
      )
    }

    const data: OllamaChatResponse = await ollamaResponse.json()
    const responseContent = data.message?.content || ""
    
    // Intentar parsear la respuesta JSON de Ollama
    let accionParsed: StockAccionParsed
    try {
      let jsonStr = responseContent.trim()
      
      // Si viene envuelto en markdown code blocks, extraerlo
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      
      // Buscar el objeto JSON
      const jsonStartIndex = jsonStr.indexOf("{")
      const jsonEndIndex = jsonStr.lastIndexOf("}") + 1
      if (jsonStartIndex !== -1 && jsonEndIndex > jsonStartIndex) {
        jsonStr = jsonStr.substring(jsonStartIndex, jsonEndIndex)
      }
      
      const parsed = JSON.parse(jsonStr)
      
      // Normalizar cantidad (siempre positiva)
      let cantidad = parsed.cantidad
      if (typeof cantidad === "number") {
        cantidad = Math.abs(cantidad) // Asegurar que sea positiva
      }
      
      accionParsed = {
        accion: parsed.accion || "conversacion",
        producto: parsed.producto,
        productoId: parsed.productoId,
        cantidad: cantidad,
        unidad: parsed.unidad,
        stockMinimo: parsed.stockMinimo,
        mensaje: parsed.mensaje || "No pude procesar tu mensaje. ¿Podés reformularlo?",
        confianza: typeof parsed.confianza === "number" ? parsed.confianza : 0.5,
        requiereConfirmacion: parsed.requiereConfirmacion || false,
        comandoSugerido: parsed.comandoSugerido ? {
          accion: parsed.comandoSugerido.accion,
          producto: parsed.comandoSugerido.producto,
          productoId: parsed.comandoSugerido.productoId,
          cantidad: typeof parsed.comandoSugerido.cantidad === "number" ? Math.abs(parsed.comandoSugerido.cantidad) : parsed.comandoSugerido.cantidad,
          unidad: parsed.comandoSugerido.unidad,
          stockMinimo: parsed.comandoSugerido.stockMinimo,
          pedidoId: parsed.comandoSugerido.pedidoId,
        } : undefined,
      }
      
      // Validar que si es entrada/salida, la cantidad sea válida
      if ((accionParsed.accion === "entrada" || accionParsed.accion === "salida")) {
        if (!cantidad || cantidad <= 0) {
          console.warn(`[OLLAMA] Cantidad inválida detectada: ${cantidad}, convirtiendo a conversación`)
          accionParsed.accion = "conversacion"
          accionParsed.mensaje = "No pude identificar la cantidad. Por ejemplo: 'saco 2 cajas de X' o 'agregá 5 kg de Y'"
          accionParsed.confianza = 0.3
        } else {
          console.log(`[OLLAMA] Acción válida: ${accionParsed.accion} con cantidad ${cantidad}`)
        }
      }
      
      // Si el mensaje dice "agregó" pero la acción es "salida", corregir
      if (accionParsed.accion === "salida" && /agregó|agregar|sumó|sumar/.test(accionParsed.mensaje || "")) {
        console.warn(`[OLLAMA] Acción incorrecta detectada: salida cuando debería ser entrada, corrigiendo`)
        accionParsed.accion = "entrada"
      }
      
      // VALIDACIÓN CRÍTICA: Si el mensaje original es claramente conversacional, NO ejecutar acciones de stock
      const mensajeOriginalLower = mensaje.toLowerCase().trim()
      const esMensajeConversacional = 
        mensajeOriginalLower.length <= 5 ||
        /^(hola|buenas|hey|hi|ok|okay|si|sí|no|gracias|chau|bye)$/.test(mensajeOriginalLower) ||
        /^(hola|buenas|hey|hi|buen día|buenos días|buenas tardes|buenas noches)/.test(mensajeOriginalLower)
      
      if (esMensajeConversacional && (accionParsed.accion === "entrada" || accionParsed.accion === "salida")) {
        console.warn(`[OLLAMA] Mensaje conversacional detectado pero acción de stock recibida, corrigiendo a conversación`)
        accionParsed.accion = "conversacion"
        accionParsed.mensaje = "¡Hola! Soy tu asistente de inventario. Podés preguntarme sobre tu stock, agregar o quitar productos, crear productos nuevos... ¿En qué te ayudo?"
        accionParsed.confianza = 1.0
        accionParsed.cantidad = undefined
        accionParsed.productoId = undefined
        accionParsed.producto = undefined
      }

      // Si Ollama identificó un producto por nombre pero no el ID, intentar encontrarlo
      if (accionParsed.producto && !accionParsed.productoId) {
        const productoEncontrado = productosConStock.find(p => 
          p.nombre.toLowerCase().includes(accionParsed.producto!.toLowerCase()) ||
          accionParsed.producto!.toLowerCase().includes(p.nombre.toLowerCase())
        )
        if (productoEncontrado) {
          accionParsed.productoId = productoEncontrado.id
        }
      }

      // Si Ollama sugirió un comando, validarlo y mejorarlo usando el fallback
      if (accionParsed.comandoSugerido) {
        console.log(`[OLLAMA] Comando sugerido detectado:`, accionParsed.comandoSugerido)
        
        // Usar el fallback para validar y mejorar el comando sugerido
        const comandoFallback = detectarAccionPorPalabrasClave(mensaje, productosConStock)
        console.log(`[OLLAMA] Comando del fallback:`, comandoFallback)
        
        // Si el fallback encontró el producto pero Ollama no, usar el del fallback
        if (comandoFallback.productoId && !accionParsed.comandoSugerido.productoId) {
          console.log(`[OLLAMA] Usando productoId del fallback: ${comandoFallback.productoId}`)
          accionParsed.comandoSugerido.productoId = comandoFallback.productoId
        }
        
        // Si Ollama tiene producto por nombre pero no ID, buscar el ID
        if (accionParsed.comandoSugerido.producto && !accionParsed.comandoSugerido.productoId) {
          const productoEncontrado = productosConStock.find(p => 
            p.nombre.toLowerCase().includes(accionParsed.comandoSugerido!.producto!.toLowerCase()) ||
            accionParsed.comandoSugerido!.producto!.toLowerCase().includes(p.nombre.toLowerCase())
          )
          if (productoEncontrado) {
            console.log(`[OLLAMA] Encontrado producto por nombre: ${productoEncontrado.id}`)
            accionParsed.comandoSugerido.productoId = productoEncontrado.id
          }
        }
        
        // Si el fallback encontró cantidad pero Ollama no, usar la del fallback
        if (comandoFallback.cantidad && !accionParsed.comandoSugerido.cantidad) {
          console.log(`[OLLAMA] Usando cantidad del fallback: ${comandoFallback.cantidad}`)
          accionParsed.comandoSugerido.cantidad = comandoFallback.cantidad
        }
        
        // Si el fallback encontró unidad pero Ollama no, usar la del fallback
        if (comandoFallback.unidad && !accionParsed.comandoSugerido.unidad) {
          console.log(`[OLLAMA] Usando unidad del fallback: ${comandoFallback.unidad}`)
          accionParsed.comandoSugerido.unidad = comandoFallback.unidad
        }
        
        // Si el fallback tiene mejor confianza y encontró el producto, usar su acción
        if (comandoFallback.confianza > 0.7 && comandoFallback.productoId && 
            comandoFallback.accion === accionParsed.comandoSugerido.accion) {
          console.log(`[OLLAMA] Mejorando comando sugerido con datos del fallback`)
          accionParsed.comandoSugerido = {
            accion: comandoFallback.accion,
            productoId: comandoFallback.productoId,
            cantidad: comandoFallback.cantidad,
            unidad: comandoFallback.unidad,
            producto: comandoFallback.producto,
          }
        }
        
        console.log(`[OLLAMA] Comando sugerido final:`, accionParsed.comandoSugerido)
      }

    } catch (parseError) {
      console.error("[OLLAMA] Error parseando respuesta de Ollama:", responseContent)
      console.error("[OLLAMA] Error:", parseError)
      
      // Fallback inteligente basado en palabras clave del mensaje original
      console.log("[OLLAMA] Usando fallback inteligente")
      accionParsed = detectarAccionPorPalabrasClave(mensaje, productosConStock)
    }
    
    console.log(`[OLLAMA] Acción final parseada:`, accionParsed)

    const respuesta = {
      accion: accionParsed,
      rawResponse: responseContent,
      modo: usarOllama ? "ollama" : "fallback",
      contexto: {
        totalProductos: contexto.totalProductos,
        productosStockBajo: stockBajo.length,
      }
    }
    
    console.log(`[STOCK-CHAT] Respuesta final:`, JSON.stringify(respuesta, null, 2))
    
    return NextResponse.json(respuesta)
  } catch (error) {
    console.error("Error en stock-chat:", error)
    return NextResponse.json(
      { 
        error: "Error interno del servidor",
        detalle: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    )
  }
}

// Endpoint GET para verificar que Ollama está disponible
export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
    })

    if (!response.ok) {
      return NextResponse.json(
        { 
          status: "error",
          message: "Ollama no está respondiendo",
          url: OLLAMA_URL
        },
        { status: 503 }
      )
    }

    const data = await response.json()
    const modelosDisponibles = data.models?.map((m: any) => m.name) || []
    const modeloConfigurado = OLLAMA_MODEL
    const modeloDisponible = modelosDisponibles.some((m: string) => 
      m.startsWith(modeloConfigurado) || m.includes(modeloConfigurado)
    )

    return NextResponse.json({
      status: "ok",
      url: OLLAMA_URL,
      modeloConfigurado,
      modeloDisponible,
      modelosDisponibles,
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: "error",
        message: "No se puede conectar con Ollama",
        url: OLLAMA_URL,
        error: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 503 }
    )
  }
}
