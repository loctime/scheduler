"use client"

import { useParams } from "next/navigation"
import PublicHorarioPage from "@/components/public-horario-page"

export default function PwaHorarioPublicPage() {
  const params = useParams()
  const companySlug = params.companySlug as string

  return <PublicHorarioPage companySlug={companySlug} />
}
