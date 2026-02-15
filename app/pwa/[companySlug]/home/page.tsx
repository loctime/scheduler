"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Calendar, FileText, Users, UserCircle } from "lucide-react"
import { PwaTodayScheduleCard } from "@/components/pwa-today-schedule-card"
import { UserStatusMenu } from "@/components/pwa/UserStatusMenu"
import { PwaViewerBadge, useViewer, notifyViewerChanged } from "@/components/pwa/PwaViewerBadge"
import { PwaEmployeeSelectorModal } from "@/components/pwa/PwaEmployeeSelectorModal"
import { ActionCard } from "@/components/pwa/ActionCard"
import { PWA_THEMES } from "@/lib/pwa-themes"
import { useOwnerIdFromSlug, useEmployeesByOwnerId } from "@/hooks/use-owner-data"
import { useToast } from "@/hooks/use-toast"

export default function PwaHomePage() {
  const params = useParams()
  const companySlug = params.companySlug as string
  const viewer = useViewer()
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false)
  const { toast } = useToast()
  const { ownerId } = useOwnerIdFromSlug(companySlug)
  const { employees } = useEmployeesByOwnerId(ownerId)

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
          <div className="flex items-center gap-1 shrink-0">
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
        </div>
        <PwaTodayScheduleCard companySlug={companySlug} variant="inline" />
      </div>

      {/* Dos columnas debajo del header */}
      <div className="grid grid-cols-2 flex-1 min-h-0 w-full">
        {/* Columna izquierda (50%): espacio para más información después */}
        <div className="flex flex-col p-4 lg:p-8 border-r border-border/50 min-w-0 overflow-auto" />

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
