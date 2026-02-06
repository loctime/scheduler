"use client"

import { Suspense } from "react"
import { HorariosMensualesContent, HorariosMensualesLoading } from "@/components/horarios-mensuales-content"

export default function HorariosMensualesPage() {
  return (
    <Suspense fallback={<HorariosMensualesLoading />}>
      <HorariosMensualesContent />
    </Suspense>
  )
}
