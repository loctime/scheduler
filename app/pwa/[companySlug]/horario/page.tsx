"use client"

import { useParams } from "next/navigation"
import PublicHorarioPage from "@/components/public-horario-page"
import { ZoomableImage } from "@/components/ZoomableImage"

export default function PwaHorarioPublicPage() {
  const params = useParams()
  const companySlug = params.companySlug as string

  return <PublicHorarioPage companySlug={companySlug} ImageWrapper={ZoomableImage} />
}
