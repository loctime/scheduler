import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Remito, Pedido, Producto } from "./types"

/**
 * Genera un número de remito único en formato REM-001, REM-002, etc.
 */
export async function generarNumeroRemito(
  db: any,
  COLLECTIONS: any
): Promise<string> {
  try {
    const { collection, query, orderBy, limit, getDocs } = await import("firebase/firestore")
    const remitosRef = collection(db, COLLECTIONS.REMITOS)
    const q = query(remitosRef, orderBy("numero", "desc"), limit(1))
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) {
      return "REM-001"
    }
    
    const ultimoNumero = snapshot.docs[0].data().numero
    const numero = parseInt(ultimoNumero.split("-")[1]) + 1
    return `REM-${String(numero).padStart(3, "0")}`
  } catch (error) {
    // Si hay error, generar número basado en timestamp
    const timestamp = Date.now()
    return `REM-${String(timestamp).slice(-6)}`
  }
}

/**
 * Genera un remito de envío (pedido → fábrica)
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
 * Genera un remito de recepción (fábrica → local)
 */
export function crearRemitoRecepcion(
  pedido: Pedido,
  recepcion: any
): Omit<Remito, "id" | "numero" | "createdAt"> {
  return {
    pedidoId: pedido.id,
    tipo: "recepcion",
    fecha: recepcion.fecha || new Date(),
    desde: pedido.destinoDefault || "FABRICA",
    hacia: pedido.origenDefault || "LOCAL",
    productos: recepcion.productos.map((p: any) => ({
      productoId: p.productoId,
      productoNombre: p.productoNombre,
      cantidadPedida: p.cantidadEnviada || 0,
      cantidadEnviada: p.cantidadEnviada,
      cantidadRecibida: p.cantidadRecibida,
    })),
    observaciones: recepcion.observaciones,
    userId: pedido.userId,
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
  const titulo = remito.tipo === "envio" 
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
  pdf.text("PRODUCTO", margin, yPos)
  pdf.text("CANTIDAD", pdfWidth - margin - 30, yPos, { align: "right" })
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

    const cantidad = remito.tipo === "recepcion" && producto.cantidadRecibida !== undefined
      ? producto.cantidadRecibida.toString()
      : producto.cantidadEnviada !== undefined
      ? producto.cantidadEnviada.toString()
      : producto.cantidadPedida.toString()

    pdf.text(producto.productoNombre, margin + 2, yPos)
    pdf.text(cantidad, pdfWidth - margin - 30, yPos, { align: "right" })
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
