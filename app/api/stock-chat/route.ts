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
      return {
        accion: "consulta_stock",
        producto: productoEncontrado.nombre,
        productoId: productoEncontrado.id,
        mensaje: `Consultando stock de ${productoEncontrado.nombre}...`,
        confianza: 0.9,
      }
    } else {
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
      return { accion: "listar_pedidos", mensaje: "Mostrando pedidos...", confianza: 0.8 }
    }
    return { accion: "listar_productos", mensaje: "Mostrando productos...", confianza: 0.8 }
  }
  
  // Detectar stock bajo
  if (/falta|bajo|mínimo|pedir|reponer|qué me falta/.test(msgLower)) {
    return { accion: "stock_bajo", mensaje: "Verificando stock bajo...", confianza: 0.8 }
  }
  
  // Detectar ayuda
  if (/ayuda|help|qué puedo|cómo funciona/.test(msgLower)) {
    return { accion: "ayuda", mensaje: "Mostrando ayuda...", confianza: 0.9 }
  }
  
  // Detectar saludo
  if (/^(hola|buenas|hey|hi)/.test(msgLower)) {
    return { 
      accion: "conversacion", 
      mensaje: "¡Hola! Soy tu asistente de inventario. Podés preguntarme sobre tu stock, agregar o quitar productos... ¿En qué te ayudo?", 
      confianza: 0.9 
    }
  }
  
  // Detectar entrada/salida con cantidad
  const matchCantidad = msgLower.match(/(\d+)\s*(cajas?|kg|kilos?|unidades?|u|botellas?|packs?)?/)
  const esSalida = /saco|sacá|quito|uso|usé|gasto|consumo|llevé/.test(msgLower)
  const esEntrada = /agrego|agregá|pongo|sumo|llegó|llegaron|recibí|meto|agrega|agregar/.test(msgLower)
  
  if (matchCantidad && (esSalida || esEntrada)) {
    const cantidad = parseInt(matchCantidad[1])
    const unidad = matchCantidad[2] || "u"
    
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
  
  // Detectar entrada/salida sin cantidad específica (solo "agrega X")
  if ((esEntrada || esSalida) && !matchCantidad) {
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
    return {
      accion: "crear_producto",
      mensaje: "Para crear un producto decime: nombre, unidad (ej: cajas, kg) y stock mínimo.",
      confianza: 0.7,
      requiereConfirmacion: true,
    }
  }
  
  // Default
  return {
    accion: "conversacion",
    mensaje: "No estoy seguro de qué querés hacer. Probá con: 'mostrar productos', 'qué me falta pedir', o 'saco 2 cajas de X'.",
    confianza: 0.4,
  }
}

// Prompt simplificado para modelos pequeños
function buildSystemPrompt(contexto: ContextoChat) {
  const { productos, pedidos, totalProductos, totalPedidos } = contexto
  
  const listaProductos = productos.slice(0, 10).map(p => 
    `${p.nombre}(ID:${p.id},stock:${p.stockActual ?? 0})`
  ).join(", ") || "ninguno"

  return `Eres un asistente de inventario. Responde SOLO con JSON válido.

PRODUCTOS: ${listaProductos}
TOTAL: ${totalProductos} productos, ${totalPedidos} pedidos

ACCIONES VÁLIDAS:
- listar_productos: mostrar productos
- listar_pedidos: mostrar pedidos  
- entrada: agregar stock (necesita productoId, cantidad)
- salida: quitar stock (necesita productoId, cantidad)
- crear_producto: crear nuevo (necesita producto, unidad, stockMinimo)
- stock_bajo: productos con poco stock
- ayuda: mostrar ayuda
- conversacion: respuesta general

RESPONDE SOLO JSON:
{"accion":"X","producto":"Y","productoId":"Z","cantidad":N,"mensaje":"texto","confianza":0.9}

Si no entendés, usa: {"accion":"conversacion","mensaje":"No entendí, ¿podés reformular?","confianza":0.5}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mensaje, productos = [], stockActual = {}, pedidos = [] } = body

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
    const systemPrompt = buildSystemPrompt(contexto)
    
    // Usar fallback inteligente como mecanismo principal (más rápido y confiable)
    // Ollama con phi3:mini es muy lento, así que lo usamos solo si está configurado y responde rápido
    const usarOllama = process.env.USE_OLLAMA === "true"
    
    if (!usarOllama) {
      // Usar fallback inteligente directamente
      return NextResponse.json({
        accion: detectarAccionPorPalabrasClave(mensaje, productosConStock),
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
      
      accionParsed = {
        accion: parsed.accion || "conversacion",
        producto: parsed.producto,
        productoId: parsed.productoId,
        cantidad: parsed.cantidad,
        unidad: parsed.unidad,
        stockMinimo: parsed.stockMinimo,
        mensaje: parsed.mensaje || "No pude procesar tu mensaje. ¿Podés reformularlo?",
        confianza: typeof parsed.confianza === "number" ? parsed.confianza : 0.5,
        requiereConfirmacion: parsed.requiereConfirmacion || false,
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

    } catch (parseError) {
      console.error("Error parseando respuesta de Ollama:", responseContent)
      
      // Fallback inteligente basado en palabras clave del mensaje original
      accionParsed = detectarAccionPorPalabrasClave(mensaje, productosConStock)
    }

    return NextResponse.json({
      accion: accionParsed,
      rawResponse: responseContent,
      contexto: {
        totalProductos: contexto.totalProductos,
        productosStockBajo: stockBajo.length,
      }
    })
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
