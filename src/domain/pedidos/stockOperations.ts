import type { ProductoRecepcion } from "./types"

export function aplicarRecepcionAStock(
  stockActual: Record<string, number>,
  productos: Array<Pick<ProductoRecepcion, "productoId" | "cantidadRecibida">>
): Record<string, number> {
  const actualizado: Record<string, number> = { ...stockActual }

  productos.forEach((producto) => {
    if (producto.cantidadRecibida <= 0) return

    const actual = actualizado[producto.productoId] ?? 0
    actualizado[producto.productoId] = actual + producto.cantidadRecibida
  })

  return actualizado
}
