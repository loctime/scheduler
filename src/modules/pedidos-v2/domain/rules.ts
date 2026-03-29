import type { Pedido, RemitoSalida, Recepcion, RemitoSalidaItem, RecepcionItem } from "./types"

export function validatePedidoCreate(input: Pick<Pedido, "items">): string[] {
  const errors: string[] = []
  if (!input.items || input.items.length === 0) {
    errors.push("El pedido debe tener items")
  }
  input.items?.forEach((item, index) => {
    if (item.cantidadPedida < 0) errors.push(`Item ${index + 1}: cantidadPedida invalida`)
    if (item.cantidadSugerida < 0) errors.push(`Item ${index + 1}: cantidadSugerida invalida`)
    if (item.cantidadManual < 0) errors.push(`Item ${index + 1}: cantidadManual invalida`)
  })
  return errors
}

export function validateRemitoSalidaEmit(input: Pick<RemitoSalida, "items" | "firmaEmisor">): string[] {
  const errors: string[] = []
  if (!input.items || input.items.length === 0) {
    errors.push("El remito debe tener items")
  }
  if (!input.firmaEmisor?.firmado) {
    errors.push("Firma de emisor requerida")
  }
  input.items?.forEach((item, index) => {
    if (item.cantidadPreparada < 0) errors.push(`Item ${index + 1}: cantidadPreparada invalida`)
    if (item.cantidadTransportada < 0) errors.push(`Item ${index + 1}: cantidadTransportada invalida`)
    if (item.cantidadPreparada > item.cantidadPedida) errors.push(`Item ${index + 1}: cantidadPreparada > cantidadPedida`)
    if (item.cantidadTransportada > item.cantidadPreparada) errors.push(`Item ${index + 1}: cantidadTransportada > cantidadPreparada`)
  })
  return errors
}

export function validateTransporte(remito: Pick<RemitoSalida, "items" | "firmaTransportista">): string[] {
  const errors: string[] = []
  if (!remito.firmaTransportista?.firmado) {
    errors.push("Firma de transportista requerida")
  }
  remito.items?.forEach((item, index) => {
    if (item.cantidadTransportada > item.cantidadPreparada) {
      errors.push(`Item ${index + 1}: cantidadTransportada > cantidadPreparada`)
    }
  })
  return errors
}

export function validateRecepcion(input: Pick<Recepcion, "items" | "firma">): string[] {
  const errors: string[] = []
  if (!input.items || input.items.length === 0) {
    errors.push("La recepcion debe tener items")
  }
  if (!input.firma?.firmado) {
    errors.push("Firma de recepcion requerida")
  }
  input.items?.forEach((item, index) => {
    if (item.cantidadRecibida < 0) errors.push(`Item ${index + 1}: cantidadRecibida invalida`)
    if (item.cantidadPendiente < 0) errors.push(`Item ${index + 1}: cantidadPendiente invalida`)
    if (item.cantidadDevuelta < 0) errors.push(`Item ${index + 1}: cantidadDevuelta invalida`)
    if (item.cantidadDanada < 0) errors.push(`Item ${index + 1}: cantidadDanada invalida`)
  })
  return errors
}

export function calculatePedidoTotales(items: Pedido["items"]): Pedido["totales"] {
  const cantidadPedida = items.reduce((acc, item) => acc + (item.cantidadPedida || 0), 0)
  return {
    items: items.length,
    cantidadPedida,
    cantidadPendienteFinal: 0
  }
}

export function calculateRemitoTotales(items: RemitoSalidaItem[]): RemitoSalida["totales"] {
  return {
    cantidadPedida: items.reduce((acc, item) => acc + (item.cantidadPedida || 0), 0),
    cantidadPreparada: items.reduce((acc, item) => acc + (item.cantidadPreparada || 0), 0),
    cantidadTransportada: items.reduce((acc, item) => acc + (item.cantidadTransportada || 0), 0)
  }
}

export function calculateRecepcionTotales(items: RecepcionItem[]): Recepcion["totales"] {
  return {
    cantidadRecibida: items.reduce((acc, item) => acc + (item.cantidadRecibida || 0), 0),
    cantidadPendiente: items.reduce((acc, item) => acc + (item.cantidadPendiente || 0), 0)
  }
}
