import type {
  DevolucionRemito,
  PedidoInterno,
  RecepcionRemito,
  RemitoSalida
} from "../domain/types"

export type ApiError = {
  code: string
  message: string
  details?: unknown
  correlationId?: string
}

export type IdempotencyHeaders = {
  "x-idempotency-key": string
  "x-request-id": string
}

export type EmitirRemitoSalidaRequest = {
  ownerId: string
  branchId: string
  pedidoInternoId?: string
  origen: string
  destino: string
  transportista: string
  vehiculo?: string
  items: Array<{
    productId: string
    cantidadEnviadaUnidadesBase: number
    observacionesEnvio?: string
  }>
  metadata?: Record<string, string>
}

export type EmitirRemitoSalidaResponse = {
  remito: RemitoSalida
  correlationId: string
}

export type ConfirmarRecepcionRemitoRequest = {
  ownerId: string
  branchId: string
  remitoSalidaId: string
  recepcionadoPor: string
  resultadoGlobal: RecepcionRemito["resultadoGlobal"]
  observacionesGenerales?: string
  items: Array<{
    productId: string
    cantidadRecibidaOk: number
    cantidadFaltante: number
    cantidadDanada: number
    cantidadPendiente: number
    cantidadDevuelta: number
    estadoRecepcion: RecepcionRemito["items"][number]["estadoRecepcion"]
    comentario?: string
  }>
}

export type ConfirmarRecepcionRemitoResponse = {
  recepcion: RecepcionRemito
  correlationId: string
}

export type CrearDevolucionRemitoRequest = {
  ownerId: string
  branchId: string
  remitoSalidaId: string
  recepcionRemitoId?: string
  tipoDevolucion: DevolucionRemito["tipoDevolucion"]
  motivoGeneral: string
  creadaPor: string
  destinoDevolucion: string
  items: Array<{
    productId: string
    cantidad: number
    motivo: string
    accionEsperada: DevolucionRemito["items"][number]["accionEsperada"]
  }>
}

export type CrearDevolucionRemitoResponse = {
  devolucion: DevolucionRemito
  correlationId: string
}

export type CrearPedidoInternoRequest = {
  ownerId: string
  branchId: string
  creadoPor: string
  origen: string
  destinoSugerido?: string
  observaciones?: string
  items: PedidoInterno["items"]
}

export type CrearPedidoInternoResponse = {
  pedidoInterno: PedidoInterno
  correlationId: string
}

export type DocumentoLogisticoListQuery = {
  ownerId: string
  branchId?: string
  tipo?: "remito" | "recepcion" | "devolucion"
  estado?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export type DocumentoLogisticoListResponse = {
  items: Array<RemitoSalida | RecepcionRemito | DevolucionRemito>
  total: number
}
