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
    const { mensaje, modo, productos = [], stockActual = {} } = body

    if (!mensaje) {
      return NextResponse.json(
        { error: "El mensaje es requerido" },
        { status: 400 }
      )
    }
    
    // Validar que haya modo
    if (!modo || (modo !== "ingreso" && modo !== "egreso")) {
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: "Seleccioná un modo primero: 'Ingreso' para agregar stock o 'Egreso' para quitar stock.",
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
    
    // Todo bien, sugerir comando según el modo
    const accion = modo === "ingreso" ? "entrada" : "salida"
    const verbo = modo === "ingreso" ? "agregar" : "quitar"
    
    console.log(`[STOCK-CHAT] Producto encontrado: ${productoEncontrado.nombre} (${productoEncontrado.id})`)
    console.log(`[STOCK-CHAT] Cantidad: ${cantidad}`)
    console.log(`[STOCK-CHAT] Acción: ${accion}`)
    
    return NextResponse.json({
      accion: {
        accion: "conversacion",
        mensaje: `¿Confirmás ${verbo} ${cantidad} ${productoEncontrado.unidad || "unidades"} de ${productoEncontrado.nombre}?`,
        confianza: 0.9,
        comandoSugerido: {
          accion,
          productoId: productoEncontrado.id,
          producto: productoEncontrado.nombre,
          cantidad,
          unidad: productoEncontrado.unidad,
        },
        requiereConfirmacion: true,
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
