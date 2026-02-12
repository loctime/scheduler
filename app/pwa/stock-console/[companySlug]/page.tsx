import { redirect } from "next/navigation"

/**
 * Redirección: /pwa/stock-console/[companySlug] → /pwa/[companySlug]/stock-console
 * Mantiene enlaces antiguos funcionando.
 */
export default function PwaStockConsoleRedirectPage({
  params,
}: {
  params: { companySlug: string }
}) {
  redirect(`/pwa/${params.companySlug}/stock-console`)
}
