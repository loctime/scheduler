"use client"

import { useParams } from "next/navigation"
import PublicHorarioPage from "@/components/public-horario-page"

export default function HorariosPublicPage() {
  const params = useParams()
  const scheduleId = params.scheduleId as string

  return <PublicHorarioPage scheduleId={scheduleId} />
}
