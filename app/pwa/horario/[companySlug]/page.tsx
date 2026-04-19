import { redirect } from "next/navigation"

/**
 * Redirección: /pwa/horario/[companySlug] → /pwa/[companySlug]/horario
 * Mantiene enlaces antiguos funcionando.
 */
export default async function PwaHorarioRedirectPage({
  params,
}: {
  params: Promise<{ companySlug: string }>
}) {
  const { companySlug } = await params
  redirect(`/pwa/${companySlug}/horario`)
}
