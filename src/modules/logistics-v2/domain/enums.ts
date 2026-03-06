export type PedidoInternoEstado = "borrador" | "confirmado" | "cancelado" | "usado_para_remito"

export type RemitoSalidaEstado = "emitido" | "en_transito" | "entregado" | "cerrado" | "anulado"

export type RecepcionItemEstado =
  | "ok"
  | "faltante"
  | "danado"
  | "rechazado"
  | "pendiente"
  | "devuelto"
  | "mixto"

export type RecepcionResultadoGlobal = "total_ok" | "parcial" | "rechazada" | "con_observaciones"

export type RecepcionEstado = "borrador" | "confirmada" | "cerrada"

export type DevolucionEstado = "abierta" | "autorizada" | "despachada" | "cerrada" | "cancelada"

export type TipoDevolucion = "a_proveedor" | "interna" | "ajuste_stock" | "reposicion_pendiente"

export type AccionEsperadaDevolucion =
  | "reponer"
  | "cambiar"
  | "aceptar_nota_credito"
  | "descartar"
  | "reingresar_stock"

export type StockMovementTipo =
  | "salida_por_remito"
  | "entrada_por_recepcion"
  | "ajuste_por_danado"
  | "devolucion_a_proveedor"
  | "reingreso_por_devolucion"
  | "ajuste_manual"

