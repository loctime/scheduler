export type PedidoEstado = "pendiente" | "preparado" | "en_transporte" | "recibido" | "cerrado" | "cancelado"

export type RemitoSalidaEstado = "emitido" | "en_transito" | "entregado" | "cerrado" | "anulado"

export type RemitoSalidaLineaEstado = "ok" | "parcial" | "no_hay" | "cancelado"

export type RecepcionEstado = "confirmada" | "cerrada" | "anulada"

export type RecepcionLineaEstado = "ok" | "faltante" | "no_esta" | "danado" | "devuelto" | "excedente" | "parcial"

export type PendienteEstado = "activo" | "usado_en_nuevo_pedido" | "resuelto" | "cancelado"

export type AuditEntityType = "pedido" | "remito_salida" | "recepcion" | "consolidado" | "pendiente"

export type AuditAccion = "created" | "updated" | "signed" | "confirmed" | "cancelled"
