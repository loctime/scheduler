"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Calendar, Clock, Share2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { usePublicHorario } from "@/hooks/use-public-horario"
import { useToast } from "@/hooks/use-toast"

export default function PublicHorarioPage() {
  const params = useParams()
  const ownerId = params.ownerId as string
  const { horario, isLoading, error } = usePublicHorario(ownerId)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      toast({
        title: "Enlace copiado",
        description: "El enlace del horario ha sido copiado al portapapeles",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace",
        variant: "destructive"
      })
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Horario Semanal",
          text: `Horario de ${horario?.companyName}`,
          url: window.location.href
        })
      } catch (error) {
        console.log("Share cancelled or failed:", error)
      }
    } else {
      handleCopyUrl()
    }
  }

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      })
    }
  }, [error, toast])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-24" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!horario) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-gray-500 mb-4">
              <Calendar className="h-12 w-12 mx-auto" />
            </div>
            <h1 className="text-lg font-semibold mb-2">No hay horario publicado</h1>
            <p className="text-gray-600 text-sm mb-4">
              No hay ningún horario publicado para este identificador.
            </p>
            <p className="text-gray-500 text-xs">
              El administrador debe publicar un horario desde el dashboard.
            </p>
            <div className="mt-4 text-xs text-gray-400">
              ID: {ownerId}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                {horario.companyName}
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Horario semanal público
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Publicado
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex items-center gap-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {copied ? "Copiado" : "Compartir"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Week Info */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="text-center">
            <div className="font-semibold text-gray-900">
              Semana {horario.weekData.weekNumber} de {new Date(horario.weekData.year, horario.weekData.month).toLocaleDateString('es-AR', { month: 'long' })}
            </div>
            <div className="text-sm text-gray-600">
              {horario.weekData.startDate} - {horario.weekData.endDate}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ID: {horario.publishedWeekId}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Content */}
      <div className="max-w-4xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horario Semanal
            </CardTitle>
            <p className="text-sm text-gray-600">
              Semana {horario.weekData.weekNumber} - {horario.weekData.startDate} al {horario.weekData.endDate}
            </p>
          </CardHeader>
          <CardContent>
            {horario.weekData.assignments ? (
              <div className="space-y-4">
                {Object.entries(horario.weekData.assignments).map(([date, dayAssignments]) => (
                  <div key={date} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 text-gray-900">
                      {new Date(date).toLocaleDateString('es-AR', { 
                        weekday: 'long', 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric' 
                      })}
                    </h3>
                    <div className="grid gap-2">
                      {Object.entries(dayAssignments).map(([employeeId, assignments]) => (
                        <div key={employeeId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium text-gray-900">
                            Empleado {employeeId}
                          </span>
                          <div className="flex gap-1">
                            {Array.isArray(assignments) && assignments.length > 0 ? (
                              assignments.map((assignment, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {assignment.shift || assignment.turno || 'Turno'}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-xs text-gray-500">
                                Sin asignación
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay asignaciones para esta semana</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Horario actualizado: {horario.updatedAt ? new Date(horario.updatedAt.toDate()).toLocaleDateString('es-AR') : 'Desconocido'}</p>
          <p className="mt-1">Este horario es de solo lectura</p>
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="flex items-center gap-2"
            >
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copied ? "Enlace copiado" : "Copiar enlace"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
