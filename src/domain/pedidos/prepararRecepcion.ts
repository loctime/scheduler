import { validarRecepcion, calcularCantidadDevolucion } from "./recepcionRules"
import type { ProductoEnvio, RecepcionInput, ProductoRecepcion } from "./types"

export function prepararRecepcion(
  productosEnviados: ProductoEnvio[],
  recepcionInput: Record<string, RecepcionInput>
): { ok: true; productos: ProductoRecepcion[] } | { ok: false; errores: Array<{ productoId: string; mensaje: string }> } {
  // Validar usando las reglas del dominio
  const validacion = validarRecepcion(productosEnviados, recepcionInput)
  if (!validacion.ok) {
    return { ok: false, errores: validacion.errores }
  }

  // Construir productos de recepción
  const productos: ProductoRecepcion[] = productosEnviados.map((producto) => {
    const data = recepcionInput[producto.productoId] || {
      productoId: producto.productoId,
      cantidadRecibida: producto.cantidadEnviada,
      esDevolucion: false,
    }

    // Calcular cantidad a devolver usando función del dominio
    const cantidadDevolucion = calcularCantidadDevolucion(
      producto.cantidadEnviada,
      data.cantidadRecibida,
      data.esDevolucion || false
    )

    // Construir objeto ProductoRecepcion
    const productoRecepcion: ProductoRecepcion = {
      productoId: producto.productoId,
      productoNombre: producto.productoNombre,
      cantidadEnviada: producto.cantidadEnviada,
      cantidadRecibida: data.cantidadRecibida,
      estado: "ok",
      esDevolucion: data.esDevolucion || false,
    }

    // Solo incluir cantidadDevolucion si es mayor a 0
    if (cantidadDevolucion > 0) {
      productoRecepcion.cantidadDevolucion = cantidadDevolucion
    }

    // Incluir observaciones si existen
    if (data.observaciones?.trim()) {
      productoRecepcion.observaciones = data.observaciones.trim()
    }

    return productoRecepcion
  })

  return { ok: true, productos }
}
