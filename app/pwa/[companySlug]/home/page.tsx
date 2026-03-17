"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar, FileText, Users, UserCircle, CheckSquare } from "lucide-react"
import { PwaTodayScheduleCard } from "@/components/pwa-today-schedule-card"
import { UserStatusMenu } from "@/components/pwa/UserStatusMenu"
import { PwaViewerBadge, useViewer, notifyViewerChanged } from "@/components/pwa/PwaViewerBadge"
import { PwaEmployeeSelectorModal } from "@/components/pwa/PwaEmployeeSelectorModal"
import { ActionCard } from "@/components/pwa/ActionCard"
import { PWA_THEMES } from "@/lib/pwa-themes"
import { useOwnerIdFromSlug, useEmployeesByOwnerId } from "@/hooks/use-owner-data"
import { useToast } from "@/hooks/use-toast"
import { DayCellContent } from "@/components/schedule-grid/components/day-cell-content"
import { useTodayScheduleCellData } from "@/hooks/use-today-schedule-cell-data"
import { Skeleton } from "@/components/ui/skeleton"
import { useTasks } from "@/hooks/use-tasks"
import { useDailyTaskStatus } from "@/hooks/use-daily-task-status"
import { AlertTriangle, Check, ChevronDown, ChevronUp } from "lucide-react"
import { isTaskForToday } from "@/lib/tasks/is-task-for-today"

// Constantes para mensajes informativos
const MENSAJES_DEL_DIA = [
   "Hoy también vinimos a trabajar, increíble.",
  "La puntualidad no muerde. Probala.",
  "Respirar, pensar… y después actuar.",
  "Si funciona, no lo toques. Si no funciona, tampoco lo rompas más.",
  "El café ayuda, pero no hace milagros.",
  "Ordenar ahora evita llorar después.",
  "Sí, hay que hacerlo igual.",
  "El trabajo en equipo empieza por no desaparecer.",
  "Hoy no es viernes… pero podemos fingir.",
  "Si no sabés qué hacer, empezá por lo obvio.",
  "Menos drama, más soluciones.",
  "Tu sector te está mirando.",
  "Proactividad: eso que pasa antes de que te lo pidan.",
  "Hacerlo bien lleva casi lo mismo que hacerlo mal.",
  "Un problema menos si lo resolvés ahora.",
  "El futuro vos agradece el esfuerzo de hoy.",
  "No era tan difícil, ¿viste?",
  "Que no se note el lunes.",
  "Respirá… no es tan grave.",
  "Si sobrevivimos a ayer, hoy también."
]

/**
 * Obtiene el mensaje del día basado en la fecha actual.
 * Usa el día del año para seleccionar un mensaje constante durante todo el día.
 */
