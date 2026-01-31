import { prepararRecepcion } from "../../domain/pedidos/prepararRecepcion"
import { aplicarRecepcionAStock } from "../../domain/pedidos/stockOperations"
import { transicionarEstadoPedido } from "../../domain/pedidos/pedidoState"
import type { 
  ProductoEnvio, 
  RecepcionInput, 
  ProductoRecepcion,
  PedidoEstado,
  PedidoTransitionResult
} from "../../domain/pedidos/types"

// Tipos auxiliares para el service
export type PedidoActual = {
  id: string
  estado: PedidoEstado
  fechaEnvio?: Date | null
  fechaRecepcion?: Date | null
}

export type ConfirmarRecepcionInput = {
  pedido: PedidoActual
  productosEnviados: ProductoEnvio[]
  recepcionInput: Record<string, RecepcionInput>
  stockActual: Record<string, number>
  fechaRecepcion: Date
}

export type ConfirmarRecepcionResult = {
  ok: true
  productosRecepcion: ProductoRecepcion[]
  nuevoStock: Record<string, number>
  pedidoActualizado: PedidoActual & PedidoTransitionResult
} | {
  ok: false
  errores: Array<{ productoId: string; mensaje: string }>
}

/**
 * Service para orquestar la confirmación de recepción de un pedido.
 * 
 * Responsabilidades:
 * - Validar y preparar la recepción usando reglas de dominio
 * - Aplicar cambios al stock
 * - Transicionar el estado del pedido
 * - Determinar si la recepción es parcial o completa
 * 
 * @param input Datos necesarios para procesar la recepción
 * @returns Resultado con éxito (datos actualizados) o error (validación)
 */
export function confirmarRecepcionPedido(
  input: ConfirmarRecepcionInput
): ConfirmarRecepcionResult {
  const { pedido, productosEnviados, recepcionInput, stockActual, fechaRecepcion } = input

  // 1. Preparar recepción usando reglas de dominio
  const preparacion = prepararRecepcion(productosEnviados, recepcionInput)
  if (!preparacion.ok) {
    return { ok: false, errores: preparacion.errores }
  }

  // 2. Aplicar recepción al stock
  const nuevoStock = aplicarRecepcionAStock(
    stockActual,
    preparacion.productos.map(p => ({
      productoId: p.productoId,
      cantidadRecibida: p.cantidadRecibida
    }))
  )

  // 3. Determinar si es recepción parcial
  // Es parcial si algún producto recibido < enviado
  const esParcial = preparacion.productos.some(
    producto => producto.cantidadRecibida < producto.cantidadEnviada
  )

  // 4. Transicionar estado del pedido
  const transicion = transicionarEstadoPedido(pedido.estado, {
    type: "REGISTRAR_RECEPCION",
    esParcial,
    fechaRecepcion
  })

  // 5. Construir resultado con pedido actualizado
  const pedidoActualizado: PedidoActual & PedidoTransitionResult = {
    ...pedido,
    ...transicion
  }

  return {
    ok: true,
    productosRecepcion: preparacion.productos,
    nuevoStock,
    pedidoActualizado
  }
}
