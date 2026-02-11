"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CalendarDays } from "lucide-react"
import { usePublicHorario } from "@/hooks/use-public-horario"

export function PublicMensualPage({ companySlug }: { companySlug: string }) {
  const { horario, isLoading, error } = usePublicHorario(companySlug)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error || !horario) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>No disponible</CardTitle>
          </CardHeader>
          <CardContent>{error || "No hay información pública mensual."}</CardContent>
        </Card>
      </div>
    )
  }

  const weeks = Object.values(horario.weeks || {})

  return (
    <div className="min-h-screen bg-muted/20 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{horario.companyName || "Vista mensual"}</h1>
          <Badge>Público</Badge>
        </div>
        {weeks.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">No hay semanas publicadas.</CardContent>
          </Card>
        ) : (
          weeks.map((week: any) => (
            <Card key={week.weekId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" />
                  {week.weekLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Empleados publicados: {week.employees?.length || 0}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
