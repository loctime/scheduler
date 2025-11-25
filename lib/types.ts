export interface Empleado {
  id: string
  name: string
  email?: string
  phone?: string
  createdAt?: any
  updatedAt?: any
}

export interface Turno {
  id: string
  name: string
  startTime?: string // formato "HH:mm"
  endTime?: string // formato "HH:mm"
  color: string // código hex
  createdAt?: any
  updatedAt?: any
}

export interface Horario {
  id: string
  nombre: string
  weekStart: string // formato "yyyy-MM-dd"
  semanaInicio: string
  semanaFin: string
  assignments: {
    [date: string]: {
      [empleadoId: string]: string[] // array de IDs de turnos
    }
  }
  createdAt?: any
  updatedAt?: any
  createdBy?: string
  createdByName?: string
  modifiedBy?: string
  modifiedByName?: string
}

export interface HistorialItem {
  id: string
  horarioId: string
  nombre: string
  semanaInicio: string
  semanaFin: string
  weekStart?: string
  assignments: {
    [date: string]: {
      [empleadoId: string]: string[]
    }
  }
  createdAt?: any
  createdBy?: string
  createdByName?: string
  accion: "creado" | "modificado"
  versionAnterior?: boolean
}

export interface ShiftOverlap {
  employeeId: string
  date: string
  shifts: string[]
  message: string
}
