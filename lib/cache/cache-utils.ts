/**
 * Utilidades para comparar datos del cache
 * Maneja correctamente Timestamps de Firestore y otros objetos complejos
 */

/**
 * Compara dos valores, manejando Timestamps de Firestore y otros objetos complejos
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  
  if (a == null || b == null) return false
  
  // Manejar Timestamps de Firestore
  if (a?.toDate && b?.toDate) {
    return a.toDate().getTime() === b.toDate().getTime()
  }
  
  // Manejar arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }
  
  // Manejar objetos
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    
    if (keysA.length !== keysB.length) return false
    
    return keysA.every(key => deepEqual(a[key], b[key]))
  }
  
  return false
}

/**
 * Compara dos arrays de objetos por sus IDs primero, luego por contenido
 */
export function compareArraysByIds<T extends { id: string }>(
  prev: T[],
  next: T[]
): boolean {
  if (prev.length !== next.length) return false
  
  const prevIds = new Set(prev.map(item => item.id))
  const nextIds = new Set(next.map(item => item.id))
  
  // Verificar que todos los IDs coincidan
  if (prevIds.size !== nextIds.size) return false
  if (![...prevIds].every(id => nextIds.has(id))) return false
  
  // Comparar contenido de cada item
  return prev.every(prevItem => {
    const nextItem = next.find(item => item.id === prevItem.id)
    if (!nextItem) return false
    return deepEqual(prevItem, nextItem)
  })
}

/**
 * Compara dos objetos Record por sus claves y valores
 */
export function compareRecords<T>(
  prev: Record<string, T>,
  next: Record<string, T>
): boolean {
  const prevKeys = Object.keys(prev)
  const nextKeys = Object.keys(next)
  
  if (prevKeys.length !== nextKeys.length) return false
  if (!prevKeys.every(key => nextKeys.includes(key))) return false
  
  return prevKeys.every(key => deepEqual(prev[key], next[key]))
}
