import { NextRequest, NextResponse } from "next/server"

interface ProductoInfo {
  id: string
  nombre: string
  unidad?: string
  stockActual?: number
  pedidoId?: string
}

// ==================== API ROUTE SIMPLIFICADA ====================
// Solo para agregar/quitar stock con modos

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mensaje, modo, pedidoSeleccionado, productos = [], stockActual = {}, pedidos = [] } = body

    if (!mensaje) {
      return NextResponse.json(
        { error: "El mensaje es requerido" },
        { status: 400 }
      )
    }
    
    // null o undefined = modo pregunta (por defecto)
    const modoActual = modo || "pregunta"
    
    // ==================== MODO PREGUNTA ====================
    if (modoActual === "pregunta") {
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
      
      // ==================== FUNCIÓN AUXILIAR: Buscar producto inteligente ====================
      const buscarProducto = (texto: string): { producto: any, confianza: number, sugerencias?: string[] } | null => {
        const palabras = texto.split(/\s+/).filter((p: string) => p.length > 1)
        if (palabras.length === 0) return null
        
        const textoBusqueda = palabras.join(" ").toLowerCase()
        
        // 1. Búsqueda exacta
        let productoEncontrado = productosCompletos.find(p => 
          p.nombre.toLowerCase() === textoBusqueda
        )
        if (productoEncontrado) {
          return { producto: productoEncontrado, confianza: 1.0 }
        }
        
        // 2. Búsqueda que contiene todas las palabras
        const productosQueContienen = productosCompletos.filter(p => {
          const nombreLower = p.nombre.toLowerCase()
          return palabras.every((pal: string) => 
            nombreLower.includes(pal.toLowerCase())
          )
        })
        
        if (productosQueContienen.length === 1) {
          return { producto: productosQueContienen[0], confianza: 0.9 }
        } else if (productosQueContienen.length > 1) {
          // Múltiples coincidencias - elegir la más corta (más específica)
          const mejor = productosQueContienen.reduce((prev, curr) => 
            curr.nombre.length < prev.nombre.length ? curr : prev
          )
          const sugerencias = productosQueContienen
            .filter(p => p.id !== mejor.id)
            .map(p => p.nombre)
            .slice(0, 3)
          return { producto: mejor, confianza: 0.8, sugerencias }
        }
        
        // 3. Búsqueda parcial (al menos una palabra)
        const productosParciales = productosCompletos.filter(p => {
          const nombreLower = p.nombre.toLowerCase()
          return palabras.some((pal: string) => 
            nombreLower.includes(pal.toLowerCase())
          )
        })
        
        if (productosParciales.length === 1) {
          return { producto: productosParciales[0], confianza: 0.7 }
        } else if (productosParciales.length > 1) {
          const mejor = productosParciales.reduce((prev, curr) => 
            curr.nombre.length < prev.nombre.length ? curr : prev
          )
          const sugerencias = productosParciales
            .filter(p => p.id !== mejor.id)
            .map(p => p.nombre)
            .slice(0, 5)
          return { producto: mejor, confianza: 0.6, sugerencias }
        }
        
        // 4. No encontrado - generar sugerencias similares
        const calcularSimilitud = (str1: string, str2: string): number => {
          const palabras1 = str1.split(/\s+/)
          const palabras2 = str2.split(/\s+/)
          let coincidencias = 0
          palabras1.forEach(p1 => {
            if (palabras2.some(p2 => p2.includes(p1) || p1.includes(p2))) {
              coincidencias++
            }
          })
          return coincidencias / Math.max(palabras1.length, palabras2.length)
        }
        
        const sugerencias = productosCompletos
          .map(p => ({
            nombre: p.nombre,
            similitud: calcularSimilitud(textoBusqueda, p.nombre.toLowerCase())
          }))
          .filter(p => p.similitud > 0.3)
          .sort((a, b) => b.similitud - a.similitud)
          .slice(0, 5)
          .map(p => p.nombre)
        
        return sugerencias.length > 0 ? { producto: null, confianza: 0, sugerencias } : null
      }
      
      // ==================== CAMBIAR DE MODO ====================
      const comandosModo = {
        ingreso: ["ingreso", "entra", "entrada", "agregar stock", "modo ingreso", "modo agregar"],
        egreso: ["egreso", "sale", "salida", "quitar stock", "modo egreso", "modo quitar"],
        stock: ["stock directo", "establecer stock", "fijar stock", "modo stock", "modo establecer"],
        pregunta: ["pregunta", "normal", "salir", "volver", "modo pregunta", "modo normal"],
      }
      
      for (const [modo, comandos] of Object.entries(comandosModo)) {
        if (comandos.some(cmd => msgLower === cmd || msgLower.startsWith(cmd + " ") || msgLower.endsWith(" " + cmd))) {
          if (modo === "pregunta") {
            return NextResponse.json({
              accion: {
                accion: "cambiar_modo",
                modo: null,
                mensaje: "✅ Volviste al modo pregunta. Podés hacer consultas o usar comandos.",
                confianza: 0.9,
              }
            })
          }
          return NextResponse.json({
            accion: {
              accion: "cambiar_modo",
              modo: modo as "ingreso" | "egreso" | "stock",
              mensaje: `✅ Modo ${modo === "ingreso" ? "Ingreso" : modo === "egreso" ? "Egreso" : "Stock"} activado. ${modo === "ingreso" ? "Escribí productos con cantidad, por ejemplo: 'papa 20'" : modo === "egreso" ? "Escribí productos con cantidad, por ejemplo: 'papa 5'" : "Escribí productos con cantidad para establecer stock, por ejemplo: 'papa 20'"}`,
              confianza: 0.9,
            }
          })
        }
      }
      
      // Limpiar selección de pedido
      if (msgLower.match(/^(todos|sin pedido|ningún pedido|limpiar pedido|deseleccionar pedido)$/i)) {
        return NextResponse.json({
          accion: {
            accion: "seleccionar_pedido",
            pedidoId: null,
            mensaje: "✅ Selección de pedido limpiada. Ahora podés trabajar con todos los productos.",
            confianza: 0.9,
          }
        })
      }
      
      // ==================== PREGUNTAS NATURALES SOBRE STOCK ====================
      const patronesPreguntas = [
        { regex: /cuántas?\s+(.+?)\s+ha[yn]?/i, tipo: "cantidad" },
        { regex: /cuánto\s+tengo\s+de\s+(.+?)(?:\s|$|\.|,)/i, tipo: "cantidad" },
        { regex: /cuánto\s+ha[yn]?\s+de\s+(.+?)(?:\s|$|\.|,)/i, tipo: "cantidad" },
        { regex: /ha[yn]?\s+(.+?)(?:\s|$|\.|,)/i, tipo: "existencia" },
        { regex: /qué\s+stock\s+tengo\s+de\s+(.+?)(?:\s|$|\.|,)/i, tipo: "stock" },
        { regex: /stock\s+de\s+(.+?)(?:\s|$|\.|,)/i, tipo: "stock" },
        { regex: /cuánto\s+es\s+(.+?)(?:\s|$|\.|,)/i, tipo: "cantidad" },
      ]
      
      for (const patron of patronesPreguntas) {
        const match = msgNormalizado.match(patron.regex)
        if (match && match[1]) {
          const nombreProducto = match[1].trim()
          const resultado = buscarProducto(nombreProducto)
          
          if (resultado && resultado.producto) {
            const producto = resultado.producto
            const stock = stockActual[producto.id] ?? 0
            const unidad = producto.unidad || "u"
            const minimo = producto.stockMinimo || 0
            const estado = stock < minimo ? "⚠️" : "✅"
            const pedido = pedidos.find((p: any) => p.id === producto.pedidoId)
            
            let respuesta = ""
            if (patron.tipo === "existencia") {
              respuesta = stock > 0 
                ? `✅ Sí, tenés ${stock} ${unidad} de ${producto.nombre}`
                : `❌ No, no tenés ${producto.nombre} (stock: 0 ${unidad})`
            } else {
              respuesta = `📦 **${producto.nombre}**: ${stock} ${unidad}`
            }
            
            if (pedido) {
              respuesta += `\n📋 Pedido: ${pedido.nombre}`
            }
            if (minimo > 0) {
              respuesta += `\n${estado} Mínimo: ${minimo} ${unidad}`
            }
            
            if (resultado.sugerencias && resultado.sugerencias.length > 0) {
              respuesta += `\n\n💡 También encontré: ${resultado.sugerencias.join(", ")}`
            }
            
            return NextResponse.json({
              accion: {
                accion: "conversacion",
                mensaje: respuesta,
                confianza: resultado.confianza,
              }
            })
          } else if (resultado && resultado.sugerencias) {
            return NextResponse.json({
              accion: {
                accion: "conversacion",
                mensaje: `No encontré "${nombreProducto}". ¿Quisiste decir: ${resultado.sugerencias.map(s => `"${s}"`).join(", ")}?`,
                confianza: 0.5,
              }
            })
          }
          break
        }
      }
      
      // ==================== ACCIONES RÁPIDAS (agregar/quitar sin cambiar modo) ====================
      const patronesAcciones = [
        { regex: /(?:agregar|sumar|poner|meter)\s+(\d+)\s+(?:de\s+)?(.+?)(?:\s|$|\.|,)/i, tipo: "entrada" },
        { regex: /(?:quitar|sacar|restar|retirar)\s+(\d+)\s+(?:de\s+)?(.+?)(?:\s|$|\.|,)/i, tipo: "salida" },
        { regex: /(\d+)\s+(?:de\s+)?(.+?)\s+(?:agregar|sumar|poner|meter)/i, tipo: "entrada" },
        { regex: /(\d+)\s+(?:de\s+)?(.+?)\s+(?:quitar|sacar|restar|retirar)/i, tipo: "salida" },
      ]
      
      for (const patron of patronesAcciones) {
        const match = msgNormalizado.match(patron.regex)
        if (match && match[1] && match[2]) {
          const cantidad = parseInt(match[1])
          const nombreProducto = match[2].trim()
          const resultado = buscarProducto(nombreProducto)
          
          if (resultado && resultado.producto && resultado.confianza >= 0.7) {
            const producto = resultado.producto
            
            // Validar stock si es salida
            if (patron.tipo === "salida") {
              const stockActualProducto = stockActual[producto.id] ?? 0
              if (stockActualProducto < cantidad) {
                return NextResponse.json({
                  accion: {
                    accion: "conversacion",
                    mensaje: `❌ No podés quitar ${cantidad} ${producto.unidad || "unidades"} de ${producto.nombre}. Solo tenés ${stockActualProducto} ${producto.unidad || "unidades"}.`,
                    confianza: 0.9,
                  }
                })
              }
            }
            
            return NextResponse.json({
              accion: {
                accion: patron.tipo === "entrada" ? "entrada" : "salida",
                productoId: producto.id,
                producto: producto.nombre,
                cantidad,
                unidad: producto.unidad,
                confianza: resultado.confianza,
                mensaje: `✅ ${patron.tipo === "entrada" ? "Agregar" : "Quitar"} ${cantidad} ${producto.unidad || "unidades"} de ${producto.nombre}? Escribí "sí" para confirmar.`,
                requiereConfirmacion: true,
              }
            })
          } else if (resultado && resultado.sugerencias) {
            return NextResponse.json({
              accion: {
                accion: "conversacion",
                mensaje: `No encontré "${nombreProducto}". ¿Quisiste decir: ${resultado.sugerencias.map(s => `"${s}"`).join(", ")}?`,
                confianza: 0.5,
              }
            })
          }
          break
        }
      }
      
      // ==================== ANÁLISIS Y ESTADÍSTICAS ====================
      if (msgLower.match(/qu[ée]\s+est[áa]\s+bajo|qu[ée]\s+falta|qu[ée]\s+necesito|productos?\s+bajos?|stock\s+bajo/i)) {
        const productosBajos = productosCompletos.filter(p => {
          const stock = stockActual[p.id] ?? 0
          return stock < (p.stockMinimo || 0)
        })
        
        if (productosBajos.length === 0) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: "✅ ¡Todo bien! No tenés productos con stock bajo.",
              confianza: 0.9,
            }
          })
        }
        
        const lista = productosBajos
          .sort((a, b) => {
            const stockA = stockActual[a.id] ?? 0
            const stockB = stockActual[b.id] ?? 0
            const minimoA = a.stockMinimo || 0
            const minimoB = b.stockMinimo || 0
            const faltaA = minimoA - stockA
            const faltaB = minimoB - stockB
            return faltaB - faltaA
          })
          .map(p => {
            const stock = stockActual[p.id] ?? 0
            const minimo = p.stockMinimo || 0
            const falta = minimo - stock
            return `⚠️ ${p.nombre}: ${stock}/${minimo} ${p.unidad || "u"} (faltan ${falta})`
          })
          .join("\n")
        
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: `📉 **Productos con stock bajo** (${productosBajos.length}):\n\n${lista}`,
            confianza: 0.9,
          }
        })
      }
      
      // Resumen general
      if (msgLower.match(/resumen|estad[íi]sticas?|total|cuántos?\s+productos?/i)) {
        const totalProductos = productosCompletos.length
        const productosConStock = productosCompletos.filter(p => (stockActual[p.id] ?? 0) > 0).length
        const productosBajos = productosCompletos.filter(p => {
          const stock = stockActual[p.id] ?? 0
          return stock < (p.stockMinimo || 0)
        }).length
        const totalStock = Object.values(stockActual).reduce((sum: number, val: any) => sum + (val || 0), 0)
        
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: `📊 **Resumen del inventario:**\n\n• Total de productos: ${totalProductos}\n• Productos con stock: ${productosConStock}\n• Productos con stock bajo: ${productosBajos}\n• Stock total: ${totalStock} unidades`,
            confianza: 0.9,
          }
        })
      }
      
      // Búsqueda avanzada: "productos con X", "todo lo de Y"
      if (msgLower.match(/productos?\s+(?:con|que\s+tienen?|de)\s+(.+?)(?:\s|$|\.|,)/i)) {
        const match = msgNormalizado.match(/productos?\s+(?:con|que\s+tienen?|de)\s+(.+?)(?:\s|$|\.|,)/i)
        if (match && match[1]) {
          const termino = match[1].trim().toLowerCase()
          const productosEncontrados = productosCompletos.filter(p => 
            p.nombre.toLowerCase().includes(termino)
          )
          
          if (productosEncontrados.length === 0) {
            return NextResponse.json({
              accion: {
                accion: "conversacion",
                mensaje: `No encontré productos que contengan "${termino}".`,
                confianza: 0.9,
              }
            })
          }
          
          const lista = productosEncontrados.map(p => {
            const stock = stockActual[p.id] ?? 0
            const unidad = p.unidad || "u"
            const estado = stock < (p.stockMinimo || 0) ? "⚠️" : "✅"
            return `${estado} ${p.nombre}: ${stock} ${unidad}`
          }).join("\n")
          
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: `🔍 **Productos con "${termino}"** (${productosEncontrados.length}):\n\n${lista}`,
              confianza: 0.9,
            }
          })
        }
      }
      
      // Ayuda contextual
      if (msgLower.match(/^(ayuda|help|comandos|qué puedo hacer|qué puedo decir)$/i)) {
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: "💡 **Comandos disponibles:**\n\n📦 **Consultas:**\n• \"cuántas X hay\" - Ver stock de un producto\n• \"stock\" - Ver todo el inventario\n• \"stock nombrepedido\" - Ver stock de un pedido\n• \"qué está bajo\" - Ver productos con stock bajo\n• \"resumen\" - Ver estadísticas\n• \"productos con X\" - Buscar productos\n\n⚡ **Acciones rápidas:**\n• \"agregar 5 de X\" - Agregar stock sin cambiar modo\n• \"quitar 3 de Y\" - Quitar stock sin cambiar modo\n\n🔄 **Cambiar modo:**\n• \"ingreso\" o \"entra\" - Modo ingreso\n• \"egreso\" o \"sale\" - Modo egreso\n• \"modo stock\" - Modo stock directo\n• \"pregunta\" o \"normal\" - Volver a modo pregunta\n\n📋 **Pedidos:**\n• \"pedido nombrepedido\" - Generar pedido\n• \"nombrepedido\" - Seleccionar pedido\n• \"todos\" - Limpiar selección de pedido",
            confianza: 0.9,
          }
        })
      }
      
      // ==================== SELECCIONAR PEDIDO (solo nombre) ====================
      const pedidoSolo = pedidos.find((p: any) => {
        const nombreLower = p.nombre.toLowerCase()
        return nombreLower === msgLower || 
               nombreLower.split(" ")[0] === msgLower ||
               nombreLower.includes(msgLower) ||
               msgLower.includes(nombreLower.split(" ")[0])
      })
      
      if (pedidoSolo && msgLower.length > 2 && !msgLower.startsWith("stock ") && !msgLower.startsWith("pedido ")) {
        const productosDelPedido = productosCompletos
          .filter(p => p.pedidoId === pedidoSolo.id)
          .sort((a, b) => (stockActual[a.id] ?? 0) - (stockActual[b.id] ?? 0))
        
        if (productosDelPedido.length === 0) {
          return NextResponse.json({
            accion: {
              accion: "seleccionar_pedido",
              pedidoId: pedidoSolo.id,
              mensaje: `✅ Pedido "${pedidoSolo.nombre}" seleccionado.\n\nEl pedido no tiene productos cargados todavía.`,
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
            accion: "seleccionar_pedido",
            pedidoId: pedidoSolo.id,
            mensaje: `✅ Pedido "${pedidoSolo.nombre}" seleccionado\n\n📦 **Stock:**\n\n${lista}\n\nTotal: ${productosDelPedido.length} productos`,
            confianza: 0.9,
          }
        })
      }
      
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
        
        // Calcular cantidad a pedir y filtrar solo los que tienen cantidad > 0
        const productosConCantidad = productosDelPedido.map(p => {
          const stock = stockActual[p.id] ?? 0
          const minimo = p.stockMinimo || 0
          const cantidadAPedir = minimo - stock
          return { producto: p, cantidadAPedir }
        }).filter(item => item.cantidadAPedir > 0)
        
        if (productosConCantidad.length === 0) {
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
        
        const lineas = productosConCantidad.map(({ producto: p, cantidadAPedir }) => {
          let texto = formatoSalida
          texto = texto.replace(/{nombre}/g, p.nombre)
          texto = texto.replace(/{cantidad}/g, cantidadAPedir.toString())
          texto = texto.replace(/{unidad}/g, p.unidad || "")
          return texto.trim()
        })
        
        const productosAPedir = productosConCantidad
        
        const respuesta = `${mensajePrevio}\n\n${lineas.join("\n")}\n\nTotal: ${productosConCantidad.length} productos`
        
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
          // Es un pedido - mostrar stock Y seleccionarlo
          const productosDelPedido = productosCompletos
            .filter(p => p.pedidoId === pedidoEncontrado.id)
            .sort((a, b) => (stockActual[a.id] ?? 0) - (stockActual[b.id] ?? 0))
          
          if (productosDelPedido.length === 0) {
            return NextResponse.json({
              accion: {
                accion: "seleccionar_pedido",
                pedidoId: pedidoEncontrado.id,
                mensaje: `✅ Pedido "${pedidoEncontrado.nombre}" seleccionado.\n\nEl pedido no tiene productos cargados todavía.`,
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
              accion: "seleccionar_pedido",
              pedidoId: pedidoEncontrado.id,
              mensaje: `✅ Pedido "${pedidoEncontrado.nombre}" seleccionado\n\n📦 **Stock:**\n\n${lista}\n\nTotal: ${productosDelPedido.length} productos`,
              confianza: 0.9,
            }
          })
        }
        
        // Si no es pedido, buscar como producto
        const resultado = buscarProducto(resto)
        
        if (resultado && resultado.producto) {
          const producto = resultado.producto
          const stock = stockActual[producto.id] ?? 0
          const unidad = producto.unidad || "u"
          const minimo = producto.stockMinimo || 0
          const estado = stock < minimo ? "⚠️" : "✅"
          const pedido = pedidos.find((p: any) => p.id === producto.pedidoId)
          
          let respuesta = `📦 **${producto.nombre}**: ${stock} ${unidad}`
          if (pedido) {
            respuesta += `\n📋 Pedido: ${pedido.nombre}`
          }
          if (minimo > 0) {
            respuesta += `\n${estado} Mínimo: ${minimo} ${unidad}`
          }
          
          if (resultado.sugerencias && resultado.sugerencias.length > 0) {
            respuesta += `\n\n💡 También encontré: ${resultado.sugerencias.join(", ")}`
          }
          
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: respuesta,
              confianza: resultado.confianza,
            }
          })
        } else if (resultado && resultado.sugerencias) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: `No encontré "${resto}". ¿Quisiste decir: ${resultado.sugerencias.map(s => `"${s}"`).join(", ")}?`,
              confianza: 0.5,
            }
          })
        }
      }
      
      // ==================== MENSAJE NO RECONOCIDO ====================
      // Intentar sugerir productos similares si el mensaje parece ser un nombre de producto
      const palabras = msgLower.split(/\s+/).filter((p: string) => p.length > 2)
      if (palabras.length > 0 && palabras.length <= 3) {
        const sugerencias = productosCompletos
          .filter(p => {
            const nombreLower = p.nombre.toLowerCase()
            return palabras.some((pal: string) => nombreLower.includes(pal))
          })
          .slice(0, 5)
          .map(p => p.nombre)
        
        if (sugerencias.length > 0) {
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: `No entendí "${msgNormalizado}". ¿Quisiste decir alguno de estos productos?\n\n${sugerencias.map(s => `• ${s}`).join("\n")}\n\nO escribí "ayuda" para ver todos los comandos disponibles.`,
              confianza: 0.5,
            }
          })
        }
      }
      
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: `No entendí "${msgNormalizado}". Escribí "ayuda" para ver todos los comandos disponibles.`,
          confianza: 0.5,
        }
      })
    }
    
    // ==================== MODO STOCK ====================
    if (modo === "stock") {
      const msgNormalizado = mensaje.replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
      
      // Filtrar productos según pedido seleccionado (si aplica)
      let productosFiltrados = productos
      if (pedidoSeleccionado) {
        productosFiltrados = productos.filter((p: { pedidoId?: string }) => p.pedidoId === pedidoSeleccionado)
      }
      
      // Construir lista de productos
      const productosConStock: ProductoInfo[] = productosFiltrados.map((p: { id: string; nombre: string; unidad?: string }) => ({
        id: p.id,
        nombre: p.nombre,
        unidad: p.unidad,
        stockActual: stockActual[p.id] ?? 0,
      }))
      
      // Extraer cantidad (número)
      const matchCantidad = msgNormalizado.match(/(\d+)/)
      const cantidad = matchCantidad ? parseInt(matchCantidad[1]) : null
      
      if (!cantidad || cantidad < 0) {
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: "Necesito saber la cantidad. Por ejemplo: 'papa 20' para establecer el stock de papa en 20.",
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
            mensaje: "No identifiqué el nombre del producto. Por ejemplo: 'papa 20' o 'leche 15'.",
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
          return palabras.every((pal: string) => {
            const palLower = pal.toLowerCase()
            const regex = new RegExp(`\\b${palLower}\\b`, "i")
            return regex.test(nombreLower) || nombreLower.includes(palLower)
          })
        })
        
        if (productosQueContienen.length === 1) {
          productoEncontrado = productosQueContienen[0]
          console.log(`[STOCK-CHAT] Coincidencia única encontrada: ${productoEncontrado.nombre}`)
        } else if (productosQueContienen.length > 1) {
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
            productoEncontrado = productosQueEmpiezan.reduce((prev, curr) => 
              curr.nombre.length < prev.nombre.length ? curr : prev
            )
            console.log(`[STOCK-CHAT] Múltiples coincidencias por inicio, eligiendo la más corta: ${productoEncontrado.nombre}`)
          }
        }
      }
      
      if (!productoEncontrado) {
        const nombreMencionado = palabras.join(" ")
        // Si hay pedido seleccionado, mencionarlo en el mensaje
        if (pedidoSeleccionado) {
          const pedido = pedidos.find((p: any) => p.id === pedidoSeleccionado)
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: `No encontré "${nombreMencionado}" en el pedido "${pedido?.nombre || "seleccionado"}". Verificá que el producto pertenezca a ese pedido o seleccioná otro pedido.`,
              confianza: 0.5,
            }
          })
        }
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: `No encontré "${nombreMencionado}" en tu inventario. ¿Podés escribirlo de nuevo o agregarlo desde la sección Pedidos?`,
            confianza: 0.5,
          }
        })
      }
      
      // Validar que el producto encontrado pertenezca al pedido seleccionado (si hay uno)
      if (pedidoSeleccionado && modo === "stock") {
        const productoCompleto = productos.find((p: { id: string; pedidoId?: string }) => p.id === productoEncontrado!.id)
        if (!productoCompleto || productoCompleto.pedidoId !== pedidoSeleccionado) {
          const pedido = pedidos.find((p: any) => p.id === pedidoSeleccionado)
          return NextResponse.json({
            accion: {
              accion: "conversacion",
              mensaje: `❌ El producto "${productoEncontrado.nombre}" no pertenece al pedido "${pedido?.nombre || "seleccionado"}". Seleccioná el pedido correcto o usá un producto de ese pedido.`,
              confianza: 0.9,
            }
          })
        }
      }
      
      // Retornar acción para actualizar stock directamente
      return NextResponse.json({
        accion: {
          accion: "actualizar_stock",
          productoId: productoEncontrado.id,
          producto: productoEncontrado.nombre,
          cantidad,
          unidad: productoEncontrado.unidad,
          confianza: 0.9,
        }
      })
    }
    
    // Normalizar mensaje
    const msgNormalizado = mensaje.replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
    const msgLower = msgNormalizado.toLowerCase()
    
    console.log(`[STOCK-CHAT] Mensaje: "${msgNormalizado}"`)
    console.log(`[STOCK-CHAT] Modo: ${modoActual}`)
    
    // Filtrar productos según pedido seleccionado (si aplica)
    let productosFiltrados = productos
    if (pedidoSeleccionado && (modoActual === "ingreso" || modoActual === "egreso")) {
      productosFiltrados = productos.filter((p: { pedidoId?: string }) => p.pedidoId === pedidoSeleccionado)
    }
    
    // Construir lista de productos
    const productosConStock: ProductoInfo[] = productosFiltrados.map((p: { id: string; nombre: string; unidad?: string; pedidoId?: string }) => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      stockActual: stockActual[p.id] ?? 0,
      pedidoId: p.pedidoId,
    }))
    
    // ==================== COMANDOS ESPECIALES EN MODO INGRESO/EGRESO ====================
    if (modoActual === "ingreso" || modoActual === "egreso") {
      // Ver lista actual
      if (msgLower.match(/^(lista|ver lista|qué tengo|qué agregué|mostrar lista)$/i)) {
        return NextResponse.json({
          accion: {
            accion: "ver_lista_acumulada",
            mensaje: "Mostrar lista de productos acumulados",
            confianza: 0.9,
          }
        })
      }
      
      // Deshacer último
      if (msgLower.match(/^(deshacer|quitar último|borrar último|último|undo)$/i)) {
        return NextResponse.json({
          accion: {
            accion: "deshacer_ultimo",
            mensaje: "Eliminar último producto agregado",
            confianza: 0.9,
          }
        })
      }
      
      // Quitar producto específico de la lista
      const matchQuitar = msgLower.match(/^(quitar|sin|eliminar|borrar)\s+(.+?)(?:\s|$|\.|,)/i)
      if (matchQuitar && matchQuitar[2]) {
        const nombreProducto = matchQuitar[2].trim()
        return NextResponse.json({
          accion: {
            accion: "quitar_de_lista",
            producto: nombreProducto,
            mensaje: `Quitar ${nombreProducto} de la lista`,
            confianza: 0.9,
          }
        })
      }
      
      // Cambiar cantidad de producto en la lista
      const matchCambiar = msgLower.match(/^(cambiar|editar|modificar)\s+(.+?)\s+(?:a|en|por)\s+(\d+)/i)
      if (matchCambiar && matchCambiar[2] && matchCambiar[3]) {
        const nombreProducto = matchCambiar[2].trim()
        const nuevaCantidad = parseInt(matchCambiar[3])
        if (nuevaCantidad > 0) {
          return NextResponse.json({
            accion: {
              accion: "cambiar_cantidad",
              producto: nombreProducto,
              cantidad: nuevaCantidad,
              mensaje: `Cambiar cantidad de ${nombreProducto} a ${nuevaCantidad}`,
              confianza: 0.9,
            }
          })
        }
      }
      
      // Múltiples productos en un mensaje: "papa 10 leche 5 tomate 3"
      // Buscar patrones como "palabra número palabra número..."
      const patronMultiples = /(\w+(?:\s+\w+)*)\s+(\d+)/g
      const matchesMultiples = [...msgNormalizado.matchAll(patronMultiples)]
      
      if (matchesMultiples.length > 1) {
        const productosParaAgregar: Array<{ producto: string, cantidad: number }> = []
        
        for (const match of matchesMultiples) {
          if (match[1] && match[2]) {
            const nombreProd = match[1].trim()
            const cantidadProd = parseInt(match[2])
            if (cantidadProd > 0 && nombreProd.length > 1) {
              productosParaAgregar.push({
                producto: nombreProd,
                cantidad: cantidadProd
              })
            }
          }
        }
        
        if (productosParaAgregar.length > 0) {
          return NextResponse.json({
            accion: {
              accion: "agregar_multiples",
              productos: productosParaAgregar,
              mensaje: `Agregar ${productosParaAgregar.length} productos a la lista`,
              confianza: 0.9,
            }
          })
        }
      }
    }
    
    // ==================== EXTRAER CANTIDAD Y PRODUCTO (ACEPTA AMBOS ÓRDENES) ====================
    // Intentar diferentes formatos: "papa 10", "10 papa", "10 de papa"
    let cantidad: number | null = null
    let nombreProducto: string = ""
    
    // Formato 1: "10 papa" o "10 de papa"
    const matchCantidadInicio = msgNormalizado.match(/^(\d+)\s+(?:de\s+)?(.+)/)
    if (matchCantidadInicio) {
      cantidad = parseInt(matchCantidadInicio[1])
      nombreProducto = matchCantidadInicio[2].trim()
    } else {
      // Formato 2: "papa 10"
      const matchCantidadFinal = msgNormalizado.match(/(.+?)\s+(\d+)$/)
      if (matchCantidadFinal) {
        cantidad = parseInt(matchCantidadFinal[2])
        nombreProducto = matchCantidadFinal[1].trim()
      } else {
        // Formato 3: Buscar cualquier número y el resto como producto
        const matchCantidad = msgNormalizado.match(/(\d+)/)
        if (matchCantidad) {
          cantidad = parseInt(matchCantidad[1])
          // Eliminar el número del texto para obtener el producto
          nombreProducto = msgNormalizado.replace(/\d+/g, "").replace(/\s+/g, " ").trim()
        }
      }
    }
    
    if (!cantidad || cantidad <= 0) {
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: "Necesito saber la cantidad. Por ejemplo: 'leche 20', '20 leche', o 'papa 10'.",
          confianza: 0.5,
        }
      })
    }
    
    if (!nombreProducto || nombreProducto.length < 2) {
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: "No identifiqué el nombre del producto. Por ejemplo: 'leche 20', '20 leche', o 'papa 10'.",
          confianza: 0.5,
        }
      })
    }
    
    // Buscar producto por nombre (buscar palabras que no sean números)
    const palabras = nombreProducto.split(/\s+/).filter((p: string) => !/^\d+$/.test(p) && p.length > 1)
    
    if (palabras.length === 0) {
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: "No identifiqué el nombre del producto. Por ejemplo: 'leche 20', '20 leche', o 'papa 10'.",
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
      // Si hay pedido seleccionado, mencionarlo en el mensaje
      if (pedidoSeleccionado) {
        const pedido = pedidos.find((p: any) => p.id === pedidoSeleccionado)
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: `No encontré "${nombreMencionado}" en el pedido "${pedido?.nombre || "seleccionado"}". Verificá que el producto pertenezca a ese pedido o seleccioná otro pedido.`,
            confianza: 0.5,
          }
        })
      }
      return NextResponse.json({
        accion: {
          accion: "conversacion",
          mensaje: `No encontré "${nombreMencionado}" en tu inventario. ¿Podés escribirlo de nuevo o agregarlo desde la sección Pedidos?`,
          confianza: 0.5,
        }
      })
    }
    
    // Validar que el producto encontrado pertenezca al pedido seleccionado (si hay uno)
    if (pedidoSeleccionado && (modoActual === "ingreso" || modoActual === "egreso")) {
      const productoCompleto = productos.find((p: { id: string; pedidoId?: string }) => p.id === productoEncontrado!.id)
      if (!productoCompleto || productoCompleto.pedidoId !== pedidoSeleccionado) {
        const pedido = pedidos.find((p: any) => p.id === pedidoSeleccionado)
        return NextResponse.json({
          accion: {
            accion: "conversacion",
            mensaje: `❌ El producto "${productoEncontrado.nombre}" no pertenece al pedido "${pedido?.nombre || "seleccionado"}". Seleccioná el pedido correcto o usá un producto de ese pedido.`,
            confianza: 0.9,
          }
        })
      }
    }
    
    // Todo bien, agregar a lista acumulada (no confirmar inmediatamente)
    const accion = modoActual === "ingreso" ? "entrada" : "salida"
    const verbo = modoActual === "ingreso" ? "agregar" : "quitar"
    
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
