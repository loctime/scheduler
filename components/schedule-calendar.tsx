"use client"

import { useState, useEffect } from "react"
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { CreateScheduleDialog } from "@/components/create-schedule-dialog"
import { ScheduleGrid } from "@/components/schedule-grid"
import { useToast } from "@/hooks/use-toast"
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns"
import { es } from "date-fns/locale"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

interface ScheduleCalendarProps {
  user: any
}

export function ScheduleCalendar({ user }: ScheduleCalendarProps) {
  const [schedules, setSchedules] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null)
  const { toast } = useToast()

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    const schedulesQuery = query(collection(db, "schedules"), orderBy("weekStart", "desc"))
    const unsubscribeSchedules = onSnapshot(schedulesQuery, (snapshot) => {
      const schedulesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setSchedules(schedulesData)

      // Load current week schedule
      const currentWeekSchedule = schedulesData.find((s) => s.weekStart === format(weekStart, "yyyy-MM-dd"))
      setSelectedSchedule(currentWeekSchedule || null)
    })

    const employeesQuery = query(collection(db, "employees"), orderBy("name"))
    const unsubscribeEmployees = onSnapshot(employeesQuery, (snapshot) => {
      setEmployees(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    })

    const shiftsQuery = query(collection(db, "shifts"), orderBy("name"))
    const unsubscribeShifts = onSnapshot(shiftsQuery, (snapshot) => {
      setShifts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    })

    return () => {
      unsubscribeSchedules()
      unsubscribeEmployees()
      unsubscribeShifts()
    }
  }, [weekStart])

  const handleCreateSchedule = async (scheduleData: any) => {
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

      // Check if schedule already exists
      const existingSchedule = schedules.find((s) => s.weekStart === weekStartStr)

      if (existingSchedule) {
        // Guardar versión anterior en historial antes de actualizar
        const historyData = {
          horarioId: existingSchedule.id,
          nombre: existingSchedule.nombre || `Semana del ${weekStartStr}`,
          semanaInicio: existingSchedule.semanaInicio || weekStartStr,
          semanaFin: existingSchedule.semanaFin || weekEndStr,
          asignaciones: existingSchedule.assignments || {},
          createdAt: existingSchedule.updatedAt || existingSchedule.createdAt || serverTimestamp(),
          createdBy: existingSchedule.createdBy || existingSchedule.modifiedBy || userId,
          createdByName: existingSchedule.createdByName || existingSchedule.modifiedByName || userName,
          accion: "modificado",
          versionAnterior: true,
        }

        await addDoc(collection(db, "historial"), historyData)

        // Update existing schedule
        await updateDoc(doc(db, "schedules", existingSchedule.id), {
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

        const scheduleRef = await addDoc(collection(db, "schedules"), newScheduleData)

        // Guardar en historial como "creado"
        await addDoc(collection(db, "historial"), {
          horarioId: scheduleRef.id,
          nombre: newScheduleData.nombre,
          semanaInicio: weekStartStr,
          semanaFin: weekEndStr,
          asignaciones: scheduleData.assignments || {},
          createdAt: serverTimestamp(),
          createdBy: userId,
          createdByName: userName,
          accion: "creado",
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
  }

  const handleExportImage = async () => {
    const element = document.getElementById("schedule-grid")
    if (!element) return

    try {
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
    }
  }

  const handleExportPDF = async () => {
    const element = document.getElementById("schedule-grid")
    if (!element) return

    try {
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
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold text-foreground">
            Semana del {format(weekStart, "d", { locale: es })} -{" "}
            {format(addDays(weekStart, 6), "d 'de' MMMM, yyyy", { locale: es })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportImage}>
            <Download className="mr-2 h-4 w-4" />
            Imagen
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {selectedSchedule ? "Editar Horario" : "Crear Horario"}
          </Button>
        </div>
      </div>

      {/* Schedule Grid */}
      {employees.length === 0 ? (
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
