"use client"

import { useParams } from "next/navigation"
import { PwaShell } from "@/components/pwa/pwa-shell"
import { PublicMensualPage } from "@/components/pwa/public-mensual-page"

export default function PwaMensualPublicPage() {
  const params = useParams()
  const companySlug = params.companySlug as string

  return (
    <PwaShell>
      <PublicMensualPage companySlug={companySlug} />
    </PwaShell>
  )
}
