export type PedidoEstado = "creado" | "processing" | "enviado" | "recibido" | "completado"

export type ProductoPedido = {
  productoId: string
  nombre: string
  stockMinimo: number
  unidad?: string
}

export type ProductoEnvio = {
  productoId: string
  productoNombre: string
  cantidadPedida: number
  cantidadEnviada: number
  observacionesEnvio?: string
}

export type ProductoRecepcion = {
  productoId: string
  productoNombre: string
  cantidadEnviada: number
  cantidadRecibida: number
  estado: "ok"
  esDevolucion: boolean
  cantidadDevolucion?: number
  observaciones?: string
}

export type AjustesPedido = Record<string, number>

export type RecepcionInput = {
  productoId: string
  cantidadRecibida: number
  esDevolucion?: boolean
  observaciones?: string
}

export type RecepcionValidationError = {
  productoId: string
  mensaje: string
}

export type PedidoTransitionEvent =
  | { type: "GENERAR_ENVIO"; fechaEnvio: Date }
  | { type: "REGISTRAR_RECEPCION"; esParcial: boolean; fechaRecepcion: Date }
  | { type: "REINICIAR_ENVIO" }

export type PedidoTransitionResult = {
  estado: PedidoEstado
  fechaEnvio?: Date | null
  fechaRecepcion?: Date | null
}
