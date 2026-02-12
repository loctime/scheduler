"use client"

import { useParams } from "next/navigation"
import { PwaShell } from "@/components/pwa/pwa-shell"
import PublicHorarioPage from "@/components/public-horario-page"

export default function PwaHorarioPublicPage() {
  const params = useParams()
  const companySlug = params.companySlug as string

  return (
    <PwaShell>
      <PublicHorarioPage companySlug={companySlug} />
    </PwaShell>
  )
}
