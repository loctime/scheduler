"use client"

import { useState, useEffect, useCallback } from "react"
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { ScheduleGrid } from "@/components/schedule-grid"
import { useToast } from "@/hooks/use-toast"
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns"
import { es } from "date-fns/locale"
import { useData } from "@/contexts/data-context"
import { Horario, ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"
import { validateScheduleAssignments, validateDailyHours } from "@/lib/validations"
import { useConfig } from "@/hooks/use-config"

interface ScheduleCalendarProps {
  user: any
}

export function ScheduleCalendar({ user }: ScheduleCalendarProps) {
  const [schedules, setSchedules] = useState<Horario[]>([])
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedSchedule, setSelectedSchedule] = useState<Horario | null>(null)
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()
  const { employees, shifts, loading: dataLoading } = useData()
  const { config } = useConfig()

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    // Solo crear listeners si el usuario está autenticado
    if (!user) {
      return
    }

    let unsubscribeSchedules: (() => void) | null = null

    const schedulesQuery = query(collection(db, COLLECTIONS.SCHEDULES), orderBy("weekStart", "desc"))
    unsubscribeSchedules = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        const schedulesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Horario[]
        setSchedules(schedulesData)

        // Load current week schedule
        const currentWeekSchedule = schedulesData.find((s) => s.weekStart === format(weekStart, "yyyy-MM-dd"))
        setSelectedSchedule(currentWeekSchedule || null)
      },
      (error) => {
        console.error("Error en listener de horarios:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los horarios. Verifica tus permisos.",
          variant: "destructive",
        })
      },
    )

    return () => {
      if (unsubscribeSchedules) unsubscribeSchedules()
    }
  }, [weekStart, user, toast])

  const handleExportImage = useCallback(async () => {
    const element = document.getElementById("schedule-grid")
    if (!element) return

    setExporting(true)
    try {
      // Lazy load html2canvas
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
      })
      const link = document.createElement("a")
      link.download = `horario-${format(weekStart, "yyyy-MM-dd")}.png`
      link.href = canvas.toDataURL()
      link.click()
      toast({
        title: "Imagen exportada",
        description: "El horario se ha exportado como imagen",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al exportar la imagen",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }, [weekStart, toast])

  const handleExportPDF = useCallback(async () => {
    const element = document.getElementById("schedule-grid")
    if (!element) return

    setExporting(true)
    try {
      // Lazy load ambas librerías
      const [html2canvas, jsPDF] = await Promise.all([
        import("html2canvas").then((m) => m.default),
        import("jspdf").then((m) => m.default),
      ])

      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
      })
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("l", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
      pdf.save(`horario-${format(weekStart, "yyyy-MM-dd")}.pdf`)
      toast({
        title: "PDF exportado",
        description: "El horario se ha exportado como PDF",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al exportar el PDF",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }, [weekStart, toast])

  const handleShiftUpdate = useCallback(
    async (date: string, employeeId: string, shiftIds: string[]) => {
      try {
        // Validaciones básicas
        if (employees.length === 0) {
          toast({
            title: "Error",
            description: "Debes tener al menos un empleado registrado",
            variant: "destructive",
          })
          return
        }

        if (shifts.length === 0) {
          toast({
            title: "Error",
            description: "Debes tener al menos un turno configurado",
            variant: "destructive",
          })
          return
        }

        const weekStartStr = format(weekStart, "yyyy-MM-dd")
        const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd")
        const userName = user?.displayName || user?.email || "Usuario desconocido"
        const userId = user?.uid || ""

        let scheduleId: string
        let currentAssignments: Record<string, Record<string, string[]>> = {}
        let scheduleNombre = `Semana del ${weekStartStr}`

        // Si no existe horario, crearlo. Si existe, actualizarlo
        if (!selectedSchedule) {
          // Crear nuevo horario
          currentAssignments = {
            [date]: {
              [employeeId]: shiftIds,
            },
          }

          const newScheduleData = {
            nombre: scheduleNombre,
            weekStart: weekStartStr,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            assignments: currentAssignments,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
          }

          const scheduleRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), newScheduleData)
          scheduleId = scheduleRef.id

          // Guardar en historial como "creado"
          await addDoc(collection(db, COLLECTIONS.HISTORIAL), {
            horarioId: scheduleId,
            nombre: scheduleNombre,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            assignments: currentAssignments,
            createdAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
            accion: "creado" as const,
            versionAnterior: false,
          })

          toast({
            title: "Horario creado",
            description: "El horario se ha creado correctamente",
          })
        } else {
          // Actualizar horario existente
          scheduleId = selectedSchedule.id
          scheduleNombre = selectedSchedule.nombre || scheduleNombre

          // Guardar versión anterior en historial antes de actualizar
          const historyData = {
            horarioId: selectedSchedule.id,
            nombre: scheduleNombre,
            semanaInicio: selectedSchedule.semanaInicio || weekStartStr,
            semanaFin: selectedSchedule.semanaFin || weekEndStr,
            assignments: { ...selectedSchedule.assignments },
            createdAt: selectedSchedule.updatedAt || selectedSchedule.createdAt || serverTimestamp(),
            createdBy: selectedSchedule.createdBy || selectedSchedule.modifiedBy || userId,
            createdByName: selectedSchedule.createdByName || selectedSchedule.modifiedByName || userName,
            accion: "modificado" as const,
            versionAnterior: true,
          }

          await addDoc(collection(db, COLLECTIONS.HISTORIAL), historyData)

          // Actualizar assignments
          currentAssignments = {
            ...selectedSchedule.assignments,
          }
          if (!currentAssignments[date]) {
            currentAssignments[date] = {}
          }
          currentAssignments[date] = {
            ...currentAssignments[date],
            [employeeId]: shiftIds,
          }
        }

        // Validar solapamientos solo para este empleado y fecha
        const overlaps = validateScheduleAssignments(currentAssignments, employees, shifts)
        const relevantOverlaps = overlaps.filter(
          (o) => o.employeeId === employeeId && o.date === date,
        )
        if (relevantOverlaps.length > 0) {
          const overlapMessages = relevantOverlaps.map((o) => o.message).join("\n")
          toast({
            title: "Advertencia: Solapamientos detectados",
            description: overlapMessages,
            variant: "destructive",
          })
          // Continuar de todas formas, pero informar al usuario
        }

        // Validar horas máximas por día
        if (config) {
          const minutosDescanso = config.minutosDescanso || 30
          const horasMinimasParaDescanso = config.horasMinimasParaDescanso || 6
          const horasMaximasPorDia = config.horasMaximasPorDia || 8

          const employeeShifts = currentAssignments[date]?.[employeeId] || []
          if (employeeShifts.length > 0) {
            const dailyValidation = validateDailyHours(
              employeeShifts,
              shifts,
              horasMaximasPorDia,
              minutosDescanso,
              horasMinimasParaDescanso
            )
            if (!dailyValidation.valid) {
              const employee = employees.find((e) => e.id === employeeId)
              toast({
                title: "Advertencia: Horas máximas por día excedidas",
                description: `${employee?.name || "Empleado"} - ${dailyValidation.message}`,
                variant: "destructive",
              })
            }
          }
        }

        // Actualizar o crear en Firestore
        if (selectedSchedule) {
          // Actualizar existente
          await updateDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId), {
            assignments: currentAssignments,
            updatedAt: serverTimestamp(),
            modifiedBy: userId,
            modifiedByName: userName,
          })

          toast({
            title: "Turnos actualizados",
            description: "Los turnos se han actualizado correctamente",
          })
        }
        // Si no existe, ya se creó arriba
      } catch (error: any) {
        console.error("Error al actualizar turnos:", error)
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al actualizar los turnos",
          variant: "destructive",
        })
      }
    },
    [selectedSchedule, weekStart, user, employees, shifts, config, toast],
  )

  // Nueva función para manejar asignaciones con horarios ajustados
  const handleAssignmentUpdate = useCallback(
    async (date: string, employeeId: string, assignments: ShiftAssignment[]) => {
      try {
        // Validaciones básicas
        if (employees.length === 0) {
          toast({
            title: "Error",
            description: "Debes tener al menos un empleado registrado",
            variant: "destructive",
          })
          return
        }

        if (shifts.length === 0) {
          toast({
            title: "Error",
            description: "Debes tener al menos un turno configurado",
            variant: "destructive",
          })
          return
        }

        if (!db) {
          toast({
            title: "Error",
            description: "Firebase no está configurado",
            variant: "destructive",
          })
          return
        }

        const weekStartStr = format(weekStart, "yyyy-MM-dd")
        const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd")
        const userName = user?.displayName || user?.email || "Usuario desconocido"
        const userId = user?.uid || ""

        let scheduleId: string
        let currentAssignments: Record<string, Record<string, ShiftAssignmentValue>> = {}
        let scheduleNombre = `Semana del ${weekStartStr}`

        // Si no existe horario, crearlo. Si existe, actualizarlo
        if (!selectedSchedule) {
          // Crear nuevo horario con formato nuevo
          currentAssignments = {
            [date]: {
              [employeeId]: assignments,
            },
          }

          const newScheduleData = {
            nombre: scheduleNombre,
            weekStart: weekStartStr,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            assignments: currentAssignments,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
          }

          const scheduleRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), newScheduleData)
          scheduleId = scheduleRef.id

          // Guardar en historial como "creado"
          await addDoc(collection(db, COLLECTIONS.HISTORIAL), {
            horarioId: scheduleId,
            nombre: scheduleNombre,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            assignments: currentAssignments,
            createdAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
            accion: "creado" as const,
            versionAnterior: false,
          })

          toast({
            title: "Horario creado",
            description: "El horario se ha creado correctamente",
          })
        } else {
          // Actualizar horario existente
          scheduleId = selectedSchedule.id
          scheduleNombre = selectedSchedule.nombre || scheduleNombre

          // Guardar versión anterior en historial antes de actualizar
          const historyData = {
            horarioId: selectedSchedule.id,
            nombre: scheduleNombre,
            semanaInicio: selectedSchedule.semanaInicio || weekStartStr,
            semanaFin: selectedSchedule.semanaFin || weekEndStr,
            assignments: { ...selectedSchedule.assignments },
            createdAt: selectedSchedule.updatedAt || selectedSchedule.createdAt || serverTimestamp(),
            createdBy: selectedSchedule.createdBy || selectedSchedule.modifiedBy || userId,
            createdByName: selectedSchedule.createdByName || selectedSchedule.modifiedByName || userName,
            accion: "modificado" as const,
            versionAnterior: true,
          }

          await addDoc(collection(db, COLLECTIONS.HISTORIAL), historyData)

          // Actualizar assignments (convertir asignaciones antiguas al nuevo formato si es necesario)
          currentAssignments = {
            ...selectedSchedule.assignments,
          }
          if (!currentAssignments[date]) {
            currentAssignments[date] = {}
          }
          currentAssignments[date] = {
            ...currentAssignments[date],
            [employeeId]: assignments,
          }
        }

        // Validar solapamientos (necesita convertir a formato compatible)
        // Por ahora mantenemos la validación básica
        const shiftIds = assignments.map((a) => a.shiftId)
        const overlaps = validateScheduleAssignments(
          { [date]: { [employeeId]: shiftIds } },
          employees,
          shifts
        )
        const relevantOverlaps = overlaps.filter(
          (o) => o.employeeId === employeeId && o.date === date,
        )
        if (relevantOverlaps.length > 0) {
          const overlapMessages = relevantOverlaps.map((o) => o.message).join("\n")
          toast({
            title: "Advertencia: Solapamientos detectados",
            description: overlapMessages,
            variant: "destructive",
          })
        }

        // Validar horas máximas por día (necesita adaptar para horarios ajustados)
        if (config) {
          const minutosDescanso = config.minutosDescanso || 30
          const horasMinimasParaDescanso = config.horasMinimasParaDescanso || 6
          const horasMaximasPorDia = config.horasMaximasPorDia || 8

          // Por ahora validamos con los IDs de turnos (las validaciones necesitarán actualizarse)
          const dailyValidation = validateDailyHours(
            shiftIds,
            shifts,
            horasMaximasPorDia,
            minutosDescanso,
            horasMinimasParaDescanso
          )
          if (!dailyValidation.valid) {
            const employee = employees.find((e) => e.id === employeeId)
            toast({
              title: "Advertencia: Horas máximas por día excedidas",
              description: `${employee?.name || "Empleado"} - ${dailyValidation.message}`,
              variant: "destructive",
            })
          }
        }

        // Actualizar o crear en Firestore
        if (selectedSchedule) {
          // Actualizar existente
          await updateDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId), {
            assignments: currentAssignments,
            updatedAt: serverTimestamp(),
            modifiedBy: userId,
            modifiedByName: userName,
          })

          toast({
            title: "Turnos actualizados",
            description: "Los turnos se han actualizado correctamente",
          })
        }
        // Si no existe, ya se creó arriba
      } catch (error: any) {
        console.error("Error al actualizar asignaciones:", error)
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al actualizar los turnos",
          variant: "destructive",
        })
      }
    },
    [selectedSchedule, weekStart, user, employees, shifts, config, toast],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold text-foreground">
            Semana del {format(weekStart, "d", { locale: es })} -{" "}
            {format(addDays(weekStart, 6), "d 'de' MMMM, yyyy", { locale: es })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportImage} disabled={exporting || !selectedSchedule} aria-label="Exportar como imagen">
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Imagen
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={exporting || !selectedSchedule} aria-label="Exportar como PDF">
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Schedule Grid */}
      {dataLoading ? (
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Cargando datos...</p>
        </Card>
      ) : employees.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No hay empleados registrados. Agrega empleados para crear horarios.</p>
        </Card>
      ) : shifts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No hay turnos configurados. Agrega turnos para crear horarios.</p>
        </Card>
      ) : (
        <ScheduleGrid
          weekDays={weekDays}
          employees={employees}
          shifts={shifts}
          schedule={selectedSchedule}
          onAssignmentUpdate={handleAssignmentUpdate}
        />
      )}
    </div>
  )
}
