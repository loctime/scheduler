import { controlfileRequest } from "@/lib/api/controlfile-client"
import type {
  ConfirmarRecepcionRemitoResponse,
  CrearDevolucionRemitoResponse,
  CrearPedidoInternoResponse,
  DocumentoLogisticoListQuery,
  DocumentoLogisticoListResponse,
  EmitirRemitoSalidaResponse
} from "../application/contracts"
import type { DevolucionRemito, RecepcionRemito, RemitoSalida } from "../domain/types"

function queryString(input: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value))
  })
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

export const logisticsV2Api = {
  createPedidoInterno: (body: unknown, idempotencyKey?: string) =>
    controlfileRequest<CrearPedidoInternoResponse>("/api/logistics/v2/pedidos-internos", {
      method: "POST",
      body,
      idempotencyKey,
      requestId: crypto.randomUUID()
    }),

  emitirRemitoSalida: (body: unknown, idempotencyKey?: string) =>
    controlfileRequest<EmitirRemitoSalidaResponse>("/api/logistics/v2/remitos-salida/emitir", {
      method: "POST",
      body,
      idempotencyKey,
      requestId: crypto.randomUUID()
    }),

  confirmarRecepcionRemito: (body: unknown, idempotencyKey?: string) =>
    controlfileRequest<ConfirmarRecepcionRemitoResponse>("/api/logistics/v2/recepciones/confirmar", {
      method: "POST",
      body,
      idempotencyKey,
      requestId: crypto.randomUUID()
    }),

  crearDevolucionRemito: (body: unknown, idempotencyKey?: string) =>
    controlfileRequest<CrearDevolucionRemitoResponse>("/api/logistics/v2/devoluciones/crear", {
      method: "POST",
      body,
      idempotencyKey,
      requestId: crypto.randomUUID()
    }),

  getRemitoById: (id: string) => controlfileRequest<RemitoSalida>(`/api/logistics/v2/remitos/${id}`),
  getRecepcionById: (id: string) => controlfileRequest<RecepcionRemito>(`/api/logistics/v2/recepciones/${id}`),
  getDevolucionById: (id: string) => controlfileRequest<DevolucionRemito>(`/api/logistics/v2/devoluciones/${id}`),

  listDocumentos: (query: DocumentoLogisticoListQuery) =>
    controlfileRequest<DocumentoLogisticoListResponse>(
      `/api/logistics/v2/documentos${queryString({
        ownerId: query.ownerId,
        branchId: query.branchId,
        tipo: query.tipo,
        estado: query.estado,
        from: query.from,
        to: query.to,
        page: query.page,
        pageSize: query.pageSize
      })}`
    )
}
