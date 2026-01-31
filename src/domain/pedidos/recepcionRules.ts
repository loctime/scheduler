import type { ProductoEnvio, RecepcionInput, RecepcionValidationError } from "./types"

const DEFAULT_RECEPCION: Pick<RecepcionInput, "cantidadRecibida" | "esDevolucion"> = {
  cantidadRecibida: 0,
  esDevolucion: false,
}

export function validarRecepcion(
  productosEnviados: ProductoEnvio[],
  recepcion: Record<string, RecepcionInput>
): { ok: true } | { ok: false; errores: RecepcionValidationError[] } {
  const errores: RecepcionValidationError[] = []

  productosEnviados.forEach((producto) => {
    const data = recepcion[producto.productoId] ?? {
      ...DEFAULT_RECEPCION,
      cantidadRecibida: producto.cantidadEnviada,
    }

    if (data.esDevolucion) {
      if (data.cantidadRecibida >= producto.cantidadEnviada) {
        errores.push({
          productoId: producto.productoId,
          mensaje: `No se puede marcar devolución para "${producto.productoNombre}" si no hay faltantes.`,
        })
      }

      if (!data.observaciones || !data.observaciones.trim()) {
        errores.push({
          productoId: producto.productoId,
          mensaje: `El producto "${producto.productoNombre}" requiere un comentario obligatorio para devoluciones.`,
        })
      }
    }
  })

  if (errores.length > 0) {
    return { ok: false, errores }
  }

  return { ok: true }
}

export function calcularCantidadDevolucion(
  cantidadEnviada: number,
  cantidadRecibida: number,
  esDevolucion: boolean
): number {
  if (!esDevolucion) return 0

  if (cantidadRecibida >= cantidadEnviada) {
    return 0
  }

  return cantidadEnviada - cantidadRecibida
}
