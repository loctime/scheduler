import type {
  AccionEsperadaDevolucion,
  DevolucionEstado,
  PedidoInternoEstado,
  RecepcionEstado,
  RecepcionItemEstado,
  RecepcionResultadoGlobal,
  RemitoSalidaEstado,
  StockMovementTipo,
  TipoDevolucion
} from "./enums"

export type TimestampLike = Date | string | number

export type PedidoInternoItem = {
  id: string
  productId: string
  nombreSnapshot: string
  unidadBaseSnapshot: string
  packSizeSnapshot?: number
  stockMinimoSnapshot: number
  stockActualSnapshot: number
  cantidadSugerida: number
  cantidadAjustada?: number
  cantidadFinalPedida: number
  observaciones?: string
}

export type PedidoInterno = {
  id: string
  ownerId: string
  branchId: string
  estado: PedidoInternoEstado
  createdAt: TimestampLike
  confirmadoAt?: TimestampLike
  creadoPor: string
  origen: string
  destinoSugerido?: string
  observaciones?: string
  items: PedidoInternoItem[]
}

export type RemitoSalidaItemSnapshot = {
  id: string
  productId: string
  nombreSnapshot: string
  unidadBaseSnapshot: string
  packSizeSnapshot?: number
  cantidadPedidaOriginal?: number
  cantidadEnviada: number
  cantidadEnviadaUnidadesBase: number
  lote?: string
  vencimiento?: string
  observacionesEnvio?: string
}

export type RemitoSalida = {
  id: string
  ownerId: string
  branchId: string
  numeroRemito: string
  estado: RemitoSalidaEstado
  emitidoAt: TimestampLike
  emitidoPor: string
  origen: string
  destino: string
  transportista: string
  vehiculo?: string
  pedidoInternoId?: string
  pdfFileId?: string
  qrToken?: string
  firmaEmisorFileId?: string
  firmaTransportistaFileId?: string
  itemsSnapshot: RemitoSalidaItemSnapshot[]
}

export type RecepcionRemitoItem = {
  id: string
  productId: string
  nombreSnapshot: string
  cantidadEnviada: number
  cantidadRecibidaOk: number
  cantidadFaltante: number
  cantidadDanada: number
  cantidadPendiente: number
  cantidadDevuelta: number
  estadoRecepcion: RecepcionItemEstado
  motivo?: string
  comentario?: string
  evidenciaFileIds?: string[]
}

export type RecepcionRemito = {
  id: string
  ownerId: string
  branchId: string
  remitoSalidaId: string
  numeroRemitoSnapshot: string
  estado: RecepcionEstado
  recepcionAt: TimestampLike
  recepcionadoPor: string
  firmaReceptorFileId?: string
  evidenciasFileIds?: string[]
  resultadoGlobal: RecepcionResultadoGlobal
  observacionesGenerales?: string
  items: RecepcionRemitoItem[]
}

export type DevolucionRemitoItem = {
  id: string
  productId: string
  nombreSnapshot: string
  cantidad: number
  motivo: string
  accionEsperada: AccionEsperadaDevolucion
}

export type DevolucionRemito = {
  id: string
  ownerId: string
  branchId: string
  remitoSalidaId: string
  recepcionRemitoId?: string
  estado: DevolucionEstado
  tipoDevolucion: TipoDevolucion
  motivoGeneral: string
  creadaAt: TimestampLike
  creadaPor: string
  destinoDevolucion: string
  items: DevolucionRemitoItem[]
  pdfFileId?: string
  firmaEntregaFileId?: string
  firmaRecepcionProveedorFileId?: string
}

export type StockMovement = {
  id: string
  ownerId: string
  branchId: string
  productId: string
  unidadBase: string
  cantidad: number
  signo: 1 | -1
  tipo: StockMovementTipo
  documentType: "remito_salida" | "recepcion_remito" | "devolucion_remito" | "ajuste_manual"
  documentId: string
  documentItemId: string
  motivo?: string
  createdAt: TimestampLike
  createdBy: string
}

export type DocumentoFile = {
  id: string
  ownerId: string
  branchId: string
  documentType: StockMovement["documentType"]
  documentId: string
  fileType: "pdf" | "signature" | "evidence"
  storagePath: string
  checksum?: string
  metadata?: Record<string, string>
  createdAt: TimestampLike
  createdBy: string
}

export type AuditLog = {
  id: string
  ownerId: string
  branchId: string
  action: string
  documentType?: string
  documentId?: string
  actorId: string
  actorEmail?: string
  correlationId: string
  beforeHash?: string
  afterHash?: string
  createdAt: TimestampLike
}
