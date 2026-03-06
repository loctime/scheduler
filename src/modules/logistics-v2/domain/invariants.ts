import type {
  RecepcionRemito,
  RecepcionRemitoItem,
  RemitoSalida
} from "./types"

export function validateRemitoEmitible(remito: Pick<RemitoSalida, "itemsSnapshot" | "ownerId" | "branchId" | "origen" | "destino">): string[] {
  const errors: string[] = []

  if (!remito.ownerId) errors.push("ownerId es requerido")
  if (!remito.branchId) errors.push("branchId es requerido")
  if (!remito.origen) errors.push("origen es requerido")
  if (!remito.destino) errors.push("destino es requerido")

  if (!remito.itemsSnapshot || remito.itemsSnapshot.length === 0) {
    errors.push("Debe incluir al menos un item")
  }

  remito.itemsSnapshot?.forEach((item, index) => {
    if (item.cantidadEnviadaUnidadesBase <= 0) {
      errors.push(`Item ${index + 1}: cantidadEnviadaUnidadesBase debe ser > 0`)
    }
  })

  return errors
}

export function validateRecepcionItemBalance(item: RecepcionRemitoItem): boolean {
  const classified =
    item.cantidadRecibidaOk +
    item.cantidadFaltante +
    item.cantidadDanada +
    item.cantidadPendiente +
    item.cantidadDevuelta

  return classified === item.cantidadEnviada
}

export function validateRecepcionDocument(recepcion: Pick<RecepcionRemito, "items" | "resultadoGlobal">): string[] {
  const errors: string[] = []

  if (!recepcion.items || recepcion.items.length === 0) {
    errors.push("La recepcion debe tener items")
    return errors
  }

  recepcion.items.forEach((item, index) => {
    if (!validateRecepcionItemBalance(item)) {
      errors.push(`Item ${index + 1}: balance de cantidades invalido`)
    }
  })

  const hasObservations = recepcion.items.some((item) =>
    item.cantidadFaltante > 0 || item.cantidadDanada > 0 || item.cantidadPendiente > 0
  )

  if (hasObservations && recepcion.resultadoGlobal === "total_ok") {
    errors.push("resultadoGlobal no puede ser total_ok si hay diferencias")
  }

  return errors
}
