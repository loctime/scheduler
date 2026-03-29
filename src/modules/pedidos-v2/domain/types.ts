import type {
  PedidoEstado,
  RemitoSalidaEstado,
  RemitoSalidaLineaEstado,
  RecepcionEstado,
  RecepcionLineaEstado,
  PendienteEstado,
  AuditEntityType,
  AuditAccion
} from "./enums"

export type TimestampLike = Date | number | string

export type PedidoOrigenDestino = {
  tipo: string
  id: string
  nombre: string
}

export type PedidoItem = {
  itemId: string
  productId: string
  productNombre: string
  unidad: string
  stockMinimo: number
  stockActual: number
  cantidadPedida: number
  cantidadSugerida: number
  cantidadManual: number
  observaciones: string
}

export type PedidoTotales = {
  items: number
  cantidadPedida: number
  cantidadPendienteFinal: number
}

export type Pedido = {
  id: string
  numeroPedido: string
  estado: PedidoEstado
  origen: PedidoOrigenDestino
  destino: PedidoOrigenDestino
  usaPendientes: boolean
  pedidoOrigenPendienteIds: string[]
  remitoSalidaId: string | null
  recepcionId: string | null
  observaciones: string
  items: PedidoItem[]
  totales: PedidoTotales
  createdAt: TimestampLike
  createdBy: string
  createdByName: string
  createdByEmail: string
  updatedAt: TimestampLike
}

export type FirmaSnapshot = {
  firmado: boolean
  firmadoAt: TimestampLike
  firmadoBy: string
  firmadoByName: string
  firmadoByEmail: string
  firmaData: string
}

export type RemitoSalidaItem = {
  itemId: string
  pedidoItemId: string
  productId: string
  productNombre: string
  unidad: string
  cantidadPedida: number
  cantidadPreparada: number
  cantidadTransportada: number
  estadoLinea: RemitoSalidaLineaEstado
  motivo: string
  observaciones: string
}

export type RemitoSalidaTotales = {
  cantidadPedida: number
  cantidadPreparada: number
  cantidadTransportada: number
}

export type RemitoSalida = {
  id: string
  numero: string
  pedidoId: string
  pedidoNumero: string
  estado: RemitoSalidaEstado
  origen: { id: string; nombre: string }
  destino: { id: string; nombre: string }
  items: RemitoSalidaItem[]
  totales: RemitoSalidaTotales
  observaciones: string
  firmaEmisor: FirmaSnapshot
  firmaTransportista: FirmaSnapshot
  createdAt: TimestampLike
  createdBy: string
  createdByName: string
  createdByEmail: string
}

export type RecepcionItem = {
  itemId: string
  pedidoItemId: string
  productId: string
  productNombre: string
  unidad: string
  cantidadPedida: number
  cantidadPreparada: number
  cantidadTransportada: number
  cantidadRecibida: number
  cantidadPendiente: number
  cantidadDevuelta: number
  cantidadDanada: number
  estadoLinea: RecepcionLineaEstado
  motivo: string
  observaciones: string
}

export type RecepcionTotales = {
  cantidadRecibida: number
  cantidadPendiente: number
}

export type Recepcion = {
  id: string
  numero: string
  pedidoId: string
  remitoSalidaId: string
  pedidoNumero: string
  remitoSalidaNumero: string
  estado: RecepcionEstado
  items: RecepcionItem[]
  totales: RecepcionTotales
  observaciones: string
  firma: FirmaSnapshot
  createdAt: TimestampLike
  createdBy: string
  createdByName: string
  createdByEmail: string
}

export type ConsolidadoItem = {
  productId: string
  productNombre: string
  cantidadPedida: number
  cantidadPreparada: number
  cantidadTransportada: number
  cantidadRecibida: number
  cantidadPendiente: number
  estadoFinal: string
}

export type ConsolidadoResumen = {
  cantidadPedida: number
  cantidadPreparada: number
  cantidadTransportada: number
  cantidadRecibida: number
  cantidadPendiente: number
}

export type Consolidado = {
  id: string
  pedidoId: string
  numeroPedido: string
  estado: string
  refs: {
    remitoSalidaId: string
    recepcionId: string
  }
  resumen: ConsolidadoResumen
  items: ConsolidadoItem[]
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

export type Pendiente = {
  id: string
  pedidoId: string
  pedidoNumero: string
  recepcionId: string
  productId: string
  productNombre: string
  unidad: string
  origenId: string
  origenNombre: string
  destinoId: string
  destinoNombre: string
  cantidadPendiente: number
  estado: PendienteEstado
  createdAt: TimestampLike
  updatedAt: TimestampLike
  resolvedAt: TimestampLike | null
  resolvedBy: string | null
  pedidoResolucionId: string | null
}

export type AuditLog = {
  id: string
  entityType: AuditEntityType
  entityId: string
  pedidoId: string
  accion: AuditAccion
  descripcion: string
  createdAt: TimestampLike
  createdBy: string
  createdByName: string
  createdByEmail: string
}

export type Counter = {
  id: string
  prefix: string
  nextNumber: number
  updatedAt: TimestampLike
}
