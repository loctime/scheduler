import { NextRequest, NextResponse } from "next/server"
import type { StockAccionParsed } from "@/lib/types"

interface ProductoInfo {
  id: string
  nombre: string
  unidad?: string
  stockActual?: number
}

// ==================== API ROUTE SIMPLIFICADA ====================
// Solo para agregar/quitar stock con modos

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mensaje, modo, productos = [], stockActual = {}, pedidos = [] } = body

    if (!mensaje) {
      return NextResponse.json(
        { error: "El mensaje es requerido" },
        { status: 400 }
      )
    }
    
    // Validar que haya modo
    if (!modo || (modo !== "ingreso" && modo !== "egreso" && modo !== "pregunta")) {
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: "Seleccioná un modo primero: 'Ingreso' para agregar stock, 'Egreso' para quitar stock, o 'Pregunta' para consultar stock.",
          confianza: 0.5,
        }
      })
    }
    
    // ==================== MODO PREGUNTA ====================
    if (modo === "pregunta") {
      const msgNormalizado = mensaje.replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
      const msgLower = msgNormalizado.toLowerCase()
      
      // Construir lista de productos con stock
      console.log(`[STOCK-CHAT] Modo pregunta - productos recibidos:`, productos.length)
      console.log(`[STOCK-CHAT] Modo pregunta - stockActual recibido:`, Object.keys(stockActual).length, "productos")
      console.log(`[STOCK-CHAT] Modo pregunta - muestra de stockActual:`, Object.entries(stockActual).slice(0, 5))
      
      const productosConStock: ProductoInfo[] = productos.map((p: { id: string; nombre: string; unidad?: string }) => {
        const stock = stockActual[p.id] ?? 0
        console.log(`[STOCK-CHAT] Producto: ${p.nombre} (ID: ${p.id}) -> Stock: ${stock}`)
        return {
          id: p.id,
          nombre: p.nombre,
          unidad: p.unidad,
          stockActual: stock,
        }
      })
      
      // Si el mensaje es para generar un pedido
      if (/^(pedido|generar pedido|qué me falta pedir|qué falta pedir|hacer pedido|crear pedido|armar pedido)/.test(msgLower)) {
        if (productos.length === 0) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: "No tenés productos en tu inventario todavía. Agregalos desde la sección Pedidos.",
              confianza: 0.9,
            }
          })
        }
        
        // Calcular qué productos necesitan pedirse (stock actual < stock mínimo)
        const calcularPedido = (stockMinimo: number, stockActualValue: number | undefined): number => {
          const actual = stockActualValue ?? 0
          return Math.max(0, stockMinimo - actual)
        }
        
        // Agrupar productos por pedido - SOLO productos que existen en el array productos
        const productosPorPedido = new Map<string, Array<{ producto: ProductoInfo; cantidad: number; stockMinimo: number }>>()
        
        // Iterar sobre productos existentes (no sobre productosConStock que puede tener eliminados)
        productos.forEach((productoCompleto: any) => {
          // Verificar que el producto tenga stockMinimo configurado
          const stockMinimo = productoCompleto.stockMinimo || 0
          if (stockMinimo <= 0) return // Si no tiene stock mínimo, no se puede calcular pedido
          
          const stockActualValue = stockActual[productoCompleto.id] ?? 0
          const cantidadAPedir = calcularPedido(stockMinimo, stockActualValue)
          
          if (cantidadAPedir > 0) {
            const pedidoId = productoCompleto.pedidoId
            if (!pedidoId) return // Si no tiene pedidoId, saltar
            
            // Verificar que el pedido exista
            const pedidoExiste = pedidos.some((p: any) => p.id === pedidoId)
            if (!pedidoExiste) return // Si el pedido no existe, saltar
            
            if (!productosPorPedido.has(pedidoId)) {
              productosPorPedido.set(pedidoId, [])
            }
            
            productosPorPedido.get(pedidoId)!.push({
              producto: {
                id: productoCompleto.id,
                nombre: productoCompleto.nombre,
                unidad: productoCompleto.unidad,
                stockActual: stockActualValue,
              },
              cantidad: cantidadAPedir,
              stockMinimo,
            })
          }
        })
        
        if (productosPorPedido.size === 0) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: "✅ ¡Excelente! Todos tus productos tienen stock suficiente. No necesitás hacer ningún pedido.",
              confianza: 0.9,
            }
          })
        }
        
        // Generar texto del pedido para cada grupo
        const pedidosTexto: string[] = []
        
        productosPorPedido.forEach((productosList, pedidoId) => {
          // Buscar el pedido para obtener formato y mensaje previo
          const pedido = pedidos.find((p: any) => p.id === pedidoId)
          const formatoSalida = pedido?.formatoSalida || "{nombre} ({cantidad})"
          const mensajePrevio = pedido?.mensajePrevio || (pedido ? `📦 ${pedido.nombre}` : "📦 Pedido")
          
          const lineas = productosList.map(({ producto, cantidad }) => {
            let texto = formatoSalida
            texto = texto.replace(/{nombre}/g, producto.nombre)
            texto = texto.replace(/{cantidad}/g, cantidad.toString())
            texto = texto.replace(/{unidad}/g, producto.unidad || "")
            return texto.trim()
          })
          
          const pedidoTexto = `${mensajePrevio}\n\n${lineas.join("\n")}\n\nTotal: ${productosList.length} productos`
          pedidosTexto.push(pedidoTexto)
        })
        
        const respuestaCompleta = pedidosTexto.length === 1
          ? pedidosTexto[0]
          : `📋 **Pedidos a realizar:**\n\n${pedidosTexto.join("\n\n---\n\n")}`
        
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: respuestaCompleta,
            confianza: 0.9,
          }
        })
      }
      
      // Si el mensaje es "todos", "todos los productos", "mostrar todos", etc.
      if (/^(todos|todos los|mostrar todos|listar todos|ver todos|stock completo)/.test(msgLower)) {
        if (productosConStock.length === 0) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: "No tenés productos en tu inventario todavía. Agregalos desde la sección Pedidos.",
              confianza: 0.9,
            }
          })
        }
        
        // Ordenar por stock (menor a mayor para destacar los que necesitan atención)
        const productosOrdenados = [...productosConStock].sort((a, b) => 
          (a.stockActual || 0) - (b.stockActual || 0)
        )
        
        const listaStock = productosOrdenados.map(p => {
          // Obtener stock directamente de stockActual para asegurar que esté actualizado
          const stock = stockActual[p.id] ?? 0
          const unidad = p.unidad || "u"
          console.log(`[STOCK-CHAT] Listando producto: ${p.nombre} (ID: ${p.id}) -> Stock: ${stock} (desde stockActual) vs ${p.stockActual} (desde objeto)`)
          return `• ${p.nombre}: ${stock} ${unidad}`
        }).join("\n")
        
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: `📦 **Stock actual de todos los productos:**\n\n${listaStock}\n\nTotal: ${productosConStock.length} productos`,
            confianza: 0.9,
          }
        })
      }
      
      // Buscar producto específico
      const palabras = msgNormalizado.split(/\s+/).filter((p: string) => !/^\d+$/.test(p) && p.length > 1)
      
      if (palabras.length === 0) {
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: "¿De qué producto querés consultar el stock? Escribí el nombre del producto o 'todos' para ver todo el inventario.",
            confianza: 0.5,
          }
        })
      }
      
      // Buscar producto (usar la misma lógica que en ingreso/egreso)
      const textoBusqueda = palabras.join(" ").toLowerCase()
      let productoEncontrado: ProductoInfo | null = null
      
      // Coincidencia exacta
      productoEncontrado = productosConStock.find(p => 
        p.nombre.toLowerCase() === textoBusqueda
      ) || null
      
      if (!productoEncontrado) {
        // Buscar productos que contengan todas las palabras
        const productosQueContienen = productosConStock.filter(producto => {
          const nombreLower = producto.nombre.toLowerCase()
          return palabras.every((pal: string) => {
            const palLower = pal.toLowerCase()
            const regex = new RegExp(`\\b${palLower}\\b`, "i")
            return regex.test(nombreLower) || nombreLower.includes(palLower)
          })
        })
        
        if (productosQueContienen.length === 1) {
          productoEncontrado = productosQueContienen[0]
        } else if (productosQueContienen.length > 1) {
          productoEncontrado = productosQueContienen.reduce((prev, curr) => 
            curr.nombre.length < prev.nombre.length ? curr : prev
          )
        } else {
          // Buscar por inicio
          const productosQueEmpiezan = productosConStock.filter(producto => {
            const nombreLower = producto.nombre.toLowerCase()
            return palabras.some((pal: string) => {
              const palLower = pal.toLowerCase()
              return nombreLower.startsWith(palLower) || nombreLower.includes(` ${palLower}`)
            })
          })
          
          if (productosQueEmpiezan.length === 1) {
            productoEncontrado = productosQueEmpiezan[0]
          } else if (productosQueEmpiezan.length > 1) {
            productoEncontrado = productosQueEmpiezan.reduce((prev, curr) => 
              curr.nombre.length < prev.nombre.length ? curr : prev
            )
          }
        }
      }
      
      if (!productoEncontrado) {
        const nombreMencionado = palabras.join(" ")
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: `No encontré "${nombreMencionado}" en tu inventario. Escribí "todos" para ver todos los productos o el nombre exacto del producto.`,
            confianza: 0.5,
          }
        })
      }
      
      // Mostrar stock del producto encontrado (obtener directamente de stockActual para asegurar que esté actualizado)
      const stock = stockActual[productoEncontrado.id] ?? 0
      const unidad = productoEncontrado.unidad || "u"
      
      console.log(`[STOCK-CHAT] Producto encontrado: ${productoEncontrado.nombre} (ID: ${productoEncontrado.id})`)
      console.log(`[STOCK-CHAT] Stock desde stockActual[${productoEncontrado.id}]:`, stock)
      console.log(`[STOCK-CHAT] Stock desde productoEncontrado.stockActual:`, productoEncontrado.stockActual)
      
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: `📦 **${productoEncontrado.nombre}**: ${stock} ${unidad}`,
          confianza: 0.9,
        }
      })
    }
    
    // Normalizar mensaje
    const msgNormalizado = mensaje.replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
    const msgLower = msgNormalizado.toLowerCase()
    
    console.log(`[STOCK-CHAT] Mensaje: "${msgNormalizado}"`)
    console.log(`[STOCK-CHAT] Modo: ${modo}`)
    
    // Construir lista de productos
    const productosConStock: ProductoInfo[] = productos.map((p: { id: string; nombre: string; unidad?: string }) => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      stockActual: stockActual[p.id] ?? 0,
    }))
    
    // Extraer cantidad (número)
    const matchCantidad = msgNormalizado.match(/(\d+)/)
    const cantidad = matchCantidad ? parseInt(matchCantidad[1]) : null
    
    if (!cantidad || cantidad <= 0) {
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: "Necesito saber la cantidad. Por ejemplo: 'leche 20' o 'papa 10'.",
          confianza: 0.5,
        }
      })
    }
    
    // Buscar producto por nombre (buscar palabras que no sean números)
    const palabras = msgNormalizado.split(/\s+/).filter((p: string) => !/^\d+$/.test(p) && p.length > 1)
    
    if (palabras.length === 0) {
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: "No identifiqué el nombre del producto. Por ejemplo: 'leche 20' o 'papa 10'.",
          confianza: 0.5,
        }
      })
    }
    
    // Buscar producto en la lista
    let productoEncontrado: ProductoInfo | null = null
    const textoBusqueda = palabras.join(" ").toLowerCase()
    
    // Primero: buscar coincidencia exacta (ignorando mayúsculas)
    productoEncontrado = productosConStock.find(p => 
      p.nombre.toLowerCase() === textoBusqueda
    ) || null
    
    if (productoEncontrado) {
      console.log(`[STOCK-CHAT] Coincidencia exacta encontrada: ${productoEncontrado.nombre}`)
    } else {
      // Segundo: buscar si el nombre del producto contiene todas las palabras del mensaje
      const productosQueContienen = productosConStock.filter(producto => {
        const nombreLower = producto.nombre.toLowerCase()
        // Verificar que todas las palabras del mensaje estén en el nombre del producto
        return palabras.every((pal: string) => {
          const palLower = pal.toLowerCase()
          // Buscar palabra completa (no parcial dentro de otra palabra)
          const regex = new RegExp(`\\b${palLower}\\b`, "i")
          return regex.test(nombreLower) || nombreLower.includes(palLower)
        })
      })
      
      if (productosQueContienen.length === 1) {
        productoEncontrado = productosQueContienen[0]
        console.log(`[STOCK-CHAT] Coincidencia única encontrada: ${productoEncontrado.nombre}`)
      } else if (productosQueContienen.length > 1) {
        // Si hay múltiples coincidencias, buscar la más corta (probablemente la más específica)
        productoEncontrado = productosQueContienen.reduce((prev, curr) => 
          curr.nombre.length < prev.nombre.length ? curr : prev
        )
        console.log(`[STOCK-CHAT] Múltiples coincidencias, eligiendo la más corta: ${productoEncontrado.nombre}`)
      } else {
        // Tercero: buscar si alguna palabra del mensaje está al inicio del nombre del producto
        const productosQueEmpiezan = productosConStock.filter(producto => {
          const nombreLower = producto.nombre.toLowerCase()
          return palabras.some((pal: string) => {
            const palLower = pal.toLowerCase()
            return nombreLower.startsWith(palLower) || nombreLower.includes(` ${palLower}`)
          })
        })
        
        if (productosQueEmpiezan.length === 1) {
          productoEncontrado = productosQueEmpiezan[0]
          console.log(`[STOCK-CHAT] Coincidencia por inicio encontrada: ${productoEncontrado.nombre}`)
        } else if (productosQueEmpiezan.length > 1) {
          // Si hay múltiples, buscar la más corta
          productoEncontrado = productosQueEmpiezan.reduce((prev, curr) => 
            curr.nombre.length < prev.nombre.length ? curr : prev
          )
          console.log(`[STOCK-CHAT] Múltiples coincidencias por inicio, eligiendo la más corta: ${productoEncontrado.nombre}`)
        }
      }
    }
    
    if (!productoEncontrado) {
      const nombreMencionado = palabras.join(" ")
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: `No encontré "${nombreMencionado}" en tu inventario. ¿Podés escribirlo de nuevo o agregarlo desde la sección Pedidos?`,
          confianza: 0.5,
        }
      })
    }
    
    // Todo bien, agregar a lista acumulada (no confirmar inmediatamente)
    const accion = modo === "ingreso" ? "entrada" : "salida"
    const verbo = modo === "ingreso" ? "agregar" : "quitar"
    
    console.log(`[STOCK-CHAT] Producto encontrado: ${productoEncontrado.nombre} (${productoEncontrado.id})`)
    console.log(`[STOCK-CHAT] Cantidad: ${cantidad}`)
    console.log(`[STOCK-CHAT] Acción: ${accion}`)
    
    // Retornar información del producto para acumular
    return NextResponse.json({
      accion: {
        accion: "conversacion",
        mensaje: `✅ Agregado a la lista: ${cantidad} ${productoEncontrado.unidad || "unidades"} de ${productoEncontrado.nombre}. Podés seguir agregando productos o escribir "confirmar" para aplicar todos los cambios.`,
        confianza: 0.9,
        productoAcumulado: {
          accion,
          productoId: productoEncontrado.id,
          producto: productoEncontrado.nombre,
          cantidad,
          unidad: productoEncontrado.unidad,
        },
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

// Endpoint GET para verificar Ollama (mantener por compatibilidad)
export async function GET() {
  try {
    const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
    const response = await fetch(`${OLLAMA_URL}/api/tags`)
    
    if (!response.ok) {
      return NextResponse.json(
        { status: "error", message: "Ollama no está respondiendo", url: OLLAMA_URL },
        { status: 503 }
      )
    }
    
    const data = await response.json()
    const modelosDisponibles = data.models?.map((m: any) => m.name) || []
    
    return NextResponse.json({
      status: "ok",
      url: OLLAMA_URL,
      modelosDisponibles,
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: "error",
        message: "No se puede conectar con Ollama",
        error: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 503 }
    )
  }
}
