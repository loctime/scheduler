import { ejecutarPedidoEngine, type PedidoEngineOutput } from "./pedido-engine"

export interface BuildPedidoOficialOptions {
  pedido: {
    nombre: string
    formatoSalida?: string
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
  cantidadesManuales?: Record<string, number>
  usarCantidadesManuales?: boolean
}

/**
 * Función oficial unificada para generar pedidos.
 * 
 * Modos de operación:
 * 1. Modo automático (default): Calcula cantidades basadas en stock mínimo
 * 2. Modo manual: Usa cantidades explícitas proporcionadas
 * 
 * @param options Opciones de configuración del pedido
 * @returns Resultado del engine con texto y cantidades calculadas
 */
export function buildPedidoOficial(options: BuildPedidoOficialOptions): PedidoEngineOutput | null {
  const {
    pedido,
    productos,
    stockActual,
    ajustesPedido = {},
    cantidadesManuales = {},
    usarCantidadesManuales = false
  } = options

  if (!pedido?.nombre) {
    return null
  }

  // Función de cálculo según el modo
  const calcularPedido = usarCantidadesManuales
    ? (stockMinimo: number, stockActualProducto?: number) => {
        // En modo manual, ignoramos stockMinimo y stockActualProducto
        // Usamos las cantidades manuales proporcionadas
        return 0 // El engine usará cantidadesManuales directamente
      }
    : (stockMinimo: number, stockActualProducto?: number) => {
        // Modo automático: calcular basado en stock mínimo
        const actual = stockActualProducto ?? 0
        return Math.max(0, stockMinimo - actual)
      }

  // Ejecutar el engine con la configuración apropiada
  const resultado = ejecutarPedidoEngine({
    pedido: {
      nombre: pedido.nombre,
      formatoSalida: pedido.formatoSalida || "{nombre}: {cantidad} {unidad}",
      mensajePrevio: pedido.mensajePrevio
    },
    productos,
    stockActual,
    ajustesPedido,
    calcularPedido
  })

  // Si estamos en modo manual, procesar todos los productos con cantidades manuales
  if (usarCantidadesManuales) {
    const productosCalculados = productos
      .map(producto => {
        const cantidadManual = cantidadesManuales[producto.id] || 0
        if (cantidadManual <= 0) return null
        
        const unidad = producto.unidadBase || producto.unidad || "U"
        
        return {
          productoId: producto.id,
          nombre: producto.nombre,
          cantidadUnidades: cantidadManual,
          cantidadPacks: cantidadManual, // Simplificado: packs = unidades en modo manual
          unidad
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null) // Solo productos con cantidad > 0

    const cantidadesPedidas: Record<string, number> = {}
    productosCalculados.forEach(p => {
      cantidadesPedidas[p.productoId] = p.cantidadUnidades
    })

    // Regenerar el texto con las cantidades manuales
    const lineas = productosCalculados.map((p) => {
      let texto = pedido.formatoSalida || "{nombre}: {cantidad} {unidad}"
      texto = texto.replace(/{nombre}/g, p.nombre)
      texto = texto.replace(/{cantidad}/g, p.cantidadUnidades.toString())
      texto = texto.replace(/{cantidadUnidades}/g, p.cantidadUnidades.toString())
      texto = texto.replace(/{cantidadPacks}/g, p.cantidadPacks.toString())
      texto = texto.replace(/{unidad}/g, p.unidad)
      return texto.trim()
    })

    const encabezado = pedido.mensajePrevio?.trim() || `📦 ${pedido.nombre}`
    const textoFinal = `${encabezado}\n\n${lineas.join("\n")}\n\nTotal: ${productosCalculados.length} productos`

    return {
      productosCalculados,
      cantidadesPedidas,
      texto: textoFinal,
      totalProductos: productosCalculados.length
    }
  }

  return resultado
}
