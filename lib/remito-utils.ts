import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Remito, Pedido, Producto } from "./types"

/**
 * Normaliza el nombre del pedido para usar en la numeración de remitos
 */
function normalizarNombrePedido(nombre: string): string {
  if (!nombre || typeof nombre !== 'string') {
    return "PEDIDO"
  }
  const normalizado = nombre
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") // Solo letras y números
    .substring(0, 10) // Máximo 10 caracteres
  
  // Si después de normalizar está vacío, usar fallback
  return normalizado || "PEDIDO"
}

/**
 * Genera un número de remito único por tipo de pedido en formato VERDULERIA-001, VERDULERIA-002, etc.
 */
export async function generarNumeroRemito(
  db: any,
  COLLECTIONS: any,
  nombrePedido: string
): Promise<string> {
  try {
    const { collection, query, orderBy, limit, getDocs, where } = await import("firebase/firestore")
    const prefijo = normalizarNombrePedido(nombrePedido)
    const remitosRef = collection(db, COLLECTIONS.REMITOS)
    
    // Buscar el último remito de este tipo de pedido
    const q = query(
      remitosRef,
      where("numero", ">=", `${prefijo}-000`),
      where("numero", "<", `${prefijo}-999`),
      orderBy("numero", "desc"),
      limit(1)
    )
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) {
      return `${prefijo}-001`
    }
    
    const ultimoNumero = snapshot.docs[0].data().numero
    const partes = ultimoNumero.split("-")
    if (partes.length === 2 && partes[0] === prefijo) {
      const numero = parseInt(partes[1]) + 1
      return `${prefijo}-${String(numero).padStart(3, "0")}`
    }
    
    // Si no coincide el prefijo, empezar desde 001
    return `${prefijo}-001`
  } catch (error) {
    // Si hay error, generar número basado en timestamp
    const prefijo = normalizarNombrePedido(nombrePedido)
    const timestamp = Date.now()
    return `${prefijo}-${String(timestamp).slice(-6)}`
  }
}

/**
 * Genera un remito de pedido inicial (solo cantidades pedidas)
 */
export function crearRemitoPedido(
  pedido: Pedido,
  productos: Producto[],
  stockActual: Record<string, number>,
  calcularPedido: (stockMinimo: number, stockActual?: number) => number,
  ajustesPedido?: Record<string, number> // Ajustes manuales a la cantidad a pedir
): Omit<Remito, "id" | "numero" | "createdAt"> {
  const productosAPedir = productos
    .map(p => {
      const pedidoBase = calcularPedido(p.stockMinimo, stockActual[p.id])
      const ajuste = ajustesPedido?.[p.id] ?? 0
      const cantidadFinal = Math.max(0, pedidoBase + ajuste)
      return { producto: p, cantidadFinal }
    })
    .filter(({ cantidadFinal }) => cantidadFinal > 0)
    .map(({ producto: p, cantidadFinal }) => ({
      productoId: p.id,
      productoNombre: p.nombre,
      cantidad: cantidadFinal,
      cantidadPedida: cantidadFinal,
    }))

  return {
    pedidoId: pedido.id,
    tipo: "pedido",
    fecha: new Date(),
    desde: pedido.origenDefault || "FABRICA",
    hacia: pedido.destinoDefault || "LOCAL",
    productos: productosAPedir,
    userId: pedido.userId,
  }
}

/**
 * Genera un remito de envío (pedido → fábrica)
 * @deprecated Usar crearRemitoPedido para el inicial y crearRemitoEnvioDesdeDisponibles para el confirmado
 */
export function crearRemitoEnvio(
  pedido: Pedido,
  productos: Producto[],
  stockActual: Record<string, number>,
  calcularPedido: (stockMinimo: number, stockActual?: number) => number
): Omit<Remito, "id" | "numero" | "createdAt"> {
  const productosAPedir = productos
    .filter(p => calcularPedido(p.stockMinimo, stockActual[p.id]) > 0)
    .map(p => {
      const cantidadPedida = calcularPedido(p.stockMinimo, stockActual[p.id])
      return {
        productoId: p.id,
        productoNombre: p.nombre,
        cantidad: cantidadPedida,
        cantidadPedida: cantidadPedida,
      }
    })

  return {
    pedidoId: pedido.id,
    tipo: "envio",
    fecha: new Date(),
    desde: pedido.origenDefault || "FABRICA",
    hacia: pedido.destinoDefault || "LOCAL",
    productos: productosAPedir,
    userId: pedido.userId,
  }
}

/**
 * Genera un remito de envío desde productosDisponibles (confirmado por la fábrica)
 */
export function crearRemitoEnvioDesdeDisponibles(
  pedido: Pedido,
  productos: Producto[],
  productosDisponibles: Record<string, {
    disponible: boolean
    cantidadEnviada?: number
    observaciones?: string
  }>
): Omit<Remito, "id" | "numero" | "createdAt"> {
  // Incluir productos que están disponibles (incluso con cantidad 0) para tener registro completo
  // También incluir productos que tienen observaciones aunque cantidad sea 0
  const productosRemito = productos
    .filter(p => {
      const disponible = productosDisponibles[p.id]
      // Incluir si está marcado como disponible (incluso con cantidad 0) o tiene observaciones
      return disponible?.disponible === true || (disponible?.observaciones && disponible.observaciones.trim().length > 0)
    })
    .map(p => {
      const disponible = productosDisponibles[p.id]
      // Usar cantidadPedida del snapshot si existe (en productos del enlace público), sino stockMinimo
      const cantidadPedida = (p as any).cantidadPedida || p.stockMinimo || 0
      const productoRemito: {
        productoId: string
        productoNombre: string
        cantidad: number
        cantidadPedida: number
        cantidadEnviada: number
        observaciones?: string
      } = {
        productoId: p.id,
        productoNombre: p.nombre,
        cantidad: disponible?.cantidadEnviada || 0, // Campo requerido "cantidad" que representa la cantidad enviada
        cantidadPedida: cantidadPedida,
        cantidadEnviada: disponible?.cantidadEnviada || 0,
      }
      // Incluir observaciones del producto si existen
      if (disponible?.observaciones && disponible.observaciones.trim().length > 0) {
        productoRemito.observaciones = disponible.observaciones.trim()
      }
      return productoRemito
    })

  // Recolectar observaciones de todos los productos (para el campo observaciones general del remito)
  // Solo las que no están incluidas ya en los productos individuales
  const observacionesGenerales = productos
    .map(p => {
      const disponible = productosDisponibles[p.id]
      // Solo incluir si tiene observaciones y el producto NO está en productosRemito (ya que tiene su propia observación)
      if (disponible?.observaciones && disponible.observaciones.trim().length > 0) {
        const productoEnRemito = productosRemito.find(pr => pr.productoId === p.id)
        // Si el producto ya tiene observaciones en su objeto, no duplicar en general
        if (!productoEnRemito || !productoEnRemito.observaciones) {
          return `${p.nombre}: ${disponible.observaciones}`
        }
      }
      return null
    })
    .filter(Boolean)
    .join("\n")

  // Construir el objeto del remito
  const remitoData: any = {
    pedidoId: pedido.id,
    tipo: "envio",
    fecha: new Date(),
    desde: pedido.origenDefault || "FABRICA",
    hacia: pedido.destinoDefault || "LOCAL",
    productos: productosRemito,
    userId: pedido.userId,
  }

  // Solo incluir observaciones generales si hay contenido
  if (observacionesGenerales && observacionesGenerales.trim().length > 0) {
    remitoData.observaciones = observacionesGenerales
  }

  return remitoData
}

