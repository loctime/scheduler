import { redirect } from "next/navigation"

/**
 * Redirect para compatibilidad: /pwa/stock-console/[slug] → /pwa/[slug]/stock-console
 */
export default async function PwaStockConsoleRedirectPage({
  params,
}: {
  params: Promise<{ companySlug: string }>
}) {
  const { companySlug } = await params
  redirect(`/pwa/${companySlug}/stock-console`)
}
