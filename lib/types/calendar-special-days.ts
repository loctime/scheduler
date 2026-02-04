/**
 * Tipos para el sistema de días especiales del calendario
 */

export type SpecialDayType = 'feriado' | 'no_laborable' | 'local' | 'evento'
export type SpecialDayScope = 'nacional' | 'provincial' | 'municipal'
export type SpecialDaySeverity = 'info' | 'warning' | 'critical'
export type SpecialDaySource = 'api' | 'manual'

export interface CalendarSpecialDay {
  // Identificador único: formato "{city}-{date}" (ej: "viedma-2026-01-01")
  id: string
  
  // Fecha en formato ISO (YYYY-MM-DD) - SIEMPRE en ISO para Firestore
  date: string
  
  // Ubicación geográfica
  city: string      // Nombre de la ciudad (ej: "Viedma", "Bariloche")
  province: string  // Nombre de la provincia (ej: "Río Negro", "Buenos Aires")
  country: string   // Nombre del país (ej: "Argentina")
  
  // Información del día especial
  title: string           // Título corto (ej: "Año Nuevo")
  description?: string    // Descripción detallada opcional
  
  // Clasificación
  type: SpecialDayType    // feriado | no_laborable | local | evento
  scope: SpecialDayScope  // nacional | provincial | municipal
  severity: SpecialDaySeverity // info | warning | critical
  
  // Configuración
  affectsScheduling: boolean // Si afecta la generación de horarios
  
  // Metadatos
  source: SpecialDaySource   // api | manual
  createdAt: Date            // Fecha de creación
  updatedAt: Date            // Fecha de última actualización
}

/**
 * Respuesta de API de feriados (ej: ArgentinaDatos)
 */
export interface HolidayAPIResponse {
  id: number
  dia: number
  mes: number
  motivo: string
  tipo: string
  info: string
  opcional: string
  id_tipo: number
  id_info: number
  id_opcional: number
}

/**
 * Configuración para importación de feriados
 */
export interface HolidayImportConfig {
  year: number
  province?: string  // Código de provincia para filtrar
  city?: string      // Ciudad específica
}

/**
 * Resultado de importación de feriados
 */
export interface HolidayImportResult {
  totalProcessed: number
  imported: number
  skipped: number
  errors: string[]
}

/**
 * Filtros para consultar días especiales
 */
export interface SpecialDaysFilter {
  startDate?: string   // YYYY-MM-DD
  endDate?: string     // YYYY-MM-DD
  city?: string
  province?: string
  country?: string
  type?: SpecialDayType
  scope?: SpecialDayScope
  severity?: SpecialDaySeverity
  source?: SpecialDaySource
  affectsScheduling?: boolean
}

/**
 * Día especial formateado para UI
 */
export interface FormattedSpecialDay {
  id: string
  date: string           // ISO para lógica interna
  dateDisplay: string    // DD/MM/YYYY para mostrar al usuario
  title: string
  description?: string
  type: SpecialDayType
  scope: SpecialDayScope
  severity: SpecialDaySeverity
  affectsScheduling: boolean
  location: string       // "City, Province, Country"
  source: SpecialDaySource
}

/**
 * Advertencia para generación de horarios
 */
export interface SchedulingWarning {
  date: string           // ISO
  dateDisplay: string    // DD/MM/YYYY
  specialDay: FormattedSpecialDay
  message: string
  severity: SpecialDaySeverity
}
