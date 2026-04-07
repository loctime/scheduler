// Un pedido que hace una sucursal (a fábrica u otra sucursal)
export type PedidoFabrica = {
  id: string
  ownerId: string
  origenLocationId: string
  origenNombre: string
  destinoLocationId: string
  destinoNombre: string
  grupoPedidoId: string
  grupoPedidoNombre: string
  estado: "borrador" | "enviado" | "en_preparacion" | "despachado" | "recibido" | "cancelado"
  esPendiente: boolean
  controlado?: boolean
  pedidoOrigenId?: string
  items: PedidoFabricaItem[]
  observacion?: string
  creadoEn: unknown
  creadoPor: string
  creadoPorEmail: string
  actualizadoEn: unknown
}

export type PedidoFabricaItem = {
  productoId: string
  productoNombre: string
  cantidadSugerida: number
  cantidadPedida: number
  comentario?: string
}

export type RemitoLog = {
  id: string
  ownerId: string
  numero: string
  origenLocationId: string
  origenNombre: string
  destinoLocationId: string
  destinoNombre: string
  pedidoFabricaId?: string
  estado: "preparado" | "en_camino" | "entregado" | "cancelado"
  items: RemitoLogItem[]
  observacion?: string
  creadoEn: unknown
  creadoPor: string
  creadoPorEmail: string
  actualizadoEn: unknown
  stockDescontadoEn?: unknown
}

export type RemitoLogItem = {
  productoId: string
  productoNombre: string
  cantidadPedida?: number
  cantidadEnviada: number
  comentario?: string
}

export type RecepcionLog = {
  id: string
  ownerId: string
  remitoId: string
  remitoNumero: string
  origenLocationId: string
  destinoLocationId: string
  destinoNombre: string
  items: RecepcionLogItem[]
  observacion?: string
  creadoEn: unknown
  creadoPor: string
  creadoPorEmail: string
  stockActualizadoEn?: unknown
}

export type RecepcionLogItem = {
  productoId: string
  productoNombre: string
  cantidadEnviada: number
  cantidadRecibida: number
  comentario?: string
}
