import type {
  DevolucionRemito,
  RecepcionRemito,
  RemitoSalida
} from "../domain/types"

export type DocumentoLogisticoViewModel = {
  id: string
  tipo: "remito" | "recepcion" | "devolucion"
  numero?: string
  estado: string
  fecha: string
  origenDestino?: string
}

function formatDate(value: unknown): string {
  if (!value) return "-"
  const date = value instanceof Date ? value : new Date(value as string)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("es-AR")
}

export function toRemitoViewModel(remito: RemitoSalida): DocumentoLogisticoViewModel {
  return {
    id: remito.id,
    tipo: "remito",
    numero: remito.numeroRemito,
    estado: remito.estado,
    fecha: formatDate(remito.emitidoAt),
    origenDestino: `${remito.origen} -> ${remito.destino}`
  }
}

export function toRecepcionViewModel(recepcion: RecepcionRemito): DocumentoLogisticoViewModel {
  return {
    id: recepcion.id,
    tipo: "recepcion",
    numero: recepcion.numeroRemitoSnapshot,
    estado: recepcion.estado,
    fecha: formatDate(recepcion.recepcionAt)
  }
}

export function toDevolucionViewModel(devolucion: DevolucionRemito): DocumentoLogisticoViewModel {
  return {
    id: devolucion.id,
    tipo: "devolucion",
    estado: devolucion.estado,
    fecha: formatDate(devolucion.creadaAt)
  }
}
