"use client"

import { useParams } from "next/navigation"
import { Calendar, FileText, Users } from "lucide-react"
import { PwaTodayScheduleCard } from "@/components/pwa-today-schedule-card"
import { UserStatusMenu } from "@/components/pwa/UserStatusMenu"
import { PwaViewerBadge } from "@/components/pwa/PwaViewerBadge"
import { ActionCard } from "@/components/pwa/ActionCard"

export default function PwaHomePage() {
  const params = useParams()
  const companySlug = params.companySlug as string

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold text-foreground">{companySlug}</h1>
                <p className="text-muted-foreground">
                  Horarios y Stock
                </p>
              </div>
              <div className="flex items-center gap-1">
                <PwaViewerBadge companySlug={companySlug} />
                <UserStatusMenu />
              </div>
            </div>
            <PwaTodayScheduleCard companySlug={companySlug} variant="inline" />
          </div>

          {/* Main Navigation Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <ActionCard
              icon={<Calendar className="h-8 w-8 text-primary shrink-0" />}
              title="Horario"
              description="Horarios publicados esta semana"
              href={`/pwa/${companySlug}/horario`}
            />
            <ActionCard
              icon={<FileText className="h-8 w-8 text-primary shrink-0" />}
              title="Horarios completos"
              description="Vista individual histórico"
              href={`/pwa/${companySlug}/mensual`}
            />
            <ActionCard
              icon={<Users className="h-8 w-8 text-primary shrink-0" />}
              title="Stock Console"
              description="Gestión de stock"
              href={`/pwa/${companySlug}/stock-console`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
