/**
 * Utilidades para manejo de tiempo y horarios
 * Soporta cruce de medianoche y turnos cortados (dos franjas)
 */

/**
 * Convierte una hora en formato "HH:MM" a minutos desde medianoche (0-1439)
 */
export function timeToMinutes(time: string | undefined | null): number {
  if (!time) return 0
  const normalized = time.includes(":") ? time : `${time}:00`
  const [hours, minutes] = normalized.split(":").map(Number)
  return (hours * 60 + minutes) % 1440
}

/**
 * Normaliza un rango de tiempo considerando cruce de medianoche
 * Si end <= start, asume que cruza medianoche y extiende end a +1440 minutos
 * Retorna [startMin, endMinNormalized] donde endMinNormalized puede ser > 1440
 */
export function normalizeRange(startMin: number, endMin: number): [number, number] {
  if (endMin <= startMin) {
    // Cruce de medianoche: extender end a +1440
    return [startMin, endMin + 1440]
  }
  return [startMin, endMin]
}

/**
 * Calcula la duración de un rango de tiempo considerando cruce de medianoche
 * Retorna duración en minutos
 */
export function rangeDuration(start: string, end: string): number {
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  const [normalizedStart, normalizedEnd] = normalizeRange(startMin, endMin)
  return normalizedEnd - normalizedStart
}

/**
 * Verifica si dos rangos de tiempo se solapan, considerando cruce de medianoche
 * Cada rango puede cruzar medianoche
 */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const aStartMin = timeToMinutes(aStart)
  const aEndMin = timeToMinutes(aEnd)
  const bStartMin = timeToMinutes(bStart)
  const bEndMin = timeToMinutes(bEnd)

  // Normalizar ambos rangos
  const [aNormStart, aNormEnd] = normalizeRange(aStartMin, aEndMin)
  const [bNormStart, bNormEnd] = normalizeRange(bStartMin, bEndMin)

  // Verificar solapamiento directo
  if (aNormStart < bNormEnd && bNormStart < aNormEnd) {
    return true
  }

  // Verificar solapamiento con "wrap" (cruces de medianoche)
  // Generar intervalos alternativos para rangos que cruzan medianoche
  const aIntervals: [number, number][] = [[aNormStart, aNormEnd]]
  const bIntervals: [number, number][] = [[bNormStart, bNormEnd]]

  // Si un rango cruza medianoche, también considerar su versión sin cruce
  if (aEndMin <= aStartMin) {
    aIntervals.push([aNormStart, aNormEnd - 1440])
  }
  if (bEndMin <= bStartMin) {
    bIntervals.push([bNormStart, bNormEnd - 1440])
  }

  // Comparar todos los intervalos posibles
  for (const [aStart, aEnd] of aIntervals) {
    for (const [bStart, bEnd] of bIntervals) {
      if (aStart < bEnd && bStart < aEnd) {
        return true
      }
    }
  }

  return false
}

/**
 * Representa un intervalo de tiempo normalizado
 */
export interface TimeInterval {
  start: number // minutos desde medianoche (0-1439)
  end: number // minutos desde medianoche, puede ser > 1440 si cruza medianoche
  crossesMidnight: boolean
}

/**
 * Divide un turno o asignación en intervalos de tiempo
 * Soporta turnos simples (1 franja) y turnos cortados (2 franjas)
 * Cada intervalo está normalizado para cruce de medianoche
 */
export function splitShiftIntoIntervals(
  shift: {
    startTime?: string | null
    endTime?: string | null
    startTime2?: string | null
    endTime2?: string | null
  }
): TimeInterval[] {
  const intervals: TimeInterval[] = []

  // Primera franja
  if (shift.startTime && shift.endTime) {
    const startMin = timeToMinutes(shift.startTime)
    const endMin = timeToMinutes(shift.endTime)
    const [normalizedStart, normalizedEnd] = normalizeRange(startMin, endMin)
    intervals.push({
      start: normalizedStart,
      end: normalizedEnd,
      crossesMidnight: endMin <= startMin,
    })
  }

  // Segunda franja (si existe)
  if (shift.startTime2 && shift.endTime2) {
    const startMin2 = timeToMinutes(shift.startTime2)
    const endMin2 = timeToMinutes(shift.endTime2)
    const [normalizedStart2, normalizedEnd2] = normalizeRange(startMin2, endMin2)
    intervals.push({
      start: normalizedStart2,
      end: normalizedEnd2,
      crossesMidnight: endMin2 <= startMin2,
    })
  }

  return intervals
}

/**
 * Calcula la duración total de un turno en minutos
 * Considera todas las franjas y cruces de medianoche
 */
export function calculateShiftDurationMinutes(
  shift: {
    startTime?: string | null
    endTime?: string | null
    startTime2?: string | null
    endTime2?: string | null
  }
): number {
  const intervals = splitShiftIntoIntervals(shift)
  return intervals.reduce((total, interval) => {
    return total + (interval.end - interval.start)
  }, 0)
}

/**
 * Convierte minutos a formato "HH:MM"
 */
export function minutesToTime(minutes: number): string {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440
  const hours = Math.floor(normalizedMinutes / 60)
  const mins = normalizedMinutes % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}
