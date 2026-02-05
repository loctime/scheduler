/**
 * Tipos para estadísticas de empleados - Arquitectura refactorizada
 * 
 * Separa correctamente:
 * 1. Stats mensuales (fuente única de verdad)
 * 2. Stats semanales (derivados) 
 * 3. Stats de vista (solo UI)
 */

// ============================================================================
// 1️⃣ STATS MENSUALES (fuente única de verdad)
// ============================================================================

/**
 * Estadísticas mensuales de un empleado.
 * Se calcula una sola vez y contiene SOLO datos mensuales reales.
 */
export interface EmployeeMonthStats {
  // Contadores mensuales
  francosMes: number
  horasNormalesMes: number
  horasExtrasMes: number
  horasLicenciaEmbarazoMes: number
  horasMedioFrancoMes: number
  
  // Otros contadores mensuales si existen
  diasTrabajadosMes?: number
  diasLicenciaMes?: number
}

/**
 * Inicializa stats mensuales en cero para un empleado.
 */
export function initializeEmployeeMonthStats(): EmployeeMonthStats {
  return {
    francosMes: 0,
    horasNormalesMes: 0,
    horasExtrasMes: 0,
    horasLicenciaEmbarazoMes: 0,
    horasMedioFrancoMes: 0,
    diasTrabajadosMes: 0,
    diasLicenciaMes: 0,
  }
}

// ============================================================================
// 2️⃣ STATS SEMANALES (derivados)
// ============================================================================

/**
 * Estadísticas semanales de un empleado.
 * Se calcula solo con los días de la semana visible.
 */
export interface EmployeeWeekStats {
  // Contadores semanales
  francosSemana: number
  horasNormalesSemana: number
  horasExtrasSemana: number
  horasLicenciaEmbarazoSemana: number
  horasMedioFrancoSemana: number
  
  // Contadores de días semanales
  diasTrabajadosSemana?: number
  diasLicenciaSemana?: number
}

/**
 * Inicializa stats semanales en cero para un empleado.
 */
export function initializeEmployeeWeekStats(): EmployeeWeekStats {
  return {
    francosSemana: 0,
    horasNormalesSemana: 0,
    horasExtrasSemana: 0,
    horasLicenciaEmbarazoSemana: 0,
    horasMedioFrancoSemana: 0,
    diasTrabajadosSemana: 0,
    diasLicenciaSemana: 0,
  }
}

// ============================================================================
// 3️⃣ STATS DE VISTA (solo UI)
// ============================================================================

/**
 * Estadísticas combinadas para vista UI.
 * Combina stats mensuales y semanales, NO calcula nada.
 */
export interface EmployeeStatsView {
  // Stats mensuales (fuente única)
  month: EmployeeMonthStats
  
  // Stats semanales (derivados)
  week: EmployeeWeekStats
}

/**
 * Combina stats mensuales y semanales para vista.
 */
export function createEmployeeStatsView(
  monthStats: EmployeeMonthStats,
  weekStats: EmployeeWeekStats
): EmployeeStatsView {
  return {
    month: monthStats,
    week: weekStats,
  }
}

// ============================================================================
// TIPOS LEGADOS (compatibilidad temporal)
// ============================================================================

/**
 * @deprecated Usar EmployeeMonthStats para nuevos desarrollos.
 * Mantenido por compatibilidad con código existente.
 */
export interface EmployeeMonthlyStats {
  francos: number
  francosSemana: number
  horasExtrasSemana: number
  horasExtrasMes: number
  horasComputablesMes: number
  horasSemana: number
  horasLicenciaEmbarazo?: number
  horasMedioFranco?: number
}

/**
 * Convierte del formato legado al nuevo formato.
 */
export function migrateLegacyStats(
  legacyStats: EmployeeMonthlyStats
): EmployeeStatsView {
  const monthStats: EmployeeMonthStats = {
    francosMes: legacyStats.francos,
    horasNormalesMes: legacyStats.horasComputablesMes,
    horasExtrasMes: legacyStats.horasExtrasMes,
    horasLicenciaEmbarazoMes: legacyStats.horasLicenciaEmbarazo || 0,
    horasMedioFrancoMes: legacyStats.horasMedioFranco || 0,
  }

  const weekStats: EmployeeWeekStats = {
    francosSemana: legacyStats.francosSemana,
    horasNormalesSemana: legacyStats.horasSemana,
    horasExtrasSemana: legacyStats.horasExtrasSemana,
    horasLicenciaEmbarazoSemana: 0, // No disponible en legado
    horasMedioFrancoSemana: 0, // No disponible en legado
  }

  return createEmployeeStatsView(monthStats, weekStats)
}

/**
 * Convierte del nuevo formato al legado (para compatibilidad).
 */
export function convertToLegacyStats(
  newStats: EmployeeStatsView
): EmployeeMonthlyStats {
  return {
    francos: newStats.month.francosMes,
    francosSemana: newStats.week.francosSemana,
    horasExtrasSemana: newStats.week.horasExtrasSemana,
    horasExtrasMes: newStats.month.horasExtrasMes,
    horasComputablesMes: newStats.month.horasNormalesMes,
    horasSemana: newStats.week.horasNormalesSemana,
    horasLicenciaEmbarazo: newStats.month.horasLicenciaEmbarazoMes,
    horasMedioFranco: newStats.month.horasMedioFrancoMes,
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Reglas de negocio para cálculo de estadísticas.
 */
export const BUSINESS_RULES = {
  // Franco: suma +1 franco, NO suma horas, NO bloquea asignaciones futuras
  franco: {
    sumaFrancos: 1,
    sumaHoras: 0,
    sumaHorasExtras: 0,
  },
  
  // Medio franco: suma +0.5 franco, suma horas del medio turno, NO suma horas extra
  medioFranco: {
    sumaFrancos: 0.5,
    sumaHoras: 'medioTurno', // Usar horas configuradas del medio turno
    sumaHorasExtras: 0,
  },
  
  // Turno normal: suma horas normales, NO suma francos
  turnoNormal: {
    sumaFrancos: 0,
    sumaHoras: 'turno', // Usar horas del turno
    sumaHorasExtras: 0,
  },
  
  // Horas extra: se calculan y acumulan por separado, NO se suman a horas normales
  horasExtra: {
    sumaFrancos: 0,
    sumaHoras: 0, // No se suman a horas normales
    sumaHorasExtras: 'extra', // Se calculan según configuración
  },
} as const

export type BusinessRuleKey = keyof typeof BUSINESS_RULES