/**
 * Consolida datos de remitos anteriores (pedido y envío) con la recepción
 */
function consolidarProductosRemito(
  remitoPedido: Remito | null,
  remitoEnvio: Remito | null,
  recepcion: any
): Array<{
  productoId: string
  productoNombre: string
  cantidadPedida: number
  cantidadEnviada?: number
  cantidadRecibida?: number
  esDevolucion?: boolean
  cantidadDevolucion?: number
}> {
  // Crear un mapa de productos recibidos
  const productosRecibidosMap = new Map<string, any>()
  recepcion.productos.forEach((p: any) => {
    productosRecibidosMap.set(p.productoId, p)
  })

  // Crear un mapa de productos del remito de pedido
  const productosPedidoMap = new Map<string, any>()
  if (remitoPedido) {
    remitoPedido.productos.forEach(p => {
      productosPedidoMap.set(p.productoId, p)
    })
  }

  // Crear un mapa de productos del remito de envío
  const productosEnvioMap = new Map<string, any>()
  if (remitoEnvio) {
    remitoEnvio.productos.forEach(p => {
      productosEnvioMap.set(p.productoId, p)
    })
  }

  // Consolidar: usar todos los productos que aparecen en cualquiera de los remitos
  const productosConsolidados = new Map<string, any>()
  
  // Agregar productos del pedido
  productosPedidoMap.forEach((p, id) => {
    productosConsolidados.set(id, {
      productoId: id,
      productoNombre: (p.productoNombre && p.productoNombre.trim()) || "Producto sin nombre",
      cantidadPedida: p.cantidadPedida || 0,
      cantidadEnviada: 0,
      cantidadRecibida: 0,
    })
  })

  // Actualizar con datos de envío
  productosEnvioMap.forEach((p, id) => {
    const consolidado = productosConsolidados.get(id) || {
      productoId: id,
      productoNombre: (p.productoNombre && p.productoNombre.trim()) || "Producto sin nombre",
      cantidadPedida: p.cantidadPedida || 0,
      cantidadEnviada: 0,
      cantidadRecibida: 0,
    }
    // Asegurar que el nombre del producto esté presente
    if (p.productoNombre && p.productoNombre.trim()) {
      consolidado.productoNombre = p.productoNombre.trim()
    }
    consolidado.cantidadEnviada = p.cantidadEnviada || 0
    if (!consolidado.cantidadPedida && p.cantidadPedida) {
      consolidado.cantidadPedida = p.cantidadPedida
    }
    productosConsolidados.set(id, consolidado)
  })

  // Actualizar con datos de recepción
  productosRecibidosMap.forEach((p, id) => {
    const consolidado = productosConsolidados.get(id) || {
      productoId: id,
      productoNombre: p.productoNombre || "Producto sin nombre",
      cantidadPedida: 0,
      cantidadEnviada: 0,
      cantidadRecibida: 0,
    }
    // Asegurar que el nombre del producto esté presente (prioridad: recepción > envío > pedido)
    if (p.productoNombre && p.productoNombre.trim()) {
      consolidado.productoNombre = p.productoNombre.trim()
    }
    consolidado.cantidadRecibida = p.cantidadRecibida || 0
    if (!consolidado.cantidadEnviada && p.cantidadEnviada) {
      consolidado.cantidadEnviada = p.cantidadEnviada
    }
    if (!consolidado.cantidadPedida && p.cantidadEnviada) {
      consolidado.cantidadPedida = p.cantidadEnviada
    }
    // Preservar información de devolución
    if (p.esDevolucion !== undefined) {
      consolidado.esDevolucion = p.esDevolucion
    }
    if (p.cantidadDevolucion !== undefined && p.cantidadDevolucion > 0) {
      consolidado.cantidadDevolucion = p.cantidadDevolucion
    }
    productosConsolidados.set(id, consolidado)
  })

  return Array.from(productosConsolidados.values())
}

/**
 * Genera un remito de recepción final consolidado (fábrica → local)
 * Este remito consolida datos de remitos anteriores (pedido y envío)
 */
