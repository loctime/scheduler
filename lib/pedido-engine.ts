import {
  esModoPack,
  formatStockForDisplay,
  getStockMinimoUnits,
  unitsToPacks,
  type ProductoLike,
} from "./unidades-utils"

export interface PedidoEngineProduct extends ProductoLike {
  id: string
  nombre: string
}

export interface PedidoEngineInput {
  pedido: {
    nombre: string
    formatoSalida: string
    mensajePrevio?: string
  }
  productos: PedidoEngineProduct[]
  stockActual: Record<string, number>
  ajustesPedido?: Record<string, number>
  cantidadesManuales?: Record<string, number>
  usarCantidadesManuales?: boolean
}

export interface PedidoCalculado {
  productoId: string
  nombre: string
  cantidadUnidades: number
  cantidadPacks: number
  unidad: string
  stockMinimoUnits: number
  stockActualUnits: number
  display: ReturnType<typeof formatStockForDisplay>
}

export interface PedidoEngineOutput {
  productosCalculados: PedidoCalculado[]
  cantidadesPedidas: Record<string, number>
  texto: string
  totalProductos: number
}

export function calcularPedidoSugerido(stockMinimoUnits: number, stockActualUnits: number): number {
  return Math.max(0, Math.floor(stockMinimoUnits) - Math.max(0, Math.floor(stockActualUnits)))
}

export function getPedidoSugeridoUnits(producto: PedidoEngineProduct, stockActualUnits: number): number {
  return calcularPedidoSugerido(getStockMinimoUnits(producto), stockActualUnits)
}

export function ejecutarPedidoEngine({
  pedido,
  productos,
  stockActual,
  ajustesPedido = {},
  cantidadesManuales = {},
  usarCantidadesManuales = false,
}: PedidoEngineInput): PedidoEngineOutput {
  const productosCalculados: PedidoCalculado[] = []
  const cantidadesPedidas: Record<string, number> = {}

  for (const producto of productos) {
    const stockMinimoUnits = getStockMinimoUnits(producto)
    const stockActualUnits = Math.max(0, Math.floor(stockActual[producto.id] ?? 0))
    const baseUnits = usarCantidadesManuales
      ? Math.max(0, Math.floor(cantidadesManuales[producto.id] ?? 0))
      : getPedidoSugeridoUnits(producto, stockActualUnits)
    const ajusteUnits = usarCantidadesManuales ? 0 : Math.floor(ajustesPedido[producto.id] ?? 0)
    const cantidadUnidades = Math.max(0, baseUnits + ajusteUnits)

    if (cantidadUnidades <= 0) {
      continue
    }

    const unidad = producto.unidadBase || producto.unidad || "U"
    const cantidadPacks = esModoPack(producto)
      ? unitsToPacks(cantidadUnidades, producto.cantidadPorPack ?? 1)
      : cantidadUnidades

    const calculado: PedidoCalculado = {
      productoId: producto.id,
      nombre: producto.nombre,
      cantidadUnidades,
      cantidadPacks,
      unidad,
      stockMinimoUnits,
      stockActualUnits,
      display: formatStockForDisplay(producto, cantidadUnidades),
    }

    productosCalculados.push(calculado)
    cantidadesPedidas[producto.id] = cantidadUnidades
  }

  const lineas = productosCalculados.map((producto) => {
    let texto = pedido.formatoSalida
    texto = texto.replace(/{nombre}/g, producto.nombre)
    texto = texto.replace(/{cantidad}/g, producto.cantidadUnidades.toString())
    texto = texto.replace(/{cantidadUnidades}/g, producto.cantidadUnidades.toString())
    texto = texto.replace(/{cantidadPacks}/g, producto.cantidadPacks.toString())
    texto = texto.replace(/{unidad}/g, producto.unidad)
    
    // Si el formato no tiene placeholders específicos, usar formato inteligente
    if (!texto.includes('{') && !texto.includes('}')) {
      if (esModoPack(producto)) {
        texto = `${producto.nombre}: ${producto.cantidadPacks} pack${producto.cantidadPacks !== 1 ? 's' : ''} ${producto.unidad}`
      } else {
        texto = `${producto.nombre}: ${producto.cantidadUnidades} ${producto.unidad}`
      }
    }
    
    return texto.trim()
  })

  const encabezado = pedido.mensajePrevio?.trim() || `[Pedido] ${pedido.nombre}`
  const texto = lineas.length > 0
    ? `${encabezado}\n\n${lineas.join("\n")}\n\nTotal: ${productosCalculados.length} productos`
    : `${encabezado}\n\nTotal: 0 productos`

  return {
    productosCalculados,
    cantidadesPedidas,
    texto,
    totalProductos: productosCalculados.length,
  }
}
