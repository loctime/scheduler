/**
 * Servicio para consumir API de feriados de Argentina
 * 
 * Usamos ArgentinaDatos API: https://apis.datos.gob.ar/feriados
 * Documentación: https://datos.gob.ar/ar/dataset/sistema-nacional-feriados
 */

import type { 
  HolidayAPIResponse, 
  HolidayImportConfig, 
  HolidayImportResult,
  CalendarSpecialDay 
} from '@/lib/types/calendar-special-days'
import { parseAPIDate, generateSpecialDayId } from '@/lib/calendar-special-days'

/**
 * Configuración de provincias argentinas
 */
const ARGENTINA_PROVINCES = {
  'RN': 'Río Negro',
  'BA': 'Buenos Aires',
  'CF': 'Capital Federal',
  'CT': 'Catamarca',
  'CC': 'Chaco',
  'CH': 'Chubut',
  'CB': 'Córdoba',
  'CR': 'Corrientes',
  'ER': 'Entre Ríos',
  'FO': 'Formosa',
  'JY': 'Jujuy',
  'LP': 'La Pampa',
  'LR': 'La Rioja',
  'MZ': 'Mendoza',
  'MI': 'Misiones',
  'NQ': 'Neuquén',
  'FN': 'Formosa',
  'SA': 'Salta',
  'SJ': 'San Juan',
  'SL': 'San Luis',
  'SC': 'Santa Cruz',
  'SF': 'Santa Fe',
  'SE': 'Santiago del Estero',
  'TF': 'Tierra del Fuego',
  'TU': 'Tucumán'
} as const

/**
 * Ciudades principales por provincia
 */
const MAIN_CITIES = {
  'RN': ['Viedma', 'Bariloche', 'Cipolletti', 'General Roca'],
  'BA': ['La Plata', 'Mar del Plata', 'Bahía Blanca', 'Tandil'],
  'CF': ['Buenos Aires'],
  'CT': ['Catamarca'],
  'CC': ['Resistencia', 'Charata'],
  'CH': ['Rawson', 'Trelew', 'Puerto Madryn'],
  'CB': ['Córdoba', 'Villa María', 'Río Cuarto'],
  'CR': ['Corrientes', 'Goya', 'Concepción'],
  'ER': ['Paraná', 'Concordia', 'Gualeguaychú'],
  'FO': ['Formosa', 'Clorinda'],
  'JY': ['Jujuy', 'San Salvador de Jujuy'],
  'LP': ['Santa Rosa', 'General Pico'],
  'LR': ['La Rioja', 'Chilecito'],
  'MZ': ['Mendoza', 'San Rafael', 'Malargüe'],
  'MI': ['Posadas', 'Puerto Iguazú'],
  'NQ': ['Neuquén', 'Cipolletti'],
  'FN': ['Formosa'],
  'SA': ['Salta', 'Tartagal', 'Orán'],
  'SJ': ['San Juan', 'Rivadavia'],
  'SL': ['San Luis', 'Villa Mercedes'],
  'SC': ['Río Gallegos', 'Caleta Olivia'],
  'SF': ['Santa Fe', 'Rosario', 'Venado Tuerto'],
  'SE': ['Santiago del Estero', 'La Banda'],
  'TF': ['Ushuaia', 'Río Grande'],
  'TU': ['Tucumán', 'San Miguel de Tucumán']
} as const

/**
 * Obtiene feriados desde la API de ArgentinaDatos
 */
