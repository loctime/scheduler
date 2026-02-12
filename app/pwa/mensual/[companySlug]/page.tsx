import { redirect } from "next/navigation"

/**
 * Redirección: /pwa/mensual/[companySlug] → /pwa/[companySlug]/mensual
 * Mantiene enlaces antiguos funcionando.
 */
export default function PwaMensualRedirectPage({
  params,
}: {
  params: { companySlug: string }
}) {
  redirect(`/pwa/${params.companySlug}/mensual`)
}
