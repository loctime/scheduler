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
      
      // Preparar datos - Filtrar productos que tengan pedidoId válido
      const pedidosIds = new Set(pedidos.map((p: any) => p.id))
      const productosCompletos = (productos as Array<{
        id: string
        nombre: string
        unidad?: string
        pedidoId?: string
        stockMinimo?: number
      }>).filter(p => {
        // Solo incluir productos que tengan pedidoId y que ese pedido exista
        if (!p.pedidoId) return false
        return pedidosIds.has(p.pedidoId)
      })
      
      // ==================== COMANDO: "pedido nombrepedido" ====================
      if (msgLower.startsWith("pedido ")) {
        const nombrePedido = msgNormalizado.substring(7).trim() // Remover "pedido "
        
        if (!nombrePedido) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: "Escribí el nombre del pedido. Por ejemplo: 'pedido Verdulería'",
              confianza: 0.5,
            }
          })
        }
        
        // Buscar pedido por nombre
        const pedidoEncontrado = pedidos.find((p: any) => 
          p.nombre.toLowerCase().includes(nombrePedido.toLowerCase())
        )
        
        if (!pedidoEncontrado) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: `No encontré el pedido "${nombrePedido}". Escribí "pedido" seguido del nombre del pedido.`,
              confianza: 0.5,
            }
          })
        }
        
        // Filtrar productos de ese pedido que necesitan pedirse
        const productosDelPedido = productosCompletos.filter(p => p.pedidoId === pedidoEncontrado.id)
        const productosAPedir = productosDelPedido.filter(p => {
          const stock = stockActual[p.id] ?? 0
          const minimo = p.stockMinimo || 0
          return stock < minimo
        })
        
        if (productosAPedir.length === 0) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: `✅ El pedido "${pedidoEncontrado.nombre}" está completo. Todos los productos tienen stock suficiente.`,
              confianza: 0.9,
            }
          })
        }
        
        // Generar lista de pedido
        const formatoSalida = pedidoEncontrado.formatoSalida || "{nombre} ({cantidad})"
        const mensajePrevio = pedidoEncontrado.mensajePrevio || `📦 ${pedidoEncontrado.nombre}`
        
        const lineas = productosAPedir.map(p => {
          const stock = stockActual[p.id] ?? 0
          const minimo = p.stockMinimo || 0
          const cantidadAPedir = minimo - stock
          
          let texto = formatoSalida
          texto = texto.replace(/{nombre}/g, p.nombre)
          texto = texto.replace(/{cantidad}/g, cantidadAPedir.toString())
          texto = texto.replace(/{unidad}/g, p.unidad || "")
          return texto.trim()
        })
        
        const respuesta = `${mensajePrevio}\n\n${lineas.join("\n")}\n\nTotal: ${productosAPedir.length} productos`
        
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: respuesta,
            confianza: 0.9,
          }
        })
      }
      
      // ==================== COMANDO: "stock" (todo) ====================
      if (msgLower === "stock" || msgLower === "stock todo" || msgLower === "stock todos") {
        if (productosCompletos.length === 0) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: "No tenés productos en tu inventario todavía. Agregalos desde la sección Pedidos.",
              confianza: 0.9,
            }
          })
        }
        
        // Agrupar por pedido (solo productos con pedidoId válido)
        const productosPorPedido = new Map<string, typeof productosCompletos>()
        productosCompletos.forEach(p => {
          // Solo agrupar si tiene pedidoId válido
          if (!p.pedidoId) return
          const pedidoId = p.pedidoId
          if (!productosPorPedido.has(pedidoId)) {
            productosPorPedido.set(pedidoId, [])
          }
          productosPorPedido.get(pedidoId)!.push(p)
        })
        
        // Generar lista agrupada
        const secciones: string[] = []
        productosPorPedido.forEach((prods, pedidoId) => {
          const pedido = pedidos.find((p: any) => p.id === pedidoId)
          // Solo mostrar si el pedido existe (ya filtramos antes, pero por seguridad)
          if (!pedido) return
          
          const nombrePedido = pedido.nombre
          
          const lista = prods
            .sort((a, b) => (stockActual[a.id] ?? 0) - (stockActual[b.id] ?? 0))
            .map(p => {
              const stock = stockActual[p.id] ?? 0
              const unidad = p.unidad || "u"
              const estado = stock < (p.stockMinimo || 0) ? "⚠️" : "✅"
              return `${estado} ${p.nombre}: ${stock} ${unidad}`
            })
            .join("\n")
          
          secciones.push(`**${nombrePedido}** (${prods.length} productos):\n${lista}`)
        })
        
        const totalProductos = productosCompletos.length
        const respuesta = `📦 **Stock General**\n\n${secciones.join("\n\n")}\n\nTotal: ${totalProductos} productos`
        
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: respuesta,
            confianza: 0.9,
          }
        })
      }
      
      // ==================== COMANDO: "stock nombrepedido" ====================
      if (msgLower.startsWith("stock ")) {
        const resto = msgNormalizado.substring(6).trim() // Remover "stock "
        
        if (!resto) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: "Escribí 'stock' para ver todo, 'stock nombrepedido' para ver un pedido, o 'stock nombreproducto' para ver un producto.",
              confianza: 0.5,
            }
          })
        }
        
        // Buscar si es un pedido
        const pedidoEncontrado = pedidos.find((p: any) => 
          p.nombre.toLowerCase().includes(resto.toLowerCase())
        )
        
        if (pedidoEncontrado) {
          // Es un pedido
          const productosDelPedido = productosCompletos
            .filter(p => p.pedidoId === pedidoEncontrado.id)
            .sort((a, b) => (stockActual[a.id] ?? 0) - (stockActual[b.id] ?? 0))
          
          if (productosDelPedido.length === 0) {
            return NextResponse.json({
              accion: {
                accion: "conversacion",
                mensaje: `El pedido "${pedidoEncontrado.nombre}" no tiene productos cargados.`,
                confianza: 0.9,
              }
            })
          }
          
          const lista = productosDelPedido.map(p => {
            const stock = stockActual[p.id] ?? 0
            const unidad = p.unidad || "u"
            const estado = stock < (p.stockMinimo || 0) ? "⚠️" : "✅"
            return `${estado} ${p.nombre}: ${stock} ${unidad}`
          }).join("\n")
          
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: `📦 **Stock de ${pedidoEncontrado.nombre}**\n\n${lista}\n\nTotal: ${productosDelPedido.length} productos`,
              confianza: 0.9,
            }
          })
        }
        
        // Si no es pedido, buscar como producto
        const palabras = resto.split(/\s+/).filter((p: string) => p.length > 1)
        if (palabras.length === 0) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: "No encontré ese pedido ni producto. Escribí 'stock' para ver todo el inventario.",
              confianza: 0.5,
            }
          })
        }
        
        // Buscar producto
        const textoBusqueda = palabras.join(" ").toLowerCase()
        let productoEncontrado = productosCompletos.find(p => 
          p.nombre.toLowerCase() === textoBusqueda
        )
        
        if (!productoEncontrado) {
          // Buscar productos que contengan todas las palabras
          const productosQueContienen = productosCompletos.filter(p => {
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
        
        if (!productoEncontrado) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: `No encontré "${resto}" en tu inventario. Escribí "stock" para ver todos los productos.`,
              confianza: 0.5,
            }
          })
        }
        
        // Mostrar stock del producto
        const stock = stockActual[productoEncontrado.id] ?? 0
        const unidad = productoEncontrado.unidad || "u"
        const minimo = productoEncontrado.stockMinimo || 0
        const estado = stock < minimo ? "⚠️" : "✅"
        const pedido = pedidos.find((p: any) => p.id === productoEncontrado!.pedidoId)
        
        let respuesta = `📦 **${productoEncontrado.nombre}**: ${stock} ${unidad}`
        if (pedido) {
          respuesta += `\n📋 Pedido: ${pedido.nombre}`
        }
        if (minimo > 0) {
          respuesta += `\n${estado} Mínimo: ${minimo} ${unidad}`
        }
        
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: respuesta,
            confianza: 0.9,
          }
        })
      }
      
      // ==================== MENSAJE NO RECONOCIDO ====================
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: "Comandos disponibles:\n\n• **stock** - Ver todo el inventario\n• **stock nombrepedido** - Ver stock de un pedido\n• **stock nombreproducto** - Ver stock de un producto\n• **pedido nombrepedido** - Generar pedido de un proveedor",
          confianza: 0.5,
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