export function crearRemitoRecepcion(
  pedido: Pedido,
  recepcion: any,
  remitoPedido: Remito | null = null,
  remitoEnvio: Remito | null = null
): Omit<Remito, "id" | "numero" | "createdAt"> {
  // Consolidar productos de todos los remitos
  const productosConsolidados = consolidarProductosRemito(
    remitoPedido,
    remitoEnvio,
    recepcion
  )

  // Obtener hora actual para el remito
  const ahora = new Date()
  const horaActual = format(ahora, "HH:mm", { locale: es })

  // Consolidar observaciones de múltiples fuentes
  const observacionesArray: string[] = []
  
  // 1. Observaciones del remito de envío (del enlace público)
  if (remitoEnvio?.observaciones && remitoEnvio.observaciones.trim()) {
    observacionesArray.push(`ENVÍO:\n${remitoEnvio.observaciones.trim()}`)
  }
  
  // 2. Observaciones de productos individuales de la recepción (incluyendo devoluciones)
  const observacionesProductos = recepcion.productos
    ?.map((p: any) => {
      const partes: string[] = []
      
      // Si es devolución, indicarlo claramente
      if (p.esDevolucion && p.cantidadDevolucion && p.cantidadDevolucion > 0) {
        partes.push(`[DEVOLUCIÓN: ${p.cantidadDevolucion} unidades]`)
      } else if (p.esDevolucion) {
        partes.push(`[DEVOLUCIÓN]`)
      }
      
      // Agregar observaciones del producto
      if (p.observaciones && p.observaciones.trim()) {
        partes.push(p.observaciones.trim())
      }
      
      if (partes.length > 0) {
        return `${p.productoNombre}: ${partes.join(" - ")}`
      }
      return null
    })
    .filter(Boolean)
  
  if (observacionesProductos && observacionesProductos.length > 0) {
    observacionesArray.push(`RECEPCIÓN:\n${observacionesProductos.join("\n")}`)
  }
  
  // 3. Observaciones generales de la recepción
  if (recepcion.observaciones && recepcion.observaciones.trim()) {
    observacionesArray.push(`OBSERVACIONES GENERALES:\n${recepcion.observaciones.trim()}`)
  }

  // Construir el objeto del remito final
  const remitoData: any = {
    pedidoId: pedido.id,
    tipo: "recepcion",
    fecha: recepcion.fecha || ahora,
    desde: pedido.destinoDefault || "FABRICA",
    hacia: pedido.origenDefault || "LOCAL",
    productos: productosConsolidados,
    final: true, // Marcar como remito final
    userId: pedido.userId,
    // Usar hora actual automáticamente
    horaRetiroFabrica: horaActual,
    horaRecepcionLocal: horaActual,
  }

  // Preservar firma de envío del remito de envío
  if (remitoEnvio?.firmaEnvio) {
    remitoData.firmaEnvio = remitoEnvio.firmaEnvio
  }

  // Incluir firma de recepción si existe en la recepción
  if (recepcion.firmaRecepcion) {
    remitoData.firmaRecepcion = recepcion.firmaRecepcion
  }

  // Incluir observaciones consolidadas si hay contenido
  if (observacionesArray.length > 0) {
    remitoData.observaciones = observacionesArray.join("\n\n")
  }

  return remitoData
}

/**
 * Elimina remitos anteriores (pedido y envío) cuando se crea el remito de recepción final
 */
export async function eliminarRemitosAnteriores(
  db: any,
  COLLECTIONS: any,
  pedidoId: string
): Promise<void> {
  try {
    const { collection, query, where, getDocs, deleteDoc } = await import("firebase/firestore")
    const remitosRef = collection(db, COLLECTIONS.REMITOS)
    
    // Buscar todos los remitos del pedido (no podemos usar != en Firestore fácilmente)
    const q = query(
      remitosRef,
      where("pedidoId", "==", pedidoId)
    )
    const snapshot = await getDocs(q)
    
    // Eliminar remitos anteriores (pedido y envío) que no sean finales
    const promesas = snapshot.docs
      .filter(doc => {
        const data = doc.data()
        // Solo eliminar remitos de tipo "pedido" o "envio" que no sean finales
        return (data.tipo === "pedido" || data.tipo === "envio") && !data.final
      })
      .map(doc => deleteDoc(doc.ref))
    
    if (promesas.length > 0) {
      await Promise.all(promesas)
      console.log(`✓ Eliminados ${promesas.length} remitos anteriores`)
    }
  } catch (error) {
    console.error("Error al eliminar remitos anteriores:", error)
    // No lanzar error para no interrumpir el flujo
  }
}

/**
 * Genera un PDF del remito usando jsPDF
 */
