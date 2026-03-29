import type { Pedido, RemitoSalida, Recepcion } from "../domain/types"
import {
  createPedido,
  emitirRemitoSalida,
  registrarTransporte,
  confirmarRecepcion
} from "../infrastructure/firestore-repository"

export const pedidosV2UseCases = {
  createPedido,
  emitirRemitoSalida,
  registrarTransporte,
  confirmarRecepcion
}

export type CreatePedidoInput = Omit<Pedido, "id" | "numeroPedido" | "totales" | "createdAt" | "updatedAt">
export type EmitirRemitoSalidaInput = Omit<RemitoSalida, "id" | "numero" | "totales" | "createdAt">
export type RegistrarTransporteInput = {
  remitoSalidaId: string
  pedidoId: string
  firmaTransportista: RemitoSalida["firmaTransportista"]
  items?: RemitoSalida["items"]
}
export type ConfirmarRecepcionInput = Omit<Recepcion, "id" | "numero" | "totales" | "createdAt">