// Endpoint GET para verificar Ollama (Opcional - la app funciona sin Ollama)
export async function GET() {
  try {
    // Determinar URL de Ollama
    const isDevelopment = process.env.NODE_ENV === "development"
    const OLLAMA_URL = process.env.OLLAMA_URL || (isDevelopment ? "http://localhost:11434" : null)
    
    // Si no hay URL configurada en producción, devolver estado "ok" sin Ollama
    if (!OLLAMA_URL) {
      return NextResponse.json({
        status: "ok",
        ollamaDisponible: false,
        message: "Ollama no configurado (la app funciona sin Ollama)",
        url: null,
        modelosDisponibles: [],
      })
    }
    
    // Intentar conectar con Ollama (con timeout corto)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 segundos timeout
    
    try {
      const response = await fetch(`${OLLAMA_URL}/api/tags`, {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        return NextResponse.json({
          status: "ok",
          ollamaDisponible: false,
          message: "Ollama no está respondiendo (la app funciona sin Ollama)",
          url: OLLAMA_URL,
          modelosDisponibles: [],
        })
      }
      
      const data = await response.json()
      const modelosDisponibles = data.models?.map((m: any) => m.name) || []
      
      return NextResponse.json({
        status: "ok",
        ollamaDisponible: true,
        message: "Ollama conectado",
        url: OLLAMA_URL,
        modelosDisponibles,
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      // Si es un abort (timeout) o error de conexión, devolver ok sin Ollama
      return NextResponse.json({
        status: "ok",
        ollamaDisponible: false,
        message: "Ollama no disponible (la app funciona sin Ollama)",
        url: OLLAMA_URL,
        modelosDisponibles: [],
      })
    }
  } catch (error) {
    // En caso de cualquier error, devolver ok sin Ollama (no bloquear la app)
    return NextResponse.json({
      status: "ok",
      ollamaDisponible: false,
      message: "Ollama no disponible (la app funciona sin Ollama)",
      url: null,
      modelosDisponibles: [],
    })
  }
}