export async function generarPDFRemito(remito: Remito, nombreEmpresa?: string, nombrePedido?: string): Promise<void> {
  const jsPDF = (await import("jspdf")).default
  
  const pdf = new jsPDF("p", "mm", "a4")
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  let yPos = margin

  // Título - formato: "nombrepedido: -- nombreempresa"
  pdf.setFontSize(16)
  pdf.setFont("helvetica", "bold")
  const empresa = nombreEmpresa || "PANIFICADOS Y EMPANADAS SANTA"
  const pedido = nombrePedido || "PEDIDO"
  const titulo = `${pedido}: -- ${empresa}`
  pdf.text(titulo, pdfWidth / 2, yPos, { align: "center" })
  yPos += 10

  // Número de remito (esquina superior derecha)
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "normal")
  pdf.text(`N°${remito.numero}`, pdfWidth - margin, margin + 5, { align: "right" })

  // Fecha (esquina superior izquierda)
  let fechaTexto = format(new Date(), "dd/MM/yy", { locale: es })
  if (remito.fecha) {
    try {
      if (typeof remito.fecha === 'object' && 'toDate' in remito.fecha) {
        fechaTexto = format(remito.fecha.toDate(), "dd/MM/yy", { locale: es })
      } else if (remito.fecha instanceof Date) {
        fechaTexto = format(remito.fecha, "dd/MM/yy", { locale: es })
      } else {
        fechaTexto = format(new Date(remito.fecha), "dd/MM/yy", { locale: es })
      }
    } catch {
      fechaTexto = format(new Date(), "dd/MM/yy", { locale: es })
    }
  }
  pdf.text(`FECHA: ${fechaTexto}`, margin, margin + 5)

  yPos += 8

  // Partida y Entrega - agregar horas si están disponibles
  pdf.setFontSize(10)
  
  // Obtener hora de partida (hora de retiro/salida)
  let horaPartida: string | undefined
  if (remito.horaRetiroFabrica) {
    horaPartida = remito.horaRetiroFabrica
  } else if (remito.fecha) {
    try {
      const fechaObj = remito.fecha instanceof Date 
        ? remito.fecha 
        : (typeof remito.fecha === 'object' && 'toDate' in remito.fecha 
          ? remito.fecha.toDate() 
          : new Date(remito.fecha))
      horaPartida = format(fechaObj, "HH:mm", { locale: es })
    } catch {
      horaPartida = undefined
    }
  }
  
  // Obtener hora de entrega (hora de recepción/llegada)
  let horaEntrega: string | undefined
  if (remito.horaRecepcionLocal) {
    horaEntrega = remito.horaRecepcionLocal
  } else if (remito.fecha && remito.tipo === "recepcion") {
    try {
      const fechaObj = remito.fecha instanceof Date 
        ? remito.fecha 
        : (typeof remito.fecha === 'object' && 'toDate' in remito.fecha 
          ? remito.fecha.toDate() 
          : new Date(remito.fecha))
      horaEntrega = format(fechaObj, "HH:mm", { locale: es })
    } catch {
      horaEntrega = undefined
    }
  }
  
  const textoPartida = horaPartida 
    ? `PARTIDA: ${remito.desde} / HORA: ${horaPartida} Hs`
    : `PARTIDA: ${remito.desde}`
  const textoEntrega = horaEntrega
    ? `ENTREGA: ${remito.hacia} / HORA: ${horaEntrega} Hs`
    : `ENTREGA: ${remito.hacia}`
  
  pdf.text(textoPartida, margin, yPos)
  pdf.text(textoEntrega, margin, yPos + 5)
  yPos += 12

  // Línea separadora
  pdf.setDrawColor(0, 0, 0)
  pdf.line(margin, yPos, pdfWidth - margin, yPos)
  yPos += 5

  // Parsear observaciones por producto separando envío y recepción
  const observacionesEnvioPorProducto = new Map<string, string>()
  const observacionesRecepcionPorProducto = new Map<string, string>()
  let observacionesGenerales = ""
  
  if (remito.observaciones && remito.observaciones.trim()) {
    const partes = remito.observaciones.split('\n\n')
    partes.forEach(parte => {
      if (parte.startsWith('ENVÍO:')) {
        // Parsear observaciones de envío (formato "Producto: observación")
        const contenidoEnvio = parte.replace('ENVÍO:\n', '').trim()
        const lineasEnvio = contenidoEnvio.split('\n')
        lineasEnvio.forEach(linea => {
          const match = linea.match(/^(.+?):\s*(.+)$/)
          if (match) {
            const nombreProducto = match[1].trim()
            const observacion = match[2].trim()
            observacionesEnvioPorProducto.set(nombreProducto, observacion)
          }
        })
      } else if (parte.startsWith('RECEPCIÓN:')) {
        // Parsear observaciones de recepción (formato "Producto: observación")
        const contenidoRecepcion = parte.replace('RECEPCIÓN:\n', '').trim()
        const lineasRecepcion = contenidoRecepcion.split('\n')
        lineasRecepcion.forEach(linea => {
          const match = linea.match(/^(.+?):\s*(.+)$/)
          if (match) {
            const nombreProducto = match[1].trim()
            const observacion = match[2].trim()
            observacionesRecepcionPorProducto.set(nombreProducto, observacion)
          }
        })
      } else if (parte.startsWith('OBSERVACIONES GENERALES:')) {
        observacionesGenerales = parte.replace('OBSERVACIONES GENERALES:\n', '').trim()
      }
    })
  }
  
  // Verificar si hay comentarios (de cualquier tipo)
  const tieneComentarios = observacionesEnvioPorProducto.size > 0 || observacionesRecepcionPorProducto.size > 0

  // Tabla de productos
  pdf.setFontSize(10)
  pdf.setFont("helvetica", "bold")
  
  // Si es remito final (recepcion con final=true), mostrar 3 o 4 columnas
  const esRemitoFinal = remito.final && remito.tipo === "recepcion"
  
  // Verificar si hay devoluciones para determinar el número de columnas (solo para remitos finales)
  const tieneDevoluciones = esRemitoFinal && remito.productos.some((p: any) => p.esDevolucion && p.cantidadDevolucion && p.cantidadDevolucion > 0)
  
  // Calcular dimensiones de la tabla
  let productoWidth: number
  let numColumnas: number
  let colWidth: number
  let pedidaX: number
  let enviadaX: number
  let recibidaX: number
  let devolucionX: number | null
  let comentariosX: number | null
  let tableEndX: number
  
  if (esRemitoFinal) {
    // Calcular anchos de columnas (sin columna separada de comentarios)
    productoWidth = tieneDevoluciones ? (pdfWidth - margin * 2) * 0.45 : (pdfWidth - margin * 2) * 0.5
    numColumnas = tieneDevoluciones ? 4 : 3
    colWidth = (pdfWidth - margin * 2 - productoWidth) / numColumnas
    
    pedidaX = margin + productoWidth
    enviadaX = pedidaX + colWidth
    recibidaX = enviadaX + colWidth
    devolucionX = tieneDevoluciones ? recibidaX + colWidth : null
    tableEndX = devolucionX ? devolucionX + colWidth : recibidaX + colWidth
    
    // Dibujar borde superior de la tabla con mejor diseño
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.8)
    const headerHeight = 9
    pdf.rect(margin, yPos - 6, tableEndX - margin, headerHeight)
    
    // Fondo gris más oscuro para el encabezado (más profesional)
    pdf.setFillColor(230, 230, 230)
    pdf.rect(margin, yPos - 6, tableEndX - margin, headerHeight, 'F')
    
    // Restaurar color de texto y usar fuente más bold
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    
    pdf.text("PRODUCTO", margin + 4, yPos)
    pdf.text("PEDIDA", pedidaX + colWidth / 2, yPos, { align: "center" })
    pdf.text("ENVIADA", enviadaX + colWidth / 2, yPos, { align: "center" })
    pdf.text("RECIBIDA", recibidaX + colWidth / 2, yPos, { align: "center" })
    if (tieneDevoluciones) {
      pdf.text("DEV.", devolucionX! + colWidth / 2, yPos, { align: "center" })
    }
  } else {
    // Encabezado con 1 columna (comentarios aparecen debajo de la cantidad)
    productoWidth = (pdfWidth - margin * 2) * 0.6
    colWidth = (pdfWidth - margin * 2 - productoWidth)
    tableEndX = pdfWidth - margin
    
    // Dibujar borde superior de la tabla
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.5)
    pdf.rect(margin, yPos - 5, tableEndX - margin, 7)
    
    // Fondo gris para el encabezado
    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, yPos - 5, tableEndX - margin, 7, 'F')
    
    pdf.text("PRODUCTO", margin + 3, yPos)
    pdf.text("CANTIDAD", margin + productoWidth + colWidth / 2, yPos, { align: "center" })
  }
  yPos += 10 // Más espacio después del encabezado para separación clara

  // Productos
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(10)
  let filaIndex = 0
  const alturaFilaBase = 10 // Altura base más generosa para mejor legibilidad
  
  remito.productos.forEach((producto) => {
    if (yPos > pdfHeight - 60) {
      pdf.addPage()
      yPos = margin + 10
    }

    // Obtener comentarios del producto (separados por tipo)
    const comentarioEnvio = observacionesEnvioPorProducto.get(producto.productoNombre) || ""
    const comentarioRecepcion = observacionesRecepcionPorProducto.get(producto.productoNombre) || ""

    if (esRemitoFinal) {
      // Calcular anchos de columnas (ya calculados arriba)
      const productoX = margin + 3
      
      // Calcular altura de fila según comentarios (en cualquier columna) - mejor cálculo
      let lineasComentarioEnvio = comentarioEnvio ? pdf.splitTextToSize(comentarioEnvio, colWidth - 8).length : 0
      let lineasComentarioRecepcion = comentarioRecepcion ? pdf.splitTextToSize(comentarioRecepcion, colWidth - 8).length : 0
      const maxLineasComentario = Math.max(lineasComentarioEnvio, lineasComentarioRecepcion)
      let alturaFila = Math.max(alturaFilaBase, maxLineasComentario * 4 + 8) // Más espacio para comentarios
      
      // Mostrar 3 o 4 columnas según si hay devoluciones
      if (tieneDevoluciones) {
        // Mostrar 4 columnas: Pedida, Enviada, Recibida, Devolución
        
        // Fondo alternado para filas (zebra striping)
        if (filaIndex % 2 === 0) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(margin, yPos - 4, tableEndX - margin, alturaFila, 'F')
        }
        
        // Dibujar bordes de la fila
        pdf.setDrawColor(200, 200, 200)
        pdf.setLineWidth(0.3)
        // Borde izquierdo
        pdf.line(margin, yPos - 4, margin, yPos - 4 + alturaFila)
        // Borde derecho
        pdf.line(tableEndX, yPos - 4, tableEndX, yPos - 4 + alturaFila)
        // Borde inferior
        pdf.line(margin, yPos - 4 + alturaFila, tableEndX, yPos - 4 + alturaFila)
        // Bordes verticales entre columnas
        pdf.line(pedidaX, yPos - 4, pedidaX, yPos - 4 + alturaFila)
        pdf.line(enviadaX, yPos - 4, enviadaX, yPos - 4 + alturaFila)
        pdf.line(recibidaX, yPos - 4, recibidaX, yPos - 4 + alturaFila)
        if (devolucionX) {
          pdf.line(devolucionX, yPos - 4, devolucionX, yPos - 4 + alturaFila)
        }
        
        // Nombre del producto (con truncamiento si es muy largo)
        const nombreProducto = producto.productoNombre || "Producto sin nombre"
        const maxWidth = productoWidth - 4
        pdf.setFontSize(10)
        pdf.setTextColor(0, 0, 0)
        const nombreTruncado = pdf.splitTextToSize(nombreProducto, maxWidth)[0] || nombreProducto.substring(0, 30)
        pdf.text(nombreTruncado, productoX, yPos)
        
        // Cantidades
        pdf.text(
          (producto.cantidadPedida || 0).toString(),
          pedidaX + colWidth / 2,
          yPos,
          { align: "center" }
        )
        
        // Cantidad enviada con comentario debajo
        pdf.text(
          (producto.cantidadEnviada || 0).toString(),
          enviadaX + colWidth / 2,
          yPos,
          { align: "center" }
        )
        // Comentario de envío debajo del número - diseño mejorado
        if (comentarioEnvio) {
          pdf.setFontSize(8)
          pdf.setFont("helvetica", "italic")
          pdf.setTextColor(70, 70, 70) // Color más oscuro para mejor legibilidad
          const maxComentarioWidth = colWidth - 8
          const comentarioTruncado = pdf.splitTextToSize(comentarioEnvio, maxComentarioWidth)
          let yComentarioEnvio = yPos + 6 // Más espacio del número
          comentarioTruncado.forEach((linea: string, idx: number) => {
            pdf.text(linea, enviadaX + colWidth / 2, yComentarioEnvio + (idx * 4), { align: "center", maxWidth: maxComentarioWidth })
          })
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(0, 0, 0)
        }
        
        // Calcular indicador visual para cantidad recibida
        const cantidadPedida = producto.cantidadPedida || 0
        const cantidadEnviada = producto.cantidadEnviada || 0
        const cantidadRecibida = producto.cantidadRecibida || 0
        
        let indicador = ""
        let colorIndicador = [0, 0, 0] // Negro por defecto
        
        if (cantidadRecibida > cantidadEnviada) {
          // Recibido más de lo enviado: flecha arriba
          indicador = "↑"
          colorIndicador = [0, 150, 0] // Verde
        } else if (cantidadRecibida < cantidadEnviada) {
          // Recibido menos de lo enviado: flecha abajo
          indicador = "↓"
          colorIndicador = [200, 0, 0] // Rojo
        } else if (cantidadRecibida === cantidadEnviada && cantidadRecibida !== cantidadPedida) {
          // No se recibió lo que se pidió (pero sí lo enviado): X
          indicador = "X"
          colorIndicador = [200, 0, 0] // Rojo
        }
        
        // Mostrar cantidad recibida con indicador
        const textoRecibida = cantidadRecibida.toString()
        pdf.text(
          textoRecibida,
          recibidaX + colWidth / 2 - (indicador ? 4 : 0),
          yPos,
          { align: "center" }
        )
        
        // Mostrar indicador visual si existe
        if (indicador) {
          pdf.setFontSize(12)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(colorIndicador[0], colorIndicador[1], colorIndicador[2])
          pdf.text(
            indicador,
            recibidaX + colWidth / 2 + 6,
            yPos - 1,
            { align: "center" }
          )
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(0, 0, 0) // Restaurar color negro
        }
        
        // Comentario de recepción debajo del número
        if (comentarioRecepcion) {
          pdf.setFontSize(8)
          pdf.setFont("helvetica", "italic")
          pdf.setTextColor(80, 80, 80)
          const maxComentarioWidth = colWidth - 6
          const comentarioTruncado = pdf.splitTextToSize(comentarioRecepcion, maxComentarioWidth)
          let yComentarioRecepcion = yPos + 5
          comentarioTruncado.forEach((linea: string, idx: number) => {
            pdf.text(linea, recibidaX + colWidth / 2, yComentarioRecepcion + (idx * 3.5), { align: "center", maxWidth: maxComentarioWidth })
          })
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(0, 0, 0)
        }
        
        // Cantidad de devolución (si aplica)
        const cantidadDevolucion = (producto as any).cantidadDevolucion || 0
        pdf.setFont(cantidadDevolucion > 0 ? "helvetica" : "helvetica", cantidadDevolucion > 0 ? "bold" : "normal")
        pdf.setTextColor(cantidadDevolucion > 0 ? 200 : 0, 0, 0)
        pdf.text(
          cantidadDevolucion > 0 ? cantidadDevolucion.toString() : "-",
          devolucionX! + colWidth / 2,
          yPos,
          { align: "center" }
        )
        pdf.setTextColor(0, 0, 0) // Restaurar color negro
        
        yPos += alturaFila
        filaIndex++
      } else {
        // Mostrar 3 columnas estándar: Pedida, Enviada, Recibida
        
        // Calcular altura de fila según comentarios (en cualquier columna) - mejor cálculo
        let lineasComentarioEnvio = comentarioEnvio ? pdf.splitTextToSize(comentarioEnvio, colWidth - 8).length : 0
        let lineasComentarioRecepcion = comentarioRecepcion ? pdf.splitTextToSize(comentarioRecepcion, colWidth - 8).length : 0
        const maxLineasComentario = Math.max(lineasComentarioEnvio, lineasComentarioRecepcion)
        alturaFila = Math.max(alturaFilaBase, maxLineasComentario * 4 + 8) // Más espacio para comentarios
        
        // Fondo alternado para filas (zebra striping) - más sutil
        if (filaIndex % 2 === 0) {
          pdf.setFillColor(252, 252, 252)
          pdf.rect(margin, yPos - 4, tableEndX - margin, alturaFila, 'F')
        }
        
        // Dibujar bordes de la fila - más sutiles y profesionales
        pdf.setDrawColor(220, 220, 220)
        pdf.setLineWidth(0.2)
        // Borde izquierdo
        pdf.line(margin, yPos - 4, margin, yPos - 4 + alturaFila)
        // Borde derecho
        pdf.line(tableEndX, yPos - 4, tableEndX, yPos - 4 + alturaFila)
        // Borde inferior
        pdf.line(margin, yPos - 4 + alturaFila, tableEndX, yPos - 4 + alturaFila)
        // Bordes verticales entre columnas
        pdf.line(pedidaX, yPos - 4, pedidaX, yPos - 4 + alturaFila)
        pdf.line(enviadaX, yPos - 4, enviadaX, yPos - 4 + alturaFila)
        pdf.line(recibidaX, yPos - 4, recibidaX, yPos - 4 + alturaFila)
        
        // Nombre del producto (con truncamiento si es muy largo)
        const nombreProducto = producto.productoNombre || "Producto sin nombre"
        const maxWidth = productoWidth - 4
        pdf.setFontSize(10)
        pdf.setTextColor(0, 0, 0)
        const nombreTruncado = pdf.splitTextToSize(nombreProducto, maxWidth)[0] || nombreProducto.substring(0, 30)
        pdf.text(nombreTruncado, productoX, yPos)
        
        // Cantidades
        pdf.text(
          (producto.cantidadPedida || 0).toString(),
          pedidaX + colWidth / 2,
          yPos,
          { align: "center" }
        )
        
        // Cantidad enviada con comentario debajo - mejor presentación
        pdf.setFont("helvetica", "bold")
        pdf.text(
          (producto.cantidadEnviada || 0).toString(),
          enviadaX + colWidth / 2,
          yPos,
          { align: "center" }
        )
        pdf.setFont("helvetica", "normal")
        // Comentario de envío debajo del número - diseño mejorado
        if (comentarioEnvio) {
          pdf.setFontSize(8)
          pdf.setFont("helvetica", "italic")
          pdf.setTextColor(70, 70, 70) // Color más oscuro para mejor legibilidad
          const maxComentarioWidth = colWidth - 8
          const comentarioTruncado = pdf.splitTextToSize(comentarioEnvio, maxComentarioWidth)
          let yComentarioEnvio = yPos + 6 // Más espacio del número
          comentarioTruncado.forEach((linea: string, idx: number) => {
            pdf.text(linea, enviadaX + colWidth / 2, yComentarioEnvio + (idx * 4), { align: "center", maxWidth: maxComentarioWidth })
          })
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(0, 0, 0)
        }
        
        // Calcular indicador visual para cantidad recibida
        const cantidadPedida = producto.cantidadPedida || 0
        const cantidadEnviada = producto.cantidadEnviada || 0
        const cantidadRecibida = producto.cantidadRecibida || 0
        
        let indicador = ""
        let colorIndicador = [0, 0, 0] // Negro por defecto
        
        if (cantidadRecibida > cantidadEnviada) {
          // Recibido más de lo enviado: flecha arriba
          indicador = "↑"
          colorIndicador = [0, 150, 0] // Verde
        } else if (cantidadRecibida < cantidadEnviada) {
          // Recibido menos de lo enviado: flecha abajo
          indicador = "↓"
          colorIndicador = [200, 0, 0] // Rojo
        } else if (cantidadRecibida === cantidadEnviada && cantidadRecibida !== cantidadPedida) {
          // No se recibió lo que se pidió (pero sí lo enviado): X
          indicador = "X"
          colorIndicador = [200, 0, 0] // Rojo
        }
        
        // Mostrar cantidad recibida con indicador - mejor presentación
        pdf.setFont("helvetica", "bold")
        const textoRecibida = cantidadRecibida.toString()
        pdf.text(
          textoRecibida,
          recibidaX + colWidth / 2 - (indicador ? 4 : 0),
          yPos,
          { align: "center" }
        )
        pdf.setFont("helvetica", "normal")
        
        // Mostrar indicador visual si existe
        if (indicador) {
          pdf.setFontSize(12)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(colorIndicador[0], colorIndicador[1], colorIndicador[2])
          pdf.text(
            indicador,
            recibidaX + colWidth / 2 + 6,
            yPos - 1,
            { align: "center" }
          )
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(0, 0, 0) // Restaurar color negro
        }
        
        // Comentario de recepción debajo del número - diseño mejorado
        if (comentarioRecepcion) {
          pdf.setFontSize(8)
          pdf.setFont("helvetica", "italic")
          pdf.setTextColor(70, 70, 70) // Color más oscuro para mejor legibilidad
          const maxComentarioWidth = colWidth - 8
          const comentarioTruncado = pdf.splitTextToSize(comentarioRecepcion, maxComentarioWidth)
          let yComentarioRecepcion = yPos + 6 // Más espacio del número
          comentarioTruncado.forEach((linea: string, idx: number) => {
            pdf.text(linea, recibidaX + colWidth / 2, yComentarioRecepcion + (idx * 4), { align: "center", maxWidth: maxComentarioWidth })
          })
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(0, 0, 0)
        }
        
        yPos += alturaFila
        filaIndex++
      }
    } else {
      // Mostrar 1 o 2 columnas para remitos intermedios
      const cantidad = remito.tipo === "recepcion" && producto.cantidadRecibida !== undefined
        ? producto.cantidadRecibida.toString()
        : producto.cantidadEnviada !== undefined
        ? producto.cantidadEnviada.toString()
        : (producto.cantidadPedida ?? producto.cantidad ?? 0).toString()

      // Para remitos intermedios, mostrar comentario debajo de la cantidad
      // Si es remito de envío, mostrar comentario de envío; si es recepción, mostrar comentario de recepción
      const comentarioIntermedio = remito.tipo === "envio" ? comentarioEnvio : comentarioRecepcion
      
      if (tieneComentarios) {
        const productoWidthIntermedio = (pdfWidth - margin * 2) * 0.6
        const colWidthIntermedio = (pdfWidth - margin * 2 - productoWidthIntermedio)
        const tableEndXIntermedio = pdfWidth - margin
        
        // Calcular altura de fila según comentarios
        let lineasComentario = 1
        if (comentarioIntermedio) {
          const maxComentarioWidth = colWidthIntermedio - 6
          const comentarioTruncado = pdf.splitTextToSize(comentarioIntermedio, maxComentarioWidth)
          lineasComentario = comentarioTruncado.length
        }
        const alturaFilaIntermedio = Math.max(alturaFilaBase, lineasComentario * 3.5 + 7)
        
        // Fondo alternado para filas (zebra striping)
        if (filaIndex % 2 === 0) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(margin, yPos - 4, tableEndXIntermedio - margin, alturaFilaIntermedio, 'F')
        }
        
        // Dibujar bordes de la fila
        pdf.setDrawColor(200, 200, 200)
        pdf.setLineWidth(0.3)
        pdf.line(margin, yPos - 4, margin, yPos - 4 + alturaFilaIntermedio) // Izquierdo
        pdf.line(tableEndXIntermedio, yPos - 4, tableEndXIntermedio, yPos - 4 + alturaFilaIntermedio) // Derecho
        pdf.line(margin, yPos - 4 + alturaFilaIntermedio, tableEndXIntermedio, yPos - 4 + alturaFilaIntermedio) // Inferior
        pdf.line(margin + productoWidthIntermedio, yPos - 4, margin + productoWidthIntermedio, yPos - 4 + alturaFilaIntermedio) // Entre producto y cantidad
        
        pdf.setFontSize(10)
        pdf.setTextColor(0, 0, 0)
        pdf.text(producto.productoNombre, margin + 3, yPos)
        pdf.text(cantidad, margin + productoWidthIntermedio + colWidthIntermedio / 2, yPos, { align: "center" })
        
        // Comentario debajo de la cantidad
        if (comentarioIntermedio) {
          pdf.setFontSize(8)
          pdf.setFont("helvetica", "italic")
          pdf.setTextColor(80, 80, 80)
          const maxComentarioWidth = colWidthIntermedio - 6
          const comentarioTruncado = pdf.splitTextToSize(comentarioIntermedio, maxComentarioWidth)
          let yComentario = yPos + 5
          comentarioTruncado.forEach((linea: string, idx: number) => {
            pdf.text(linea, margin + productoWidthIntermedio + colWidthIntermedio / 2, yComentario + (idx * 3.5), { align: "center", maxWidth: maxComentarioWidth })
          })
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(0, 0, 0)
        }
        
        yPos += alturaFilaIntermedio
      } else {
        const tableEndXIntermedio = pdfWidth - margin
        
        // Fondo alternado para filas (zebra striping)
        if (filaIndex % 2 === 0) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(margin, yPos - 4, tableEndXIntermedio - margin, alturaFilaBase, 'F')
        }
        
        // Dibujar bordes de la fila
        pdf.setDrawColor(200, 200, 200)
        pdf.setLineWidth(0.3)
        pdf.line(margin, yPos - 4, margin, yPos - 4 + alturaFilaBase) // Izquierdo
        pdf.line(tableEndXIntermedio, yPos - 4, tableEndXIntermedio, yPos - 4 + alturaFilaBase) // Derecho
        pdf.line(margin, yPos - 4 + alturaFilaBase, tableEndXIntermedio, yPos - 4 + alturaFilaBase) // Inferior
        
        pdf.setFontSize(10)
        pdf.setTextColor(0, 0, 0)
        pdf.text(producto.productoNombre, margin + 3, yPos)
        pdf.text(cantidad, pdfWidth - margin - 15, yPos, { align: "right" })
        
        yPos += alturaFilaBase
      }
      filaIndex++
    }
  })

  // Dibujar borde inferior final de la tabla
  if (remito.productos.length > 0) {
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.5)
    pdf.line(margin, yPos - 4, tableEndX, yPos - 4)
  }

  // Espacio después de la tabla
  yPos += 10

  // Definir altura del footer (se usa en todo el código)
  const footerHeight = 15

  // Procesar observaciones para separarlas por tipo (ENVÍO y RECEPCIÓN)
  // Mostrar TODAS las observaciones de envío (comentarios del armado)
  let observacionesEnvio = ""
  let observacionesRecepcion = ""
  if (remito.observaciones && remito.observaciones.trim()) {
    const partes = remito.observaciones.split('\n\n')
    partes.forEach(parte => {
      if (parte.startsWith('ENVÍO:')) {
        // Mostrar TODAS las observaciones de envío (comentarios del armado)
        const contenidoEnvio = parte.replace('ENVÍO:\n', '').trim()
        if (contenidoEnvio) {
          observacionesEnvio = contenidoEnvio
        }
      } else if (parte.startsWith('RECEPCIÓN:')) {
        // Para recepción, solo mostrar las que no tienen formato "Producto: observación" (ya están en la tabla)
        const contenidoRecepcion = parte.replace('RECEPCIÓN:\n', '').trim()
        const lineasRecepcion = contenidoRecepcion.split('\n')
        const observacionesGeneralesRecepcion = lineasRecepcion.filter(linea => !linea.match(/^(.+?):\s*(.+)$/))
        if (observacionesGeneralesRecepcion.length > 0) {
          observacionesRecepcion = observacionesGeneralesRecepcion.join('\n')
        }
      } else if (parte.startsWith('OBSERVACIONES GENERALES:')) {
        observacionesRecepcion = (observacionesRecepcion ? observacionesRecepcion + '\n' : '') + parte.replace('OBSERVACIONES GENERALES:\n', '').trim()
      }
    })
  }
  
  // Agregar observaciones generales si existen
  if (observacionesGenerales) {
    observacionesRecepcion = (observacionesRecepcion ? observacionesRecepcion + '\n' : '') + observacionesGenerales
  }

  // Sección de información y firmas (solo para remitos de recepción)
  if (remito.tipo === "recepcion") {
    // Verificar si hay espacio suficiente, si no, nueva página
    const espacioNecesario = 120 // Espacio aproximado necesario para toda la sección
    if (yPos > pdfHeight - footerHeight - espacioNecesario) {
      pdf.addPage()
      yPos = margin + 10
    }

    // Línea separadora
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.5)
    pdf.line(margin, yPos, pdfWidth - margin, yPos)
    yPos += 10

    // Sección de información en dos columnas
    const columnaAncho = (pdfWidth - margin * 2 - 10) / 2
    const tieneFirmaEnvio = remito.firmaEnvio
    const tieneFirmaRecepcion = remito.firmaRecepcion
    
    // Columna izquierda: Retiro de Fábrica
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    const horaRetiro = remito.horaRetiroFabrica || format(new Date(), "HH:mm", { locale: es })
    pdf.text("RETIRO DE FÁBRICA", margin, yPos)
    yPos += 6
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.text(`Hora: ${horaRetiro} Hs`, margin, yPos)
    yPos += 5
    
    // Observaciones de envío (comentarios del armado)
    if (observacionesEnvio && observacionesEnvio.trim()) {
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "italic")
      pdf.setTextColor(80, 80, 80)
      const maxWidth = columnaAncho - 5
      const observacionesTexto = pdf.splitTextToSize(observacionesEnvio.trim(), maxWidth)
      observacionesTexto.forEach((linea: string, idx: number) => {
        pdf.text(linea, margin + 2, yPos + (idx * 3.5))
      })
      yPos += observacionesTexto.length * 3.5 + 5
      pdf.setTextColor(0, 0, 0)
    }
    
    const yInicioColumnaIzq = yPos
    
    // Columna derecha: Recepción en Local
    const xColumnaDer = margin + columnaAncho + 10
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    const horaRecepcion = remito.horaRecepcionLocal || format(new Date(), "HH:mm", { locale: es })
    pdf.text("RECEPCIÓN EN LOCAL", xColumnaDer, yPos - (observacionesEnvio ? (observacionesEnvio.split('\n').length * 3.5 + 5) : 0))
    let yColumnaDer = yPos - (observacionesEnvio ? (observacionesEnvio.split('\n').length * 3.5 + 5) : 0) + 6
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.text(`Hora: ${horaRecepcion} Hs`, xColumnaDer, yColumnaDer)
    yColumnaDer += 5
    
    // Observaciones de recepción
    if (observacionesRecepcion && observacionesRecepcion.trim()) {
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "italic")
      pdf.setTextColor(80, 80, 80)
      const maxWidth = columnaAncho - 5
      const observacionesTexto = pdf.splitTextToSize(observacionesRecepcion.trim(), maxWidth)
      observacionesTexto.forEach((linea: string, idx: number) => {
        pdf.text(linea, xColumnaDer + 2, yColumnaDer + (idx * 3.5))
      })
      yColumnaDer += observacionesTexto.length * 3.5 + 5
      pdf.setTextColor(0, 0, 0)
    }
    
    // Ajustar yPos al máximo de ambas columnas
    yPos = Math.max(yInicioColumnaIzq, yColumnaDer) + 10
    
    // Firmas una al lado de la otra
    if (tieneFirmaEnvio || tieneFirmaRecepcion) {
      // Línea separadora antes de firmas
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPos, pdfWidth - margin, yPos)
      yPos += 10
      
      // Calcular ancho disponible para cada firma
      const espacioEntreFirmas = 10
      const anchoFirma = (pdfWidth - margin * 2 - espacioEntreFirmas) / 2
      const alturaFirma = 35
      const yInicioFirmas = yPos
      
      // Firma de envío (izquierda)
      if (tieneFirmaEnvio) {
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.text("FIRMA REPARTIDOR", margin, yInicioFirmas)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(8)
        pdf.text(remito.firmaEnvio.nombre, margin, yInicioFirmas + 5)
        const yImagenEnvio = yInicioFirmas + 10
        
        // Agregar imagen de firma si existe
        if (remito.firmaEnvio.firma) {
          try {
            pdf.addImage(remito.firmaEnvio.firma, "PNG", margin, yImagenEnvio, anchoFirma, alturaFirma)
          } catch (error) {
            console.error("Error al agregar imagen de firma de envío:", error)
          }
        } else {
          // Línea para firma manual
          pdf.setDrawColor(0, 0, 0)
          pdf.setLineWidth(0.5)
          pdf.line(margin, yImagenEnvio + alturaFirma - 5, margin + anchoFirma, yImagenEnvio + alturaFirma - 5)
        }
      }
      
      // Firma de recepción (derecha)
      if (tieneFirmaRecepcion) {
        const xFirmaRecepcion = tieneFirmaEnvio ? margin + anchoFirma + espacioEntreFirmas : margin
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.text("FIRMA EN RECEPCIÓN", xFirmaRecepcion, yInicioFirmas)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(8)
        pdf.text(remito.firmaRecepcion.nombre, xFirmaRecepcion, yInicioFirmas + 5)
        const yImagenRecepcion = yInicioFirmas + 10
        
        // Agregar imagen de firma si existe
        if (remito.firmaRecepcion.firma) {
          try {
            pdf.addImage(remito.firmaRecepcion.firma, "PNG", xFirmaRecepcion, yImagenRecepcion, anchoFirma, alturaFirma)
          } catch (error) {
            console.error("Error al agregar imagen de firma de recepción:", error)
          }
        } else {
          // Línea para firma manual
          pdf.setDrawColor(0, 0, 0)
          pdf.setLineWidth(0.5)
          pdf.line(xFirmaRecepcion, yImagenRecepcion + alturaFirma - 5, xFirmaRecepcion + anchoFirma, yImagenRecepcion + alturaFirma - 5)
        }
      }
      
      yPos = yInicioFirmas + alturaFirma + 5
    }
  }

  // Para remitos que no sean de recepción, mostrar observaciones normalmente
  if (remito.tipo !== "recepcion" && remito.observaciones && remito.observaciones.trim()) {
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    pdf.text("Observaciones:", margin, yPos)
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")
    const observaciones = pdf.splitTextToSize(remito.observaciones, pdfWidth - margin * 2)
    pdf.text(observaciones, margin + 2, yPos + 5)
    yPos += observaciones.length * 4 + 7
  }

  // Agregar footer en todas las páginas
  const totalPages = pdf.internal.pages.length - 1
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    
    // Línea separadora del footer
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, pdfHeight - footerHeight, pdfWidth - margin, pdfHeight - footerHeight)
    
    // Texto del footer
    pdf.setFontSize(7)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)
    const empresaFooter = nombreEmpresa || "PANIFICADOS Y EMPANADAS SANTA"
    const footerText = `${empresaFooter} - Remito N°${remito.numero} - Página ${i} de ${totalPages}`
    pdf.text(footerText, pdfWidth / 2, pdfHeight - footerHeight + 5, { align: "center" })
    pdf.text(fechaTexto, pdfWidth / 2, pdfHeight - footerHeight + 10, { align: "center" })
    pdf.setTextColor(0, 0, 0) // Restaurar color negro
  }

  // Volver a la última página
  pdf.setPage(totalPages)

  // Descargar PDF
  const nombreArchivo = `remito-${remito.numero}-${fechaTexto.replace(/\//g, "-")}.pdf`
  pdf.save(nombreArchivo)
}
