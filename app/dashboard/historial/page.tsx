"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { collection, query, orderBy, onSnapshot, limit, where } from "firebase/firestore"
import { auth, db, isFirebaseConfigured } from "@/lib/firebase"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Calendar, GitCompare, Eye } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { ScheduleGrid } from "@/components/schedule-grid"

export default function HistorialPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [selectedVersion, setSelectedVersion] = useState<any>(null)
  const [compareVersions, setCompareVersions] = useState<{ v1: any | null; v2: any | null }>({
    v1: null,
    v2: null,
  })
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [compareDialogOpen, setCompareDialogOpen] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      router.push("/")
      return
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/")
      } else {
        setUser(currentUser)
        setLoading(false)
      }
    })

    // Obtener historial ordenado por fecha descendente
    const historialQuery = query(collection(db, "historial"), orderBy("createdAt", "desc"), limit(50))
    const unsubscribeHistorial = onSnapshot(historialQuery, (snapshot) => {
      setHistorial(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    })

    // Obtener horarios actuales
    const schedulesQuery = query(collection(db, "schedules"), orderBy("weekStart", "desc"))
    const unsubscribeSchedules = onSnapshot(schedulesQuery, (snapshot) => {
      setSchedules(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    })

    // Obtener empleados y turnos para mostrar en comparación
    const employeesQuery = query(collection(db, "employees"), orderBy("name"))
    const unsubscribeEmployees = onSnapshot(employeesQuery, (snapshot) => {
      setEmployees(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    })

    const shiftsQuery = query(collection(db, "shifts"), orderBy("name"))
    const unsubscribeShifts = onSnapshot(shiftsQuery, (snapshot) => {
      setShifts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    })

    return () => {
      unsubscribeAuth()
      unsubscribeHistorial()
      unsubscribeSchedules()
      unsubscribeEmployees()
      unsubscribeShifts()
    }
  }, [router])

  const getAssignmentsCount = (item: any) => {
    if (!item.assignments) return 0
    let count = 0
    Object.values(item.assignments).forEach((dateAssignments: any) => {
      Object.values(dateAssignments).forEach((employeeShifts: any) => {
        count += employeeShifts.length
      })
    })
    return count
  }

  const getWeekDays = (semanaInicio: string) => {
    const start = parseISO(semanaInicio)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      return date
    })
  }

  const handleViewVersion = (version: any) => {
    setSelectedVersion(version)
    setViewDialogOpen(true)
  }

  const handleCompare = (version: any) => {
    if (!compareVersions.v1) {
      setCompareVersions({ v1: version, v2: null })
    } else if (!compareVersions.v2) {
      setCompareVersions({ v1: compareVersions.v1, v2: version })
      setCompareDialogOpen(true)
    }
  }

  const resetCompare = () => {
    setCompareVersions({ v1: null, v2: null })
    setCompareDialogOpen(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Agrupar historial por horarioId
  const historialBySchedule = historial.reduce((acc: any, item: any) => {
    const horarioId = item.horarioId || "sin-id"
    if (!acc[horarioId]) {
      acc[horarioId] = []
    }
    acc[horarioId].push(item)
    return acc
  }, {})

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Historial</h2>
            <p className="text-muted-foreground">
              Revisa todas las versiones de horarios creados y modificados anteriormente
            </p>
          </div>
          {compareVersions.v1 && !compareVersions.v2 && (
            <Button variant="outline" onClick={resetCompare}>
              Cancelar comparación
            </Button>
          )}
        </div>

        {historial.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay historial disponible. Crea y modifica horarios para ver el historial.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(historialBySchedule).map(([horarioId, versions]: [string, any]) => {
              const schedule = schedules.find((s) => s.id === horarioId)
              const scheduleName = schedule?.nombre || versions[0]?.nombre || "Horario sin nombre"

              return (
                <Card key={horarioId} className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">{scheduleName}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {versions.length} {versions.length === 1 ? "versión" : "versiones"} en el historial
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {versions.map((version: any, index: number) => {
                        const fecha =
                          version.createdAt?.toDate
                            ? version.createdAt.toDate()
                            : version.createdAt?.seconds
                            ? new Date(version.createdAt.seconds * 1000)
                            : version.createdAt
                            ? new Date(version.createdAt)
                            : new Date()
                        const assignmentsCount = getAssignmentsCount(version)
                        const isSelected = compareVersions.v1?.id === version.id || compareVersions.v2?.id === version.id

                        return (
                          <div
                            key={version.id}
                            className={`flex items-center justify-between rounded-lg border p-4 ${
                              isSelected ? "border-primary bg-accent" : "border-border bg-background"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                                <Calendar className="h-5 w-5 text-accent-foreground" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">
                                    {version.accion === "creado" ? "Creado" : `Modificado #${versions.length - index}`}
                                  </span>
                                  <Badge variant={version.accion === "creado" ? "default" : "secondary"}>
                                    {version.accion}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {assignmentsCount} turnos asignados •{" "}
                                  {format(fecha, "dd/MM/yyyy HH:mm", { locale: es })}
                                </p>
                                {version.createdByName && (
                                  <p className="text-xs text-muted-foreground">Por: {version.createdByName}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleViewVersion(version)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCompare(version)}
                                disabled={isSelected}
                              >
                                <GitCompare className="mr-2 h-4 w-4" />
                                {compareVersions.v1 && !compareVersions.v2 ? "Comparar con" : "Comparar"}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Dialog para ver versión */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-card">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">
                {selectedVersion?.accion === "creado" ? "Versión Creada" : "Versión Modificada"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {selectedVersion?.nombre && <span>Horario: {selectedVersion.nombre}</span>}
                {selectedVersion?.createdAt && (
                  <span>
                    {" • "}
                    {format(
                      selectedVersion.createdAt?.toDate
                        ? selectedVersion.createdAt.toDate()
                        : selectedVersion.createdAt?.seconds
                        ? new Date(selectedVersion.createdAt.seconds * 1000)
                        : new Date(selectedVersion.createdAt),
                      "dd/MM/yyyy HH:mm",
                      { locale: es },
                    )}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {selectedVersion && (
              <ScheduleGrid
                weekDays={getWeekDays(selectedVersion.semanaInicio || selectedVersion.weekStart)}
                employees={employees}
                shifts={shifts}
                schedule={selectedVersion}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog para comparar versiones */}
        <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-card">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">Comparar Versiones</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Compara dos versiones del mismo horario para ver los cambios
              </DialogDescription>
            </DialogHeader>
            {compareVersions.v1 && compareVersions.v2 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-semibold text-foreground">
                    Versión 1: {compareVersions.v1.accion === "creado" ? "Creado" : "Modificado"}
                  </h3>
                  <ScheduleGrid
                    weekDays={getWeekDays(compareVersions.v1.semanaInicio || compareVersions.v1.weekStart)}
                    employees={employees}
                    shifts={shifts}
                    schedule={compareVersions.v1}
                  />
                </div>
                <div>
                  <h3 className="mb-2 font-semibold text-foreground">
                    Versión 2: {compareVersions.v2.accion === "creado" ? "Creado" : "Modificado"}
                  </h3>
                  <ScheduleGrid
                    weekDays={getWeekDays(compareVersions.v2.semanaInicio || compareVersions.v2.weekStart)}
                    employees={employees}
                    shifts={shifts}
                    schedule={compareVersions.v2}
                  />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
