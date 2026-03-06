"use client"

import { useCallback, useMemo, useState } from "react"
import { logisticsV2UseCases, logisticsV2Repository } from "@/src/modules/logistics-v2/infrastructure/repository"
import type {
  ConfirmarRecepcionRemitoRequest,
  CrearDevolucionRemitoRequest,
  CrearPedidoInternoRequest,
  DocumentoLogisticoListQuery,
  EmitirRemitoSalidaRequest
} from "@/src/modules/logistics-v2/application/contracts"

function createIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function useLogisticsV2() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true)
    setError(null)
    try {
      return await fn()
    } catch (err: any) {
      const message = err?.message || "Operacion no disponible"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const crearPedidoInterno = useCallback(
    async (input: CrearPedidoInternoRequest) =>
      run(() => logisticsV2UseCases.crearPedidoInterno(input, createIdempotencyKey("pedido-interno"))),
    [run]
  )

  const emitirRemitoSalida = useCallback(
    async (input: EmitirRemitoSalidaRequest) =>
      run(() => logisticsV2UseCases.emitirRemitoSalida(input, createIdempotencyKey("remito-salida"))),
    [run]
  )

  const confirmarRecepcionRemito = useCallback(
    async (input: ConfirmarRecepcionRemitoRequest) =>
      run(() => logisticsV2UseCases.confirmarRecepcionRemito(input, createIdempotencyKey("recepcion-remito"))),
    [run]
  )

  const crearDevolucionRemito = useCallback(
    async (input: CrearDevolucionRemitoRequest) =>
      run(() => logisticsV2UseCases.crearDevolucionRemito(input, createIdempotencyKey("devolucion-remito"))),
    [run]
  )

  const getRemitoById = useCallback((id: string) => run(() => logisticsV2Repository.getRemitoById(id)), [run])
  const getRecepcionById = useCallback((id: string) => run(() => logisticsV2Repository.getRecepcionById(id)), [run])
  const getDevolucionById = useCallback((id: string) => run(() => logisticsV2Repository.getDevolucionById(id)), [run])
  const listDocumentos = useCallback(
    (query: DocumentoLogisticoListQuery) => run(() => logisticsV2Repository.listDocumentos(query)),
    [run]
  )

  return useMemo(
    () => ({
      loading,
      error,
      crearPedidoInterno,
      emitirRemitoSalida,
      confirmarRecepcionRemito,
      crearDevolucionRemito,
      getRemitoById,
      getRecepcionById,
      getDevolucionById,
      listDocumentos
    }),
    [
      loading,
      error,
      crearPedidoInterno,
      emitirRemitoSalida,
      confirmarRecepcionRemito,
      crearDevolucionRemito,
      getRemitoById,
      getRecepcionById,
      getDevolucionById,
      listDocumentos
    ]
  )
}
