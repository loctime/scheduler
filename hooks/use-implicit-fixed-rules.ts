import { useEffect, useCallback, useMemo } from "react"
import { format, startOfWeek, addDays, getDay, parseISO } from "date-fns"
import { collection, doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { ShiftAssignment, EmployeeFixedRule, Horario, Turno } from "@/lib/types"
import { useEmployeeFixedRules } from "./use-employee-fixed-rules"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"

interface UseImplicitFixedRulesProps {
  user: any
  employees: Array<{ id: string; name: string }>
  shifts: Turno[]
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
  getWeekSchedule: (weekStartDate: Date) => Horario | null
  onWeekScheduleCreated?: (schedule: Horario) => void
}

/**
 * Hook para implementar generación IMPLÍCITA de horarios fijos
 * 
 * Comportamiento:
 * 1. Al entrar a una semana, detecta si está vacía para un empleado
 * 2. Si está vacía, aplica reglas fijas existentes automáticamente
 * 3. Si NO está vacía, no hace nada (no sobrescribe ediciones manuales)
 */
export function useImplicitFixedRules({
  user,
  employees,
  shifts,
  weekStartsOn,
  getWeekSchedule,
  onWeekScheduleCreated,
}: UseImplicitFixedRulesProps) {
  const { toast } = useToast()
  
  // GUARD: Solo ejecutar en dashboard (usuario autenticado con rol adecuado)
  const isDashboardContext = useMemo(() => {
    // Verificar si estamos en contexto de dashboard
    if (typeof window === 'undefined') return false
    
    const isDashboardPage = window.location.pathname.startsWith('/dashboard')
    const hasValidUser = user && user.uid
    const isAdmin = user?.role === 'admin' || user?.role === 'manager'
    
    return isDashboardPage && hasValidUser && isAdmin
  }, [user])

  const { getRuleForDay, rules: fixedRules } = useEmployeeFixedRules({ 
    ownerId: user?.uid 
  })

  /**
   * Determina si una semana está vacía para un empleado específico
   * 
   * "Semana vacía" = no existe ninguna asignación guardada para ese employeeId en esa semana
   */
  const isWeekEmptyForEmployee = useCallback((
    weekSchedule: Horario | null,
    employeeId: string,
    weekStartDate: Date
  ): boolean => {
    // Si no existe schedule, está vacío
    if (!weekSchedule) return true

    // Revisar todos los días de la semana buscando asignaciones para este empleado
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = addDays(weekStartDate, dayOffset)
      const dateStr = format(date, "yyyy-MM-dd")
      
      const employeeAssignments = weekSchedule.assignments?.[dateStr]?.[employeeId]
      
      // Si encontramos asignaciones (array no vacío), la semana NO está vacía
      if (employeeAssignments && Array.isArray(employeeAssignments) && employeeAssignments.length > 0) {
        return false
      }
    }

    // Si no encontramos asignaciones en ningún día, la semana está vacía
    return true
  }, [])

  /**
   * Limpia campos undefined de los assignments para Firestore
   */
  const cleanAssignmentsForFirestore = useCallback((
    assignments: ShiftAssignment[]
  ): ShiftAssignment[] => {
    return assignments.map(assignment => {
      const cleaned: any = {}
      
      Object.entries(assignment).forEach(([key, value]) => {
        // Solo incluir el campo si no es undefined
        if (value !== undefined) {
          cleaned[key] = value
        }
      })
      
      return cleaned as ShiftAssignment
    })
  }, [])

  /**
   * Genera asignaciones basadas en reglas fijas para un empleado en una semana
   */
  const generateAssignmentsFromRules = useCallback((
    employeeId: string,
    weekStartDate: Date
  ): Record<string, ShiftAssignment[]> => {
    const assignments: Record<string, ShiftAssignment[]> = {}

    // Para cada día de la semana
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = addDays(weekStartDate, dayOffset)
      const dateStr = format(date, "yyyy-MM-dd")
      const dayOfWeek = getDay(date)

      // Buscar regla fija para este empleado y día
      const rule = getRuleForDay(employeeId, dayOfWeek)
      if (rule) {
        // Convertir regla a asignaciones
        const ruleAssignments = convertRuleToAssignments(rule, shifts)
        
        if (ruleAssignments.length > 0) {
          // Limpiar campos undefined antes de guardar
          assignments[dateStr] = cleanAssignmentsForFirestore(ruleAssignments)
          
          logger.info("[ImplicitFixedRules] Aplicando regla fija", {
            employeeId,
            date: dateStr,
            dayOfWeek,
            ruleType: rule.type,
            shiftId: rule.shiftId,
            assignmentsCount: ruleAssignments.length
          })
        }
      }
    }

    return assignments
  }, [getRuleForDay, shifts, cleanAssignmentsForFirestore])

  /**
   * Convierte una regla fija a asignaciones con formato completo
   */
  const convertRuleToAssignments = useCallback((
    rule: EmployeeFixedRule,
    shifts: Turno[]
  ): ShiftAssignment[] => {
    if (rule.type === "OFF") {
      return [{ type: "franco" }]
    }

    if (rule.type === "SHIFT" && rule.shiftId) {
      const shift = shifts.find(s => s.id === rule.shiftId)
      if (shift) {
        const assignment: ShiftAssignment = {
          type: "shift",
          shiftId: rule.shiftId,
          startTime: shift.startTime || "",
          endTime: shift.endTime || ""
        }

        // Solo agregar segunda franja si existe en el turno
        if (shift.startTime2 && shift.endTime2) {
          assignment.startTime2 = shift.startTime2
          assignment.endTime2 = shift.endTime2
        }

        return [assignment]
      } else {
        logger.warn("[ImplicitFixedRules] Turno no encontrado para regla", {
          ruleId: rule.id,
          shiftId: rule.shiftId
        })
      }
    }

    return []
  }, [shifts])

  /**
   * Crea un nuevo schedule con asignaciones de reglas fijas
   */
  const createScheduleWithFixedRules = useCallback(async (
    weekStartDate: Date,
    employeeId: string,
    assignments: Record<string, ShiftAssignment[]>
  ): Promise<Horario | null> => {
    if (!db || !user) {
      logger.error("[ImplicitFixedRules] No hay conexión a base de datos o usuario", {
        hasDb: !!db,
        hasUser: !!user,
        userId: user?.uid
      })
      return null
    }

    try {
      const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
      const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")
      const userName = user?.displayName || user?.email || "Usuario desconocido"
      const userId = user?.uid || ""

      logger.info("[ImplicitFixedRules] Intentando crear schedule", {
        weekStart: weekStartStr,
        employeeId,
        userId,
        assignmentsCount: Object.keys(assignments).length,
        hasDb: !!db,
        collection: COLLECTIONS.SCHEDULES
      })

      // VERIFICACIÓN DE ROLES ANTES DE INTENTAR CREAR
      // Esto es para prevenir errores de permisos y dar mejor feedback
      try {
        const userDocRef = doc(db, COLLECTIONS.USERS, userId)
        const userDoc = await getDoc(userDocRef)
        
        if (!userDoc.exists()) {
          logger.error("[ImplicitFixedRules] Usuario no tiene documento en users collection", {
            userId,
            userEmail: user?.email
          })
          toast({
            title: "Error de Configuración",
            description: "Tu usuario no está configurado correctamente. Contacta al administrador.",
            variant: "destructive"
          })
          return null
        }

        const userData = userDoc.data()
        const userRole = userData?.role
        
        logger.debug("[ImplicitFixedRules] Datos del usuario verificados", {
          userId,
          userRole,
          hasRole: !!userRole,
          userDataKeys: Object.keys(userData || {})
        })

        // Verificar que el usuario tenga un rol válido
        const validRoles = ['user', 'admin', 'maxdev', 'branch', 'factory', 'manager']
        if (!userRole || !validRoles.includes(userRole)) {
          logger.error("[ImplicitFixedRules] Usuario sin rol válido", {
            userId,
            userRole,
            validRoles
          })
          toast({
            title: "Error de Permisos",
            description: "Tu usuario no tiene un rol válido asignado. Contacta al administrador.",
            variant: "destructive"
          })
          return null
        }

      } catch (roleCheckError: any) {
        logger.error("[ImplicitFixedRules] Error verificando rol del usuario", {
          userId,
          error: roleCheckError?.message || 'Unknown error'
        })
        toast({
          title: "Error de Verificación",
          description: "No se pudo verificar tu rol. Intenta recargar la página.",
          variant: "destructive"
        })
        return null
      }

      // Crear assignments structure para el schedule
      const scheduleAssignments: Record<string, Record<string, ShiftAssignment[]>> = {}
      
      Object.entries(assignments).forEach(([date, employeeAssignments]) => {
        if (!scheduleAssignments[date]) {
          scheduleAssignments[date] = {}
        }
        scheduleAssignments[date][employeeId] = employeeAssignments
      })

      const newScheduleData = {
        nombre: `Semana del ${weekStartStr}`,
        weekStart: weekStartStr,
        semanaInicio: weekStartStr,
        semanaFin: weekEndStr,
        assignments: scheduleAssignments,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
        createdByName: userName,
        completada: false
      }

      logger.debug("[ImplicitFixedRules] Datos a guardar:", {
        documentId: weekStartStr,
        collection: COLLECTIONS.SCHEDULES,
        dataKeys: Object.keys(newScheduleData),
        hasAssignments: Object.keys(scheduleAssignments).length > 0,
        createdBy: userId
      })

      const docRef = doc(collection(db, COLLECTIONS.SCHEDULES), weekStartStr)
      await setDoc(docRef, newScheduleData)
      
      const newSchedule = { id: weekStartStr, ...newScheduleData } as Horario

      logger.info("[ImplicitFixedRules] Schedule creado con éxito", {
        weekStart: weekStartStr,
        employeeId,
        assignmentsCount: Object.keys(assignments).length,
        documentId: weekStartStr,
        createdBy: userId
      })

      // Notificar que se creó un nuevo schedule
      if (onWeekScheduleCreated) {
        onWeekScheduleCreated(newSchedule)
      }

      return newSchedule
    } catch (error: any) {
      logger.error("[ImplicitFixedRules] Error creando schedule:", {
        error: error?.message || 'Unknown error',
        errorCode: error?.code,
        errorInfo: error?.errorInfo,
        weekStart: format(weekStartDate, "yyyy-MM-dd"),
        employeeId,
        userId: user?.uid,
        hasUser: !!user,
        userEmail: user?.email,
        collection: COLLECTIONS.SCHEDULES
      })

      // Mensaje específico para errores de permisos
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        toast({
          title: "Error de Permisos",
          description: "No tienes permisos para crear horarios. Verifica que tu usuario esté configurado correctamente.",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Error",
          description: "No se pudo crear el horario automáticamente",
          variant: "destructive"
        })
      }
      
      return null
    }
  }, [db, user, onWeekScheduleCreated, toast])

  /**
   * Función principal: aplica reglas fijas si la semana está vacía
   */
  const applyFixedRulesIfWeekEmpty = useCallback(async (
    weekStartDate: Date,
    employeeId: string
  ): Promise<Horario | null> => {
    // GUARD: Solo ejecutar en dashboard
    if (!isDashboardContext) {
      // Silenciosamente bloquear ejecución - comportamiento esperado, no es un error
      // No loguear nada para evitar advertencias en consola
      return null
    }

    // Solo loguear cuando realmente se va a ejecutar
    logger.debug("[ImplicitFixedRules] Aplicando reglas fijas", {
      weekStart: format(weekStartDate, "yyyy-MM-dd"),
      employeeId
    })
    const weekSchedule = getWeekSchedule(weekStartDate)
    
    // 1. Detectar si la semana está vacía para este empleado
    const isEmpty = isWeekEmptyForEmployee(weekSchedule, employeeId, weekStartDate)
    
    logger.debug("[ImplicitFixedRules] Verificando semana vacía", {
      weekStart: format(weekStartDate, "yyyy-MM-dd"),
      employeeId,
      isEmpty,
      hasSchedule: !!weekSchedule
    })

    if (!isEmpty) {
      // La semana NO está vacía, no hacer nada
      return weekSchedule
    }

    // 2. Si está vacía, aplicar reglas fijas existentes
    const assignmentsFromRules = generateAssignmentsFromRules(employeeId, weekStartDate)
    
    if (Object.keys(assignmentsFromRules).length === 0) {
      // No hay reglas fijas para este empleado en esta semana
      logger.debug("[ImplicitFixedRules] No hay reglas fijas para aplicar", {
        employeeId,
        weekStart: format(weekStartDate, "yyyy-MM-dd")
      })
      return weekSchedule
    }

    // 3. Crear schedule con las asignaciones de reglas fijas
    const newSchedule = await createScheduleWithFixedRules(
      weekStartDate,
      employeeId,
      assignmentsFromRules
    )

    if (newSchedule) {
      toast({
        title: "Horarios fijos aplicados",
        description: `Se aplicaron automáticamente ${Object.keys(assignmentsFromRules).length} reglas fijas para la semana`,
      })
    }

    return newSchedule
  }, [
    getWeekSchedule,
    isWeekEmptyForEmployee,
    generateAssignmentsFromRules,
    createScheduleWithFixedRules,
    toast
  ])

  /**
   * Aplica reglas fijas para múltiples empleados (para carga inicial)
   */
  const applyFixedRulesForMultipleEmployees = useCallback(async (
    weekStartDate: Date,
    employeeIds: string[]
  ): Promise<void> => {
    const results = await Promise.allSettled(
      employeeIds.map(employeeId => 
        applyFixedRulesIfWeekEmpty(weekStartDate, employeeId)
      )
    )

    const successful = results.filter(r => r.status === "fulfilled").length
    const failed = results.filter(r => r.status === "rejected").length

    if (failed > 0) {
      logger.warn("[ImplicitFixedRules] Algunas aplicaciones fallaron", {
        successful,
        failed,
        total: employeeIds.length
      })
    }
  }, [applyFixedRulesIfWeekEmpty])

  // Memoizar valores para evitar renders innecesarios
  const hasFixedRules = useMemo(() => {
    return fixedRules.length > 0
  }, [fixedRules])

  return {
    applyFixedRulesIfWeekEmpty,
    applyFixedRulesForMultipleEmployees,
    isWeekEmptyForEmployee,
    generateAssignmentsFromRules,
    hasFixedRules
  }
}
