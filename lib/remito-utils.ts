import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Remito, Pedido, Producto } from "./types"

/**
 * Normaliza el nombre del pedido para usar en la numeración de remitos
 */
function normalizarNombrePedido(nombre: string): string {
  return nombre
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") // Solo letras y números
    .substring(0, 10) // Máximo 10 caracteres
    || "PEDIDO" // Fallback si está vacío
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
  calcularPedido: (stockMinimo: number, stockActual?: number) => number
): Omit<Remito, "id" | "numero" | "createdAt"> {
  const productosAPedir = productos
    .filter(p => calcularPedido(p.stockMinimo, stockActual[p.id]) > 0)
    .map(p => ({
      productoId: p.id,
      productoNombre: p.nombre,
      cantidadPedida: calcularPedido(p.stockMinimo, stockActual[p.id]),
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
    .map(p => ({
      productoId: p.id,
      productoNombre: p.nombre,
      cantidadPedida: calcularPedido(p.stockMinimo, stockActual[p.id]),
    }))

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
  // Obtener solo los productos que están disponibles y tienen cantidad a enviar
  const productosRemito = productos
    .filter(p => {
      const disponible = productosDisponibles[p.id]
      return disponible?.disponible && (disponible.cantidadEnviada ?? 0) > 0
    })
    .map(p => {
      const disponible = productosDisponibles[p.id]
      // Usar cantidadPedida del snapshot si existe (en productos del enlace público), sino stockMinimo
      const cantidadPedida = (p as any).cantidadPedida || p.stockMinimo || 0
      return {
        productoId: p.id,
        productoNombre: p.nombre,
        cantidadPedida: cantidadPedida,
        cantidadEnviada: disponible?.cantidadEnviada || 0,
      }
    })

  // Recolectar observaciones de todos los productos
  const observaciones = productos
    .map(p => {
      const disponible = productosDisponibles[p.id]
      if (disponible?.observaciones) {
        return `${p.nombre}: ${disponible.observaciones}`
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

  // Solo incluir observaciones si hay contenido
  if (observaciones && observaciones.trim().length > 0) {
    remitoData.observaciones = observaciones
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
      productoNombre: p.productoNombre,
      cantidadPedida: p.cantidadPedida || 0,
      cantidadEnviada: 0,
      cantidadRecibida: 0,
    })
  })

  // Actualizar con datos de envío
  productosEnvioMap.forEach((p, id) => {
    const consolidado = productosConsolidados.get(id) || {
      productoId: id,
      productoNombre: p.productoNombre,
      cantidadPedida: p.cantidadPedida || 0,
      cantidadEnviada: 0,
      cantidadRecibida: 0,
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
      productoNombre: p.productoNombre,
      cantidadPedida: 0,
      cantidadEnviada: 0,
      cantidadRecibida: 0,
    }
    consolidado.cantidadRecibida = p.cantidadRecibida || 0
    if (!consolidado.cantidadEnviada && p.cantidadEnviada) {
      consolidado.cantidadEnviada = p.cantidadEnviada
    }
    if (!consolidado.cantidadPedida && p.cantidadEnviada) {
      consolidado.cantidadPedida = p.cantidadEnviada
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

  // Construir el objeto del remito final
  const remitoData: any = {
    pedidoId: pedido.id,
    tipo: "recepcion",
    fecha: recepcion.fecha || new Date(),
    desde: pedido.destinoDefault || "FABRICA",
    hacia: pedido.origenDefault || "LOCAL",
    productos: productosConsolidados,
    final: true, // Marcar como remito final
    userId: pedido.userId,
  }

  // Solo incluir observaciones si hay contenido
  if (recepcion.observaciones && recepcion.observaciones.trim().length > 0) {
    remitoData.observaciones = recepcion.observaciones
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
export async function generarPDFRemito(remito: Remito): Promise<void> {
  const jsPDF = (await import("jspdf")).default
  
  const pdf = new jsPDF("p", "mm", "a4")
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  let yPos = margin

  // Título
  pdf.setFontSize(16)
  pdf.setFont(undefined, "bold")
  const titulo = remito.tipo === "pedido"
    ? "PEDIDO PANIFICADOS Y EMPANADAS SANTA"
    : remito.tipo === "envio" 
    ? "ENTREGA PANIFICADOS Y EMPANADAS SANTA"
    : remito.tipo === "recepcion"
    ? "RECEPCIÓN PANIFICADOS Y EMPANADAS SANTA"
    : "DEVOLUCIÓN PANIFICADOS Y EMPANADAS SANTA"
  pdf.text(titulo, pdfWidth / 2, yPos, { align: "center" })
  yPos += 10

  // Número de remito (esquina superior derecha)
  pdf.setFontSize(12)
  pdf.setFont(undefined, "normal")
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

  // Partida y Entrega
  pdf.setFontSize(10)
  pdf.text(`PARTIDA: ${remito.desde} / LOCAL:`, margin, yPos)
  pdf.text(`ENTREGA: ${remito.hacia} / LOCAL:`, margin, yPos + 5)
  yPos += 12

  // Línea separadora
  pdf.setDrawColor(0, 0, 0)
  pdf.line(margin, yPos, pdfWidth - margin, yPos)
  yPos += 5

  // Tabla de productos
  pdf.setFontSize(10)
  pdf.setFont(undefined, "bold")
  
  // Si es remito final (recepcion con final=true), mostrar 3 columnas
  const esRemitoFinal = remito.final && remito.tipo === "recepcion"
  
  if (esRemitoFinal) {
    // Encabezado con 3 columnas
    pdf.text("PRODUCTO", margin, yPos)
    const colWidth = (pdfWidth - margin * 2) / 3
    pdf.text("PEDIDA", margin + colWidth, yPos, { align: "center" })
    pdf.text("ENVIADA", margin + colWidth * 2, yPos, { align: "center" })
    pdf.text("RECIBIDA", pdfWidth - margin, yPos, { align: "right" })
  } else {
    // Encabezado con 1 columna
    pdf.text("PRODUCTO", margin, yPos)
    pdf.text("CANTIDAD", pdfWidth - margin - 30, yPos, { align: "right" })
  }
  yPos += 5

  // Línea debajo del encabezado
  pdf.line(margin, yPos, pdfWidth - margin, yPos)
  yPos += 3

  // Productos
  pdf.setFont(undefined, "normal")
  remito.productos.forEach((producto) => {
    if (yPos > pdfHeight - 60) {
      pdf.addPage()
      yPos = margin + 10
    }

    if (esRemitoFinal) {
      // Mostrar 3 columnas para remito final
      const colWidth = (pdfWidth - margin * 2) / 3
      pdf.text(producto.productoNombre, margin + 2, yPos)
      pdf.text(
        (producto.cantidadPedida || 0).toString(),
        margin + colWidth,
        yPos,
        { align: "center" }
      )
      pdf.text(
        (producto.cantidadEnviada || 0).toString(),
        margin + colWidth * 2,
        yPos,
        { align: "center" }
      )
      pdf.text(
        (producto.cantidadRecibida || 0).toString(),
        pdfWidth - margin,
        yPos,
        { align: "right" }
      )
    } else {
      // Mostrar 1 columna para remitos intermedios
      const cantidad = remito.tipo === "recepcion" && producto.cantidadRecibida !== undefined
        ? producto.cantidadRecibida.toString()
        : producto.cantidadEnviada !== undefined
        ? producto.cantidadEnviada.toString()
        : producto.cantidadPedida.toString()

      pdf.text(producto.productoNombre, margin + 2, yPos)
      pdf.text(cantidad, pdfWidth - margin - 30, yPos, { align: "right" })
    }
    yPos += 6
  })

  // Espacio para firmas
  yPos = pdfHeight - 50

  // Línea separadora antes de firmas
  pdf.line(margin, yPos, pdfWidth - margin, yPos)
  yPos += 8

  // Retiro de Fábrica
  pdf.setFontSize(9)
  pdf.text("Retiro de Fabrica: .......... Hs", margin, yPos)
  if (remito.firmaEnvio) {
    pdf.text(`Firma repartidor: ${remito.firmaEnvio.nombre}`, margin, yPos + 5)
  } else {
    pdf.text("Firma repartidor:", margin, yPos + 5)
  }
  yPos += 12

  // Recepción en Local
  pdf.text("Recepcion en Local: .......... Hs", margin, yPos)
  if (remito.firmaRecepcion) {
    pdf.text(`Firma en recepcion: ${remito.firmaRecepcion.nombre}`, margin, yPos + 5)
  } else {
    pdf.text("Firma en recepcion:", margin, yPos + 5)
  }
  yPos += 12

  // Observaciones
  pdf.text("Observaciones:", margin, yPos)
  if (remito.observaciones) {
    pdf.setFontSize(8)
    const observaciones = pdf.splitTextToSize(remito.observaciones, pdfWidth - margin * 2)
    pdf.text(observaciones, margin + 2, yPos + 5)
  }

  // Descargar PDF
  const nombreArchivo = `remito-${remito.numero}-${fechaTexto.replace(/\//g, "-")}.pdf`
  pdf.save(nombreArchivo)
}
