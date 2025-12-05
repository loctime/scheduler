export interface Empleado {
  id: string
  name: string
  email?: string
  phone?: string
  userId: string
  createdAt?: any
  updatedAt?: any
}

export interface Turno {
  id: string
  name: string
  startTime?: string // formato "HH:mm" - Primera franja horaria
  endTime?: string // formato "HH:mm" - Primera franja horaria
  startTime2?: string // formato "HH:mm" - Segunda franja horaria (turno cortado)
  endTime2?: string // formato "HH:mm" - Segunda franja horaria (turno cortado)
  color: string // código hex
  userId: string
  createdAt?: any
  updatedAt?: any
}

// Asignación de turno con horarios ajustados opcionales
export interface ShiftAssignment {
  shiftId?: string // Opcional para franco/medio_franco
  type?: "shift" | "franco" | "medio_franco" // Tipo de asignación (por defecto "shift")
  startTime?: string // horario ajustado (opcional, si no existe usa el del turno base)
  endTime?: string // horario ajustado (opcional)
  startTime2?: string // segunda franja ajustada (opcional)
  endTime2?: string // segunda franja ajustada (opcional)
}

// Tipo que soporta tanto formato antiguo (string[]) como nuevo (ShiftAssignment[])
export type ShiftAssignmentValue = string[] | ShiftAssignment[]

export interface Horario {
  id: string
  nombre: string
  weekStart: string // formato "yyyy-MM-dd"
  semanaInicio: string
  semanaFin: string
  assignments: {
    [date: string]: {
      [empleadoId: string]: ShiftAssignmentValue // array de IDs (string[]) o asignaciones con horarios ajustados (ShiftAssignment[])
    }
  }
  completada?: boolean // Indica si la semana fue marcada como finalizada
  completadaPor?: string // ID del usuario que marcó como completada
  completadaPorNombre?: string // Nombre del usuario que marcó como completada
  completadaEn?: any // Timestamp de cuando fue marcada como completada
  // Snapshot de empleados cuando se completó (para mantener historial incluso si se eliminan empleados)
  empleadosSnapshot?: Array<{
    id: string
    name: string
    email?: string
    phone?: string
  }>
  ordenEmpleadosSnapshot?: string[] // Orden de empleados cuando se completó
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
      [empleadoId: string]: ShiftAssignmentValue // array de IDs (string[]) o asignaciones con horarios ajustados (ShiftAssignment[])
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
  shifts: string[] // IDs de turnos que se solapan
  message: string
}

export interface MedioTurno {
  id: string // ID único para identificar el medio turno
  startTime: string // formato "HH:mm"
  endTime: string // formato "HH:mm"
  nombre?: string // Nombre opcional para identificar el medio turno (ej: "Mañana", "Tarde")
  color?: string // código hex para el color del medio franco (por defecto verde)
}

export interface Separador {
  id: string // ID único para identificar el separador
  nombre: string // Nombre del separador (ej: "SALÓN", "COCINA", "BACHA")
  tipo: "puesto" | "personalizado" // Tipo de separador
  color?: string // código hex para el color del separador (opcional)
  createdAt?: any
  updatedAt?: any
}

export interface Producto {
  id: string
  nombre: string
  stockMinimo: number // Stock mínimo configurado por el usuario
  stockActual?: number // Stock actual (se actualiza cada vez que se cuenta)
  unidad?: string // Unidad de medida (ej: "kg", "unidades", "cajas")
  categoria?: string // Categoría opcional para organizar productos
  userId: string
  createdAt?: any
  updatedAt?: any
}

export interface Configuracion {
  id?: string
  nombreEmpresa?: string // Nombre de la empresa
  colorEmpresa?: string // Color de fondo de la celda del nombre de empresa (hex)
  mesInicioDia: number // Día del mes en que empieza (1-28)
  horasMaximasPorDia: number // Horas máximas por día
  semanaInicioDia: number // Día de la semana que inicia (0=domingo, 1=lunes, etc.)
  mostrarFinesDeSemana: boolean
  formatoHora24: boolean
  minutosDescanso: number // Minutos de descanso que se restan (por defecto 30)
  horasMinimasParaDescanso: number // Horas mínimas para aplicar descanso (por defecto 6)
  mediosTurnos?: MedioTurno[] // Medios turnos predefinidos para 1/2 franco
  separadores?: Separador[] // Separadores para organizar empleados
  ordenEmpleados?: string[] // Orden personalizado: puede incluir IDs de empleados o IDs de separadores
  fixedSchedules?: Array<{ 
    employeeId: string
    dayOfWeek: number
    assignments?: ShiftAssignment[] // Asignaciones guardadas cuando se marcó como fijo (opcional)
  }> // Horarios marcados manualmente como fijos (día de semana: 0=domingo, 1=lunes, etc.)
  createdAt?: any
  updatedAt?: any
  updatedBy?: string
  updatedByName?: string
}
