import { esModoPack, unidadesToPacks, packsToUnidades, unidadesToPacksFloor } from "@/lib/unidades-utils"

export interface PedidoEngineInput {
  pedido: {
    nombre: string
    formatoSalida: string
    mensajePrevio?: string
  }
  productos: Array<{
    id: string
    nombre: string
    stockMinimo: number
    modoCompra?: "unidad" | "pack" | string
    cantidadPorPack?: number
    unidadBase?: string
    unidad?: string
  }>
  stockActual: Record<string, number>
  ajustesPedido?: Record<string, number>
  calcularPedido: (stockMinimo: number, stockActual?: number) => number
}

export interface PedidoEngineOutput {
  productosCalculados: Array<{
    productoId: string
    nombre: string
    cantidadUnidades: number
    cantidadPacks: number
    unidad: string
  }>
  cantidadesPedidas: Record<string, number>
  texto: string
  totalProductos: number
}

export function ejecutarPedidoEngine({
  pedido,
  productos,
  stockActual,
  ajustesPedido = {},
  calcularPedido,
}: PedidoEngineInput): PedidoEngineOutput {

  const productosCalculados: PedidoEngineOutput["productosCalculados"] = []
  const cantidadesPedidas: Record<string, number> = {}

  for (const producto of productos) {
    const stockActualProducto = stockActual[producto.id] ?? 0

    const pedidoBase = calcularPedido(producto.stockMinimo, stockActualProducto)
    const ajuste = ajustesPedido[producto.id] ?? 0

    let cantidadUnidades = 0
    let cantidadPacks = 0

    if (esModoPack(producto as any)) {
      const pedidoBasePacks = unidadesToPacks(producto as any, pedidoBase)
      const totalPacks = Math.max(0, pedidoBasePacks + ajuste)

      cantidadUnidades = packsToUnidades(producto as any, totalPacks)
      cantidadPacks = totalPacks
    } else {
      cantidadUnidades = Math.max(0, pedidoBase + ajuste)
      cantidadPacks = cantidadUnidades
    }

    if (cantidadUnidades > 0) {
      const unidad = producto.unidadBase || producto.unidad || "U"

      productosCalculados.push({
        productoId: producto.id,
        nombre: producto.nombre,
        cantidadUnidades,
        cantidadPacks: esModoPack(producto as any)
          ? unidadesToPacksFloor(producto as any, cantidadUnidades)
          : cantidadUnidades,
        unidad,
      })

      cantidadesPedidas[producto.id] = cantidadUnidades
    }
  }

  const lineas = productosCalculados.map((p) => {
    let texto = pedido.formatoSalida

    texto = texto.replace(/{nombre}/g, p.nombre)
    texto = texto.replace(/{cantidad}/g, p.cantidadUnidades.toString())
    texto = texto.replace(/{cantidadUnidades}/g, p.cantidadUnidades.toString())
    texto = texto.replace(/{cantidadPacks}/g, p.cantidadPacks.toString())
    texto = texto.replace(/{unidad}/g, p.unidad)

    return texto.trim()
  })

  const encabezado =
    pedido.mensajePrevio?.trim() || `📦 ${pedido.nombre}`

  const textoFinal = `${encabezado}\n\n${lineas.join("\n")}\n\nTotal: ${productosCalculados.length} productos`

  return {
    productosCalculados,
    cantidadesPedidas,
    texto: textoFinal,
    totalProductos: productosCalculados.length,
  }
}
