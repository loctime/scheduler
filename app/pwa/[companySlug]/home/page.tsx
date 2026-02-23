"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar, FileText, Users, UserCircle } from "lucide-react"
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

// Constantes para mensajes informativos
const MENSAJES_DEL_DIA = [
  "Tené un excelente día 🙌",
  "La puntualidad habla bien de vos.",
  "Cuidá tu sector como si fuera tu casa.",
  "Trabajo en equipo = mejores resultados.",
  "Si llegás antes, arrancás mejor.",
  "Organización primero, velocidad después.",
  "Todo suma.",
  "Hoy puede ser un gran día.",
  "La constancia hace la diferencia.",
  "Cada detalle importa.",
  "Responsabilidad y compromiso.",
  "Orden y limpieza primero."
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
          
          {/* Mensaje del Día (Dinámico) - Pegado al footer */}
          <div className="bg-primary/5 rounded-lg border py-3 px-3 text-xs sm:text-sm text-center w-full mt-4">
            {mensajeDelDia}
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
    : "Recordá fichar tu ingreso y mantener tu sector en orden."

  return (
    <div className="w-full max-w-md space-y-2">
      <div className="text-center text-lg sm:text-xl md:text-2xl font-semibold text-foreground">
      {dayOfWeek} {todayFormatted}
      </div>
      <DayCellContent {...dayCellContentProps} homeMode={true} />
      
      {/* Bloque 1 - Mensaje Fijo */}
      <div className="bg-muted/40 rounded-lg py-2 px-2 text-xs text-center mt-2">
        {mensajeFijo}
      </div>
    </div>
  )
}