function getMensajeDelDia(): string {
  const today = new Date()
  const startOfYear = new Date(today.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
  const index = dayOfYear % MENSAJES_DEL_DIA.length
  return MENSAJES_DEL_DIA[index]
}

export default function PwaHomePage() {
  const params = useParams()
  const companySlug = params.companySlug as string
  const viewer = useViewer()
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false)
  const { toast } = useToast()
  const { ownerId } = useOwnerIdFromSlug(companySlug)
  const { employees } = useEmployeesByOwnerId(ownerId)
  
  // Mensaje del día (memoizado para recalcular solo cuando cambia la fecha)
  const mensajeDelDia = useMemo(() => getMensajeDelDia(), [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header a ancho completo */}
      <div className="flex flex-col gap-4 p-4 lg:p-8 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold text-foreground">{companySlug}</h1>
            <p className="text-muted-foreground">
              Horarios y Stock
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {viewer?.employeeName && (
                <p className="text-muted-foreground font-medium">{viewer.employeeName}</p>
              )}
              <button
                type="button"
                onClick={() => setShowEmployeeSelector(true)}
                className="shrink-0 rounded-full p-0 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Cambiar empleado"
              >
                {viewer ? (
                  <PwaViewerBadge companySlug={undefined} />
                ) : (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <UserCircle className="h-5 w-5" />
                  </span>
                )}
              </button>
              <UserStatusMenu />
            </div>
            <PwaTodayScheduleCard companySlug={companySlug} variant="inline" />
          </div>
        </div>
      </div>

      {/* Dos columnas debajo del header */}
      <div className="grid grid-cols-2 flex-1 min-h-0 w-full pb-20">
        {/* Columna izquierda (50%): celda del día de hoy */}
        <div className="flex flex-col p-4 lg:p-8 border-r border-border/50 min-w-0 items-center justify-start bg-transparent">
          <div className="flex-1 overflow-auto w-full">
            {viewer?.employeeId ? (
              <TodayScheduleCell companySlug={companySlug} employeeId={viewer.employeeId} />
            ) : (
              <div className="text-center text-muted-foreground">
                <p className="text-sm">Selecciona un empleado para ver tu horario de hoy</p>
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha (50%): solo los 3 botones, alineados arriba */}
        <div className="flex flex-col gap-3 p-4 lg:p-8 justify-start min-w-0">
          <ActionCard
            icon={<FileText className="h-8 w-8 text-primary shrink-0" />}
            title="Mensual"
            description="Vista individual histórico"
            href={`/pwa/${companySlug}/mensual`}
            borderClassName={PWA_THEMES.mensual.border}
          />
          <ActionCard
            icon={<Calendar className="h-8 w-8 text-primary shrink-0" />}
            title="Horario"
            description="Horarios publicados esta semana"
            href={`/pwa/${companySlug}/horario`}
            borderClassName={PWA_THEMES.horario.border}
          />
          <ActionCard
            icon={<Users className="h-8 w-8 text-primary shrink-0" />}
            title="Stock"
            description="Gestión de stock"
            href={`/pwa/${companySlug}/stock-console`}
            borderClassName={PWA_THEMES.stock.border}
          />
          
          {/* Mensaje del Día (Dinámico) - Debajo de la card de Stock */}
          <div className="bg-primary/5 rounded-lg border py-3 px-3 text-xs sm:text-sm text-center w-full">
            {mensajeDelDia}
          </div>
        </div>
      </div>

      <PwaEmployeeSelectorModal
        open={showEmployeeSelector}
        onClose={() => setShowEmployeeSelector(false)}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        onSelect={(employeeId, employeeName) => {
          const v = { employeeId, employeeName }
          if (typeof window !== "undefined") {
            localStorage.setItem("horario.viewer", JSON.stringify(v))
            notifyViewerChanged(v)
          }
          toast({ title: "Identificación guardada", description: `Hola, ${employeeName}` })
          setShowEmployeeSelector(false)
        }}
      />
    </div>
  )
}

/**
 * Componente que renderiza la celda del día de hoy usando el mismo diseño que el calendario semanal.
 * Usa DayCellContent para mantener consistencia visual.
 * 
 * Memoizado para evitar renders innecesarios cuando las props no cambian.
 */
function TodayScheduleCell({ companySlug, employeeId }: { companySlug: string; employeeId: string }) {
  const { ownerId } = useOwnerIdFromSlug(companySlug)
  const viewer = useViewer()
  
  const {
    assignments,
    dayStatus,
    backgroundStyle,
    getShiftInfo,
    mediosTurnos,
    hasIncompleteAssignments,
    isLoading,
    error,
  } = useTodayScheduleCellData({ companySlug, employeeId })
  
  // Tareas para este empleado
  const { tasks } = useTasks(viewer?.employeeId, ownerId)
  
  // Estado de tareas completadas (sistema unificado)
  const { completed, toggleTask } = useDailyTaskStatus(ownerId)
  
  // Filtrar tareas del día usando lógica centralizada (excluir reference)
  const todayDate = new Date()
  const todayTasks = tasks.filter(t => 
    t.taskType !== "reference" && isTaskForToday(t, todayDate)
  )
  
  // Separar pendientes y realizadas
  const pendientes = todayTasks.filter(t => !completed[t.id])
  const realizadas = todayTasks.filter(t => completed[t.id])
  const hasPendientes = pendientes.length > 0
  const allCompleted = realizadas.length === todayTasks.length && todayTasks.length > 0
  
  // Estado para expandir/ocultar el panel de acciones principales
  const [expanded, setExpanded] = useState(hasPendientes)
  
  // Efecto para sincronizar estado expandido cuando cambian los datos
  useEffect(() => {
    if (hasPendientes) {
      setExpanded(true)
    } else if (allCompleted) {
      // Solo contraer si todas están completadas y no hay tareas pendientes
      setExpanded(false)
    }
  }, [hasPendientes, allCompleted])
  
  // Auditoría: Loggear completed para renderizado
  console.log("🔍 AUDITORÍA RENDER:")
  console.log("  - completed:", completed)
  console.log("  - todayTasks:", todayTasks.map(t => ({ id: t.id, title: t.title })))
  console.log("  - expanded (panel principal):", expanded)
  
  
  // Memoizar props para DayCellContent
  const dayCellContentProps = useMemo(
    () => ({
      assignments,
      dayStatus,
      backgroundStyle,
      getShiftInfo,
      mediosTurnos,
      hasIncompleteAssignments,
    }),
    [assignments, dayStatus, backgroundStyle, getShiftInfo, mediosTurnos, hasIncompleteAssignments]
  )

  if (isLoading) {
    return (
      <div className="w-full max-w-md space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-muted-foreground">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  const today = new Date()
  const todayFormatted = format(today, "dd/MM/yy")
  const dayOfWeek = format(today, "EEEE", { locale: es })
  
  // Mensaje fijo (cambia si es domingo)
  const mensajeFijo = today.getDay() === 0 
    ? "Revisá el cronograma de la semana."
    : "Si no llegas a horario, firmá el papel."

  return (
    <div className="w-full max-w-md space-y-2">
      {/* Recuadro único que contiene día, horario y mensaje */}
      <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
        <div className="text-center text-lg sm:text-xl md:text-2xl font-semibold text-foreground">
        {dayOfWeek} {todayFormatted}
        </div>
        <DayCellContent {...dayCellContentProps} homeMode={true} />
        
        {/* Mensaje Fijo */}
        <div className="bg-muted/40 rounded-lg py-2 px-2 text-xs text-center">
          {mensajeFijo}
        </div>
      </div>
      
      {/* Bloque 2 - Tareas del Día */}
      {todayTasks.length > 0 && (
        <div className={`${hasPendientes 
          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400" 
          : "bg-green-50 dark:bg-green-950/40 border-green-400"
        } border rounded-xl p-3 mt-2 cursor-pointer transition-all`}
          onClick={() => {
            console.log("🔍 AUDITORÍA PANEL: Toggle expanded", !expanded)
            setExpanded(!expanded)
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${hasPendientes ? "text-amber-600" : "text-green-600"}`} />
            <span className={`font-semibold text-sm ${hasPendientes 
              ? "text-amber-800 dark:text-amber-200" 
              : "text-green-800 dark:text-green-200"
            }`}>
              Pendientes del día
            </span>
          </div>
          {expanded && (
            <div className="space-y-2">
              {todayTasks.map((task: any, index: number) => {
                const isCompleted = completed[task.id]
                
                console.log("🔍 AUDITORÍA RENDER TAREA:")
                console.log("  - task.id:", task.id)
                console.log("  - task.title:", task.title)
                console.log("  - completed:", completed)
                console.log("  - isCompleted:", isCompleted)
                
                return (
                  <div key={task.id} className="space-y-1">
                    {/* Tarea NO completada - mostrar normal */}
                    {!isCompleted ? (
                      <div className="border border-amber-200 dark:border-amber-700 rounded-lg p-2 space-y-1 bg-amber-50/50 dark:bg-amber-950/30">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-amber-900 dark:text-amber-100">
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                {task.description}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => toggleTask(task.id)}
                            className="shrink-0 p-1 rounded border border-amber-300 bg-amber-100 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/50 dark:hover:bg-amber-800 transition-colors"
                            title="Marcar como realizada"
                          >
                            <Check className="w-4 h-4 text-amber-600" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Tarea completada - mostrar compactada */
                      <div className="border border-green-200 dark:border-green-700 rounded-lg p-2 bg-green-50/50 dark:bg-green-950/30">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-600" />
                              <span className="font-medium text-sm text-green-800 dark:text-green-200 line-through opacity-70">
                                {task.title}
                              </span>
                            </div>
                            <div className="text-xs text-green-700 dark:text-green-300 pl-6">
                               {viewer?.employeeName || 'Desconocido'}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleTask(task.id)}
                            className="shrink-0 p-1 rounded border border-green-300 bg-green-100 hover:bg-green-200 dark:border-green-600 dark:bg-green-900/50 dark:hover:bg-green-800 transition-colors"
                            title="Desmarcar como realizada"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
