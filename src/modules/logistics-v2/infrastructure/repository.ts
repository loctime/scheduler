import { buildUseCases, type LogisticsV2Repository } from "../application/use-cases"
import type {
  ConfirmarRecepcionRemitoRequest,
  CrearDevolucionRemitoRequest,
  CrearPedidoInternoRequest,
  DocumentoLogisticoListQuery,
  EmitirRemitoSalidaRequest
} from "../application/contracts"
import { logisticsV2Api } from "./api-client"

export class HttpLogisticsV2Repository implements LogisticsV2Repository {
  async crearPedidoInterno(input: CrearPedidoInternoRequest, idempotencyKey?: string) {
    const response = await logisticsV2Api.createPedidoInterno(input, idempotencyKey)
    return response.pedidoInterno
  }

  async emitirRemitoSalida(input: EmitirRemitoSalidaRequest, idempotencyKey?: string) {
    const response = await logisticsV2Api.emitirRemitoSalida(input, idempotencyKey)
    return response.remito
  }

  async confirmarRecepcionRemito(input: ConfirmarRecepcionRemitoRequest, idempotencyKey?: string) {
    const response = await logisticsV2Api.confirmarRecepcionRemito(input, idempotencyKey)
    return response.recepcion
  }

  async crearDevolucionRemito(input: CrearDevolucionRemitoRequest, idempotencyKey?: string) {
    const response = await logisticsV2Api.crearDevolucionRemito(input, idempotencyKey)
    return response.devolucion
  }

  getRemitoById(id: string) {
    return logisticsV2Api.getRemitoById(id)
  }

  getRecepcionById(id: string) {
    return logisticsV2Api.getRecepcionById(id)
  }

  getDevolucionById(id: string) {
    return logisticsV2Api.getDevolucionById(id)
  }

  listDocumentos(query: DocumentoLogisticoListQuery) {
    return logisticsV2Api.listDocumentos(query)
  }
}

export const logisticsV2Repository = new HttpLogisticsV2Repository()
export const logisticsV2UseCases = buildUseCases(logisticsV2Repository)
