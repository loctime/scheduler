import { validateRecepcionDocument, validateRemitoEmitible } from "../domain/invariants"
import type { DevolucionRemito, PedidoInterno, RecepcionRemito, RemitoSalida } from "../domain/types"
import type {
  ConfirmarRecepcionRemitoRequest,
  CrearDevolucionRemitoRequest,
  CrearPedidoInternoRequest,
  EmitirRemitoSalidaRequest
} from "./contracts"

export interface LogisticsV2Repository {
  crearPedidoInterno(input: CrearPedidoInternoRequest, idempotencyKey?: string): Promise<PedidoInterno>
  emitirRemitoSalida(input: EmitirRemitoSalidaRequest, idempotencyKey?: string): Promise<RemitoSalida>
  confirmarRecepcionRemito(input: ConfirmarRecepcionRemitoRequest, idempotencyKey?: string): Promise<RecepcionRemito>
  crearDevolucionRemito(input: CrearDevolucionRemitoRequest, idempotencyKey?: string): Promise<DevolucionRemito>
  getRemitoById(id: string): Promise<RemitoSalida>
  getRecepcionById(id: string): Promise<RecepcionRemito>
  getDevolucionById(id: string): Promise<DevolucionRemito>
}

export function buildUseCases(repository: LogisticsV2Repository) {
  return {
    async crearPedidoInterno(input: CrearPedidoInternoRequest, idempotencyKey?: string) {
      if (!input.ownerId || !input.branchId) throw new Error("ownerId y branchId son requeridos")
      return repository.crearPedidoInterno(input, idempotencyKey)
    },

    async emitirRemitoSalida(input: EmitirRemitoSalidaRequest, idempotencyKey?: string) {
      const validationErrors = validateRemitoEmitible({
        ownerId: input.ownerId,
        branchId: input.branchId,
        origen: input.origen,
        destino: input.destino,
        itemsSnapshot: input.items.map((item, idx) => ({
          id: String(idx),
          productId: item.productId,
          nombreSnapshot: "",
          unidadBaseSnapshot: "U",
          cantidadEnviada: item.cantidadEnviadaUnidadesBase,
          cantidadEnviadaUnidadesBase: item.cantidadEnviadaUnidadesBase
        }))
      })

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(" | "))
      }

      return repository.emitirRemitoSalida(input, idempotencyKey)
    },

    async confirmarRecepcionRemito(input: ConfirmarRecepcionRemitoRequest, idempotencyKey?: string) {
      const validationErrors = validateRecepcionDocument({
        items: input.items.map((item, idx) => ({
          id: String(idx),
          productId: item.productId,
          nombreSnapshot: "",
          cantidadEnviada:
            item.cantidadRecibidaOk +
            item.cantidadFaltante +
            item.cantidadDanada +
            item.cantidadPendiente +
            item.cantidadDevuelta,
          cantidadRecibidaOk: item.cantidadRecibidaOk,
          cantidadFaltante: item.cantidadFaltante,
          cantidadDanada: item.cantidadDanada,
          cantidadPendiente: item.cantidadPendiente,
          cantidadDevuelta: item.cantidadDevuelta,
          estadoRecepcion: item.estadoRecepcion
        })),
        resultadoGlobal: input.resultadoGlobal
      })

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(" | "))
      }

      return repository.confirmarRecepcionRemito(input, idempotencyKey)
    },

    async crearDevolucionRemito(input: CrearDevolucionRemitoRequest, idempotencyKey?: string) {
      if (!input.items.length) throw new Error("La devolucion requiere al menos un item")
      return repository.crearDevolucionRemito(input, idempotencyKey)
    }
  }
}
