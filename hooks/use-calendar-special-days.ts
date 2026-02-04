/**
 * Hook para gestionar días especiales del calendario
 */

import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, writeBatch, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'
import type { 
  CalendarSpecialDay, 
  SpecialDaysFilter, 
  FormattedSpecialDay,
  SchedulingWarning 
} from '@/lib/types/calendar-special-days'
import { 
  formatSpecialDayForUI, 
  filterSpecialDays, 
  generateSchedulingWarnings,
  generateSpecialDayId 
} from '@/lib/calendar-special-days'

interface UseCalendarSpecialDaysOptions {
  autoSubscribe?: boolean
  initialFilter?: SpecialDaysFilter
}

interface UseCalendarSpecialDaysReturn {
  // Datos
  specialDays: CalendarSpecialDay[]
  formattedSpecialDays: FormattedSpecialDay[]
  loading: boolean
  error: string | null
  
  // Filtros
  filter: SpecialDaysFilter
  setFilter: (filter: SpecialDaysFilter) => void
  
  // Acciones
  addSpecialDay: (specialDay: Omit<CalendarSpecialDay, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateSpecialDay: (id: string, updates: Partial<CalendarSpecialDay>) => Promise<void>
  deleteSpecialDay: (id: string) => Promise<void>
  
  // Utilidades
  getSpecialDaysInDateRange: (startDate: string, endDate: string) => FormattedSpecialDay[]
  getSchedulingWarnings: (startDate: string, endDate: string) => SchedulingWarning[]
  isSpecialDay: (date: string, city?: string) => FormattedSpecialDay | null
  refresh: () => void
}

export function useCalendarSpecialDays(
  options: UseCalendarSpecialDaysOptions = {}
): UseCalendarSpecialDaysReturn {
  const { autoSubscribe = true, initialFilter = {} } = options
  
  const [specialDays, setSpecialDays] = useState<CalendarSpecialDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<SpecialDaysFilter>(initialFilter)
  
  const { toast } = useToast()

  // Verificar que db esté disponible
  const getFirestore = () => {
    if (!db) {
      throw new Error('Firestore no está inicializado')
    }
    return db
  }

  // Construir query según filtros
  const buildQuery = () => {
    const firestore = getFirestore()
    const collectionRef = collection(firestore, 'apps/horarios/calendarSpecialDays')
    let constraints = []

    // Aplicar filtros que se pueden traducir a queries de Firestore
    if (filter.city) {
      constraints.push(where('city', '==', filter.city))
    }
    if (filter.province) {
      constraints.push(where('province', '==', filter.province))
    }
    if (filter.country) {
      constraints.push(where('country', '==', filter.country))
    }
    if (filter.type) {
      constraints.push(where('type', '==', filter.type))
    }
    if (filter.scope) {
      constraints.push(where('scope', '==', filter.scope))
    }
    if (filter.severity) {
      constraints.push(where('severity', '==', filter.severity))
    }
    if (filter.source) {
      constraints.push(where('source', '==', filter.source))
    }
    if (filter.affectsScheduling !== undefined) {
      constraints.push(where('affectsScheduling', '==', filter.affectsScheduling))
    }

    // Siempre ordenar por fecha
    constraints.push(orderBy('date', 'asc'))

    return constraints.length > 0 
      ? query(collectionRef, ...constraints)
      : query(collectionRef, orderBy('date', 'asc'))
  }

  // Suscripción a cambios en tiempo real
  useEffect(() => {
    if (!autoSubscribe) return

    setLoading(true)
    setError(null)

    const q = buildQuery()
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const days: CalendarSpecialDay[] = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          days.push({
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          } as CalendarSpecialDay)
        })
        
        setSpecialDays(days)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching special days:', err)
        setError(err.message)
        setLoading(false)
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los días especiales',
          variant: 'destructive'
        })
      }
    )

    return () => unsubscribe()
  }, [filter, autoSubscribe])

  // Formatear días especiales para UI
  const formattedSpecialDays = specialDays.map(formatSpecialDayForUI)

  // Agregar día especial
  const addSpecialDay = async (specialDayData: Omit<CalendarSpecialDay, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const firestore = getFirestore()
      const id = generateSpecialDayId(specialDayData.city, specialDayData.date)
      const specialDay: CalendarSpecialDay = {
        ...specialDayData,
        id,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const docRef = doc(firestore, 'apps/horarios/calendarSpecialDays', id)
      await setDoc(docRef, specialDay)

      toast({
        title: 'Día especial agregado',
        description: `${specialDay.title} ha sido agregado correctamente.`
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error adding special day:', err)
      toast({
        title: 'Error',
        description: 'No se pudo agregar el día especial',
        variant: 'destructive'
      })
      throw new Error(errorMessage)
    }
  }

  // Actualizar día especial
  const updateSpecialDay = async (id: string, updates: Partial<CalendarSpecialDay>) => {
    try {
      const firestore = getFirestore()
      const docRef = doc(firestore, 'apps/horarios/calendarSpecialDays', id)
      
      const updateData = {
        ...updates,
        updatedAt: new Date()
      }

      await updateDoc(docRef, updateData)

      toast({
        title: 'Día especial actualizado',
        description: 'Los cambios han sido guardados correctamente.'
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error updating special day:', err)
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el día especial',
        variant: 'destructive'
      })
      throw new Error(errorMessage)
    }
  }

  // Eliminar día especial
  const deleteSpecialDay = async (id: string) => {
    try {
      const firestore = getFirestore()
      const docRef = doc(firestore, 'apps/horarios/calendarSpecialDays', id)
      await deleteDoc(docRef)

      toast({
        title: 'Día especial eliminado',
        description: 'El día especial ha sido eliminado correctamente.'
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error deleting special day:', err)
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el día especial',
        variant: 'destructive'
      })
      throw new Error(errorMessage)
    }
  }

  // Obtener días especiales en un rango de fechas
  const getSpecialDaysInDateRange = (startDate: string, endDate: string): FormattedSpecialDay[] => {
    const filtered = filterSpecialDays(specialDays, { startDate, endDate })
    return filtered.map(formatSpecialDayForUI)
  }

  // Generar advertencias para generación de horarios
  const getSchedulingWarnings = (startDate: string, endDate: string): SchedulingWarning[] => {
    return generateSchedulingWarnings(specialDays, startDate, endDate)
  }

  // Verificar si una fecha es día especial
  const isSpecialDay = (date: string, city?: string): FormattedSpecialDay | null => {
    const day = specialDays.find(d => d.date === date)
    
    if (!day) return null
    
    // Si se especifica ciudad, verificar que coincida o que sea nacional
    if (city) {
      if (day.scope === 'nacional') return formatSpecialDayForUI(day)
      if (day.city.toLowerCase() === city.toLowerCase()) return formatSpecialDayForUI(day)
      return null
    }
    
    return formatSpecialDayForUI(day)
  }

  // Refrescar datos
  const refresh = () => {
    setLoading(true)
    setError(null)
    // El efecto se encargará de recargar los datos
  }

  return {
    // Datos
    specialDays,
    formattedSpecialDays,
    loading,
    error,
    
    // Filtros
    filter,
    setFilter,
    
    // Acciones
    addSpecialDay,
    updateSpecialDay,
    deleteSpecialDay,
    
    // Utilidades
    getSpecialDaysInDateRange,
    getSchedulingWarnings,
    isSpecialDay,
    refresh
  }
}

/**
 * Hook para importación de feriados
 */
export function useHolidayImport() {
  const [importing, setImporting] = useState(false)
  const { toast } = useToast()

  // Verificar que db esté disponible
  const getFirestore = () => {
    if (!db) {
      throw new Error('Firestore no está inicializado')
    }
    return db
  }

  const importNationalHolidays = async (year: number) => {
    setImporting(true)
    try {
      const { importNationalHolidays } = await import('@/lib/services/holidays-api')
      const { auth } = await import('@/lib/firebase')
      
      if (!auth?.currentUser) {
        throw new Error('Usuario no autenticado')
      }

      const result = await importNationalHolidays(year, getFirestore(), auth.currentUser.uid)

      toast({
        title: 'Importación completada',
        description: `Se importaron ${result.imported} feriados nacionales de ${year}.`
      })

      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error importing national holidays:', err)
      toast({
        title: 'Error en importación',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setImporting(false)
    }
  }

  const importRioNegroHolidays = async (year: number) => {
    setImporting(true)
    try {
      const { importRioNegroHolidays } = await import('@/lib/services/holidays-api')
      const { auth } = await import('@/lib/firebase')
      
      if (!auth?.currentUser) {
        throw new Error('Usuario no autenticado')
      }

      const result = await importRioNegroHolidays(year, getFirestore(), auth.currentUser.uid)

      toast({
        title: 'Importación completada',
        description: `Se importaron ${result.imported} feriados de Río Negro de ${year}.`
      })

      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error importing Rio Negro holidays:', err)
      toast({
        title: 'Error en importación',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setImporting(false)
    }
  }

  const importRioNegroCitiesHolidays = async (year: number) => {
    setImporting(true)
    try {
      const { importRioNegroCitiesHolidays } = await import('@/lib/services/holidays-api')
      const { auth } = await import('@/lib/firebase')
      
      if (!auth?.currentUser) {
        throw new Error('Usuario no autenticado')
      }

      const result = await importRioNegroCitiesHolidays(year, getFirestore(), auth.currentUser.uid)

      toast({
        title: 'Importación completada',
        description: `Se importaron ${result.imported} feriados de ciudades de Río Negro de ${year}.`
      })

      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error importing Rio Negro cities holidays:', err)
      toast({
        title: 'Error en importación',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setImporting(false)
    }
  }

  return {
    importing,
    importNationalHolidays,
    importRioNegroHolidays,
    importRioNegroCitiesHolidays
  }
}
