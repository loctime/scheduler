"use client"

import { useParams } from "next/navigation"
import { PublicMensualPage } from "@/components/pwa/public-mensual-page"

export default function PwaMensualPublicPage() {
  const params = useParams()
  const companySlug = params.companySlug as string

  return <PublicMensualPage companySlug={companySlug} />
}
