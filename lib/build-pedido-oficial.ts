import { ejecutarPedidoEngine, type PedidoEngineOutput, type PedidoEngineProduct } from "./pedido-engine"

export interface BuildPedidoOficialOptions {
  pedido: {
    nombre: string
    formatoSalida?: string
    mensajePrevio?: string
  }
  productos: PedidoEngineProduct[]
  stockActual: Record<string, number>
  ajustesPedido?: Record<string, number>
  cantidadesManuales?: Record<string, number>
  usarCantidadesManuales?: boolean
}

export function buildPedidoOficial(options: BuildPedidoOficialOptions): PedidoEngineOutput | null {
  const {
    pedido,
    productos,
    stockActual,
    ajustesPedido = {},
    cantidadesManuales = {},
    usarCantidadesManuales = false,
  } = options

  if (!pedido?.nombre) {
    return null
  }

  return ejecutarPedidoEngine({
    pedido: {
      nombre: pedido.nombre,
      formatoSalida: pedido.formatoSalida || "{nombre}: {cantidad} {unidad}",
      mensajePrevio: pedido.mensajePrevio,
    },
    productos,
    stockActual,
    ajustesPedido,
    cantidadesManuales,
    usarCantidadesManuales,
  })
}