export async function fetchHolidaysFromAPI(year: number): Promise<HolidayAPIResponse[]> {
  try {
    const response = await fetch(
      `https://apis.datos.gob.ar/feriados/v1.0/${year}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'horarios-scheduler/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Error fetching holidays: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data || []
  } catch (error) {
    console.error('Error fetching holidays from API:', error)
    throw new Error('No se pudieron obtener los feriados desde la API')
  }
}

/**
 * Convierte respuesta de API a CalendarSpecialDay
 */
function convertAPIResponseToSpecialDay(
  apiResponse: HolidayAPIResponse,
  config: HolidayImportConfig
): Omit<CalendarSpecialDay, 'id' | 'createdAt' | 'updatedAt'> {
  const date = parseAPIDate(apiResponse.dia, apiResponse.mes, config.year)
  
  // Determinar tipo según API
  let type: CalendarSpecialDay['type'] = 'feriado'
  let scope: CalendarSpecialDay['scope'] = 'nacional'
  let severity: CalendarSpecialDay['severity'] = 'warning'
  
  // Lógica para determinar tipo y alcance
  if (apiResponse.tipo.toLowerCase().includes('nacional')) {
    scope = 'nacional'
    severity = 'critical'
  } else if (apiResponse.tipo.toLowerCase().includes('provincial')) {
    scope = 'provincial'
    severity = 'warning'
  } else if (apiResponse.tipo.toLowerCase().includes('municipal')) {
    scope = 'municipal'
    severity = 'info'
  }
  
  // Si es opcional, marcar como no laborable
  if (apiResponse.opcional === 'Sí') {
    type = 'no_laborable'
    severity = 'info'
  }

  // Determinar ciudad y provincia
  let city = config.city || 'Argentina'
  let province = config.province ? ARGENTINA_PROVINCES[config.province as keyof typeof ARGENTINA_PROVINCES] : 'Argentina'
  
  if (scope === 'nacional') {
    city = 'Argentina'
    province = 'Argentina'
  } else if (config.province) {
    // Usar ciudad principal de la provincia si no se especifica
    if (!config.city && MAIN_CITIES[config.province as keyof typeof MAIN_CITIES]) {
      city = MAIN_CITIES[config.province as keyof typeof MAIN_CITIES][0]
    }
  }

  return {
    date,
    city,
    province,
    country: 'Argentina',
    title: apiResponse.motivo,
    description: apiResponse.info || undefined,
    type,
    scope,
    severity,
    affectsScheduling: true, // Por defecto, los feriados afectan horarios
    source: 'api'
  }
}

/**
 * Importa feriados desde la API a Firestore
 */
export async function importHolidaysFromAPI(
  config: HolidayImportConfig,
  db: any, // Firestore instance
  userId: string
): Promise<HolidayImportResult> {
  const result: HolidayImportResult = {
    totalProcessed: 0,
    imported: 0,
    skipped: 0,
    errors: []
  }

  try {
    // Obtener feriados desde API
    const apiHolidays = await fetchHolidaysFromAPI(config.year)
    result.totalProcessed = apiHolidays.length

    // Referencia a la colección
    const collectionRef = db.collection('apps/horarios/calendarSpecialDays')

    for (const apiHoliday of apiHolidays) {
      try {
        // Convertir a nuestro formato
        const specialDayData = convertAPIResponseToSpecialDay(apiHoliday, config)
        
        // Generar ID único
        const id = generateSpecialDayId(specialDayData.city, specialDayData.date)
        
        // Verificar si ya existe
        const docRef = collectionRef.doc(id)
        const docSnapshot = await docRef.get()
        
        if (docSnapshot.exists) {
          result.skipped++
          continue
        }

        // Crear documento
        const specialDay: CalendarSpecialDay = {
          ...specialDayData,
          id,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        await docRef.set(specialDay)
        result.imported++

      } catch (error) {
        const errorMsg = `Error procesando feriado ${apiHoliday.motivo}: ${error instanceof Error ? error.message : 'Unknown error'}`
        result.errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    return result

  } catch (error) {
    const errorMsg = `Error general en importación: ${error instanceof Error ? error.message : 'Unknown error'}`
    result.errors.push(errorMsg)
    throw new Error(errorMsg)
  }
}

/**
 * Importa feriados nacionales para un año
 */
export async function importNationalHolidays(
  year: number,
  db: any,
  userId: string
): Promise<HolidayImportResult> {
  return importHolidaysFromAPI(
    { year },
    db,
    userId
  )
}

/**
 * Importa feriados provinciales para Río Negro
 */
export async function importRioNegroHolidays(
  year: number,
  db: any,
  userId: string
): Promise<HolidayImportResult> {
  return importHolidaysFromAPI(
    { 
      year, 
      province: 'RN',
      city: 'Viedma' // Capital de Río Negro
    },
    db,
    userId
  )
}

/**
 * Importa feriados para múltiples ciudades de Río Negro
 */
export async function importRioNegroCitiesHolidays(
  year: number,
  db: any,
  userId: string
): Promise<HolidayImportResult> {
  const cities = MAIN_CITIES['RN']
  const totalResult: HolidayImportResult = {
    totalProcessed: 0,
    imported: 0,
    skipped: 0,
    errors: []
  }

  for (const city of cities) {
    try {
      const result = await importHolidaysFromAPI(
        { 
          year, 
          province: 'RN',
          city
        },
        db,
        userId
      )

      // Acumular resultados
      totalResult.totalProcessed += result.totalProcessed
      totalResult.imported += result.imported
      totalResult.skipped += result.skipped
      totalResult.errors.push(...result.errors.map(e => `${city}: ${e}`))

    } catch (error) {
      const errorMsg = `Error importando feriados para ${city}: ${error instanceof Error ? error.message : 'Unknown error'}`
      totalResult.errors.push(errorMsg)
    }
  }

  return totalResult
}

/**
 * Verifica si hay feriados disponibles para un año
 */
export async function checkHolidaysAvailability(year: number): Promise<boolean> {
  try {
    const response = await fetch(
      `https://apis.datos.gob.ar/feriados/v1.0/${year}`,
      { method: 'HEAD' }
    )
    return response.ok
  } catch {
    return false
  }
}

/**
 * Obtiene años disponibles para importación
 */
export function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  
  // Ofrecer años desde el actual hasta 3 años adelante
  for (let year = currentYear; year <= currentYear + 3; year++) {
    years.push(year)
  }
  
  // También ofrecer 2 años atrás
  for (let year = currentYear - 2; year < currentYear; year++) {
    years.push(year)
  }
  
  return years.sort()
}
