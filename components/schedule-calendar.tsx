"use client"

import { useState, useEffect, useCallback } from "react"
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { CreateScheduleDialog } from "@/components/create-schedule-dialog"
import { ScheduleGrid } from "@/components/schedule-grid"
import { useToast } from "@/hooks/use-toast"
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns"
import { es } from "date-fns/locale"
import { useData } from "@/contexts/data-context"
import { Horario } from "@/lib/types"
import { validateScheduleAssignments } from "@/lib/validations"

interface ScheduleCalendarProps {
  user: any
}

export function ScheduleCalendar({ user }: ScheduleCalendarProps) {
  const [schedules, setSchedules] = useState<Horario[]>([])
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<Horario | null>(null)
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()
  const { employees, shifts, loading: dataLoading } = useData()

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

  const handleCreateSchedule = useCallback(
    async (scheduleData: { nombre: string; assignments: any }) => {
      try {
        // Validaciones
        if (employees.length === 0) {
          toast({
            title: "Error de validación",
            description: "Debes tener al menos un empleado registrado para crear horarios",
            variant: "destructive",
          })
          return
        }

        if (shifts.length === 0) {
          toast({
            title: "Error de validación",
            description: "Debes tener al menos un turno configurado para crear horarios",
            variant: "destructive",
          })
          return
        }

        const weekStartStr = format(weekStart, "yyyy-MM-dd")
        const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd")
        const userName = user?.displayName || user?.email || "Usuario desconocido"
        const userId = user?.uid || ""

        // Validar solapamientos
        const overlaps = validateScheduleAssignments(scheduleData.assignments, employees, shifts)
        if (overlaps.length > 0) {
          const overlapMessages = overlaps.map((o) => o.message).join("\n")
          toast({
            title: "Advertencia: Solapamientos detectados",
            description: overlapMessages,
            variant: "destructive",
          })
          // Continuar de todas formas, pero informar al usuario
        }

        // Check if schedule already exists
        const existingSchedule = schedules.find((s) => s.weekStart === weekStartStr)

        if (existingSchedule) {
          // Guardar versión anterior en historial antes de actualizar
          const historyData = {
            horarioId: existingSchedule.id,
            nombre: existingSchedule.nombre || `Semana del ${weekStartStr}`,
            semanaInicio: existingSchedule.semanaInicio || weekStartStr,
            semanaFin: existingSchedule.semanaFin || weekEndStr,
            assignments: existingSchedule.assignments || {},
            createdAt: existingSchedule.updatedAt || existingSchedule.createdAt || serverTimestamp(),
            createdBy: existingSchedule.createdBy || existingSchedule.modifiedBy || userId,
            createdByName: existingSchedule.createdByName || existingSchedule.modifiedByName || userName,
            accion: "modificado" as const,
            versionAnterior: true,
          }

          await addDoc(collection(db, COLLECTIONS.HISTORIAL), historyData)

          // Update existing schedule
          await updateDoc(doc(db, COLLECTIONS.SCHEDULES, existingSchedule.id), {
            ...scheduleData,
            nombre: scheduleData.nombre || existingSchedule.nombre || `Semana del ${weekStartStr}`,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            updatedAt: serverTimestamp(),
            modifiedBy: userId,
            modifiedByName: userName,
          })

          toast({
            title: "Horario actualizado",
            description: "El horario se ha actualizado correctamente. La versión anterior se guardó en el historial.",
          })
        } else {
          // Create new schedule
          const newScheduleData = {
            ...scheduleData,
            nombre: scheduleData.nombre || `Semana del ${weekStartStr}`,
            weekStart: weekStartStr,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
          }

          const scheduleRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), newScheduleData)

          // Guardar en historial como "creado"
          await addDoc(collection(db, COLLECTIONS.HISTORIAL), {
            horarioId: scheduleRef.id,
            nombre: newScheduleData.nombre,
            semanaInicio: weekStartStr,
            semanaFin: weekEndStr,
            assignments: scheduleData.assignments || {},
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
        }
        setDialogOpen(false)
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Ocurrió un error al guardar el horario",
          variant: "destructive",
        })
      }
    },
    [employees, shifts, schedules, weekStart, user, toast],
  )

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
          <Button onClick={() => setDialogOpen(true)} disabled={dataLoading || employees.length === 0 || shifts.length === 0} aria-label={selectedSchedule ? "Editar horario" : "Crear horario"}>
            <Plus className="mr-2 h-4 w-4" />
            {selectedSchedule ? "Editar Horario" : "Crear Horario"}
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
        <ScheduleGrid weekDays={weekDays} employees={employees} shifts={shifts} schedule={selectedSchedule} />
      )}

      {/* Create/Edit Schedule Dialog */}
      <CreateScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateSchedule}
        weekDays={weekDays}
        employees={employees}
        shifts={shifts}
        existingSchedule={selectedSchedule}
      />
    </div>
  )
}
