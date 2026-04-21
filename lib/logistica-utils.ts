import type { PedidoFabrica } from "@/lib/logistica-types"
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"

export function buildAutoPedidosPorOperador(
  grupoPedidoId: string,
  grupoPedidoNombre: string,
  destinoLocationId: string,
  destinoNombre: string,
  stockFilas: StockUbicacion[],
  pedidosGrupo: PedidoFabrica[],
  nombrePorLocationId: Map<string, string>
): PedidoFabrica[] {
  const pedidoCantidadByOrigenProducto = new Map<string, number>()
  for (const p of pedidosGrupo) {
    const origenId = p.origenLocationId
    for (const it of p.items) {
      const k = `${origenId}::${it.productoId}`
      pedidoCantidadByOrigenProducto.set(k, (pedidoCantidadByOrigenProducto.get(k) ?? 0) + (it.cantidadPedida ?? 0))
    }
  }

  const itemsByOrigen = new Map<string, PedidoFabrica["items"]>()
  for (const fila of stockFilas) {
    if (fila.grupoCatalogoId !== grupoPedidoId) continue
    const faltante = Math.max(0, Math.floor((fila.stockMinimo ?? 0) - (fila.stockActual ?? 0)))
    if (faltante <= 0) continue

    const origenLocationId = fila.locationId
    const k = `${origenLocationId}::${fila.catalogoId}`
    const yaPedido = pedidoCantidadByOrigenProducto.get(k) ?? 0
    const cantidad = Math.max(0, faltante - yaPedido)
    if (cantidad <= 0) continue

    const list = itemsByOrigen.get(origenLocationId) ?? []
    list.push({
      productoId: fila.catalogoId,
      productoNombre: fila.nombre,
      cantidadSugerida: cantidad,
      cantidadPedida: cantidad,
    })
    itemsByOrigen.set(origenLocationId, list)
  }

  const out: PedidoFabrica[] = []
  itemsByOrigen.forEach((items, origenLocationId) => {
    if (!items.length) return
    out.push({
      id: `auto_${grupoPedidoId}_${origenLocationId}`,
      ownerId: "",
      origenLocationId,
      origenNombre: nombrePorLocationId.get(origenLocationId) ?? origenLocationId,
      destinoLocationId,
      destinoNombre,
      grupoPedidoId,
      grupoPedidoNombre,
      estado: "enviado",
      esPendiente: false,
      controlado: false,
      items,
      creadoEn: null,
      creadoPor: "",
      creadoPorEmail: "",
      actualizadoEn: null,
    })
  })

  out.sort((a, b) => a.origenNombre.localeCompare(b.origenNombre))
  return out
}
