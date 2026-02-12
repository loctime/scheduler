import { redirect } from "next/navigation"

/**
 * Redirección: /pwa/horario/[companySlug] → /pwa/[companySlug]/horario
 * Mantiene enlaces antiguos funcionando.
 */
export default function PwaHorarioRedirectPage({
  params,
}: {
  params: { companySlug: string }
}) {
  redirect(`/pwa/${params.companySlug}/horario`)
}
