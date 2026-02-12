"use client"

import { useParams, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Share2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useMonthlySchedule } from "@/hooks/use-monthly-schedule"
import { MonthlyScheduleView } from "@/components/monthly-schedule-view"

/**
 * Página PWA de horarios mensuales públicos.
 * No usa AuthContext ni DataProvider.
 * Renderiza directamente con useMonthlySchedule(companySlug).
 */
export default function PwaMensualPublicPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const companySlug = params.companySlug as string
  const { toast } = useToast()

  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : undefined

  const {
    monthGroups,
    companyName,
    isLoading,
    error,
    calculateMonthlyStats,
  } = useMonthlySchedule({
    companySlug,
    year: Number.isFinite(year) ? year : undefined,
    month: Number.isFinite(month) && month! >= 1 && month! <= 12 ? month : undefined,
    employees: [],
    shifts: [],
    monthStartDay: 1,
    weekStartsOn: 1,
  })

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast({
        title: "Enlace copiado",
        description: "El enlace del horario mensual se ha copiado al portapapeles",
      })
    } catch {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando horario mensual...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Link href="/pwa">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!companyName || monthGroups.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Sin horarios publicados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Esta empresa aún no ha publicado horarios mensuales.
            </p>
            <Link href={`/pwa/horario/${companySlug}`}>
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Ver horario semanal
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{companyName}</h1>
              <p className="text-sm text-muted-foreground">Horario mensual público</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Compartir
              </Button>
              <Link href={`/pwa/horario/${companySlug}`}>
                <Button variant="outline" size="sm">
                  Ver semanal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MonthlyScheduleView
          monthGroups={monthGroups}
          companyName={companyName}
          employees={[]}
          shifts={[]}
          monthStartDay={1}
          isLoading={false}
          calculateMonthlyStats={calculateMonthlyStats}
          readonly
        />
      </div>
    </div>
  )
}
