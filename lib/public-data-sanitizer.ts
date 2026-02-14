/**
 * Interfaz para datos públicos del horario
 * Solo contiene información segura para mostrar públicamente
 */
export interface SanitizedPublicHorarioData {
  publishedWeekId: string
  weeks: Record<string, {
    weekId: string
    weekLabel: string
    publishedAt: any // Firestore Timestamp
    publicImageUrl?: string | null
    days: Record<string, any[]>
    dayStatus?: Record<string, any>
    employees: Array<{
      id: string
      name: string
    }>
    /** Turnos con id, name, color para mostrar color real en PWA (Horario de Hoy) */
    shifts?: Array<{ id: string; name: string; color: string }>
  }>
  companyName?: string
}

/**
 * Datos brutos que vienen de Firestore (contienen información sensible)
 */
interface RawPublicHorarioData {
  ownerId: string
  publishedWeekId: string
  weeks: Record<string, any>
  userId: string
  isPublic: boolean
  companyName?: string
  createdAt?: any
  updatedAt?: any
  // Otros campos internos que puedan existir...
  [key: string]: any
}

/**
 * Sanitiza empleados removiendo información sensible
 */
function sanitizeEmployees(employees: any[]): Array<{ id: string; name: string }> {
  if (!Array.isArray(employees)) return []
  
  return employees
    .filter(emp => emp && typeof emp === 'object')
    .map(emp => ({
      id: emp.id || emp.employeeId || '',
      name: emp.name || emp.displayName || emp.id || 'Empleado'
    }))
    .filter(emp => emp.id && emp.name) // Solo empleados válidos
}

/**
 * Sanitiza datos de semanas removiendo metadata sensible
 */
function sanitizeWeeks(weeks: Record<string, any>): Record<string, any> {
  if (!weeks || typeof weeks !== 'object') return {}
  
  const sanitized: Record<string, any> = {}
  
  Object.entries(weeks).forEach(([weekId, weekData]) => {
    if (!weekData || typeof weekData !== 'object') return
    
    const rawShifts = weekData.shifts
    const shifts: Array<{ id: string; name: string; color: string }> = Array.isArray(rawShifts)
      ? rawShifts
          .filter((s: any) => s && typeof s === "object" && s.id)
          .map((s: any) => ({
            id: String(s.id),
            name: String(s.name ?? ""),
            color: typeof s.color === "string" && s.color.trim() ? s.color.trim() : "#9ca3af"
          }))
      : []

    sanitized[weekId] = {
      weekId: weekData.weekId || weekId,
      weekLabel: weekData.weekLabel || `Semana ${weekId}`,
      publishedAt: weekData.publishedAt || null,
      publicImageUrl: weekData.publicImageUrl || null,
      days: weekData.days || {},
      dayStatus: weekData.dayStatus || {},
      employees: sanitizeEmployees(weekData.employees || []),
      shifts: shifts.length > 0 ? shifts : undefined
    }
  })
  
  return sanitized
}

/**
 * Filtra y sanitiza datos públicos del horario
 * 
 * @param rawData Datos brutos de Firestore
 * @returns Datos sanitizados y seguros para frontend público
 */
export function sanitizePublicHorarioData(rawData: RawPublicHorarioData | null): SanitizedPublicHorarioData | null {
  if (!rawData || typeof rawData !== 'object') {
    return null
  }
  
  try {
    // Extraer solo los campos públicos necesarios
    const sanitized: SanitizedPublicHorarioData = {
      publishedWeekId: rawData.publishedWeekId || '',
      weeks: sanitizeWeeks(rawData.weeks || {}),
      companyName: rawData.companyName ? rawData.companyName.trim().substring(0, 100) : undefined
    }
    
    // Validación final
    if (!sanitized.publishedWeekId) {
      console.warn('⚠️ [sanitizePublicHorarioData] publishedWeekId vacío')
      return null
    }
    
    if (Object.keys(sanitized.weeks).length === 0) {
      console.warn('⚠️ [sanitizePublicHorarioData] No hay semanas válidas')
      return null
    }
    
    return sanitized
  } catch (error) {
    console.error('❌ [sanitizePublicHorarioData] Error sanitizando datos:', error)
    return null
  }
}

/**
 * Verifica si los datos públicos son válidos para mostrar
 */
export function isValidPublicHorarioData(data: SanitizedPublicHorarioData | null): data is SanitizedPublicHorarioData {
  if (!data) return false
  
  return (
    typeof data.publishedWeekId === 'string' && data.publishedWeekId.length > 0 &&
    typeof data.weeks === 'object' && Object.keys(data.weeks).length > 0
  )
}

/**
 * Genera respuesta de error genérica para no revelar información sensible
 */
export function createGenericPublicError(): { error: string; code: string } {
  return {
    error: "Horario no encontrado",
    code: "NOT_FOUND"
  }
}

/**
 * Log de acceso público (para seguridad y análisis)
 */
export function logPublicAccess(companySlug: string, userAgent?: string, ip?: string): void {
  try {
    const accessLog = {
      companySlug,
      timestamp: new Date().toISOString(),
      userAgent: userAgent || 'unknown',
      ip: ip || 'unknown',
      success: false // Se actualiza a true si el acceso es exitoso
    }
    
    // En producción, esto podría ir a una colección de logs
    console.log(`🔍 [PublicAccess] ${JSON.stringify(accessLog)}`)
  } catch (error) {
    // Silenciar errores de logging para no afectar la experiencia
    console.warn('⚠️ [PublicAccess] Error en logging:', error)
  }
}
