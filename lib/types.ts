export interface Empleado {
  id: string
  nombre: string
  apellido: string
  cargo: string
  activo: boolean
  createdAt: Date
}

export interface Turno {
  id: string
  nombre: string
  horaInicio: string // formato "HH:mm"
  horaFin: string // formato "HH:mm"
  color: string // código hex
  createdAt: Date
}

export interface Horario {
  id: string
  nombre: string
  semanaInicio: Date
  semanaFin: Date
  asignaciones: {
    [empleadoId: string]: {
      [dia: string]: string[] // array de IDs de turnos
    }
  }
  createdAt: Date
  modifiedAt: Date
  createdBy: string
}

export interface HistorialItem {
  id: string
  horarioId: string
  nombre: string
  semanaInicio: Date
  semanaFin: Date
  asignaciones: {
    [empleadoId: string]: {
      [dia: string]: string[]
    }
  }
  createdAt: Date
  createdBy: string
  accion: "creado" | "modificado"
}
