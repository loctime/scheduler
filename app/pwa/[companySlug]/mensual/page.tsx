import { redirect } from "next/navigation"

/**
 * Redirección: la vista mensual PWA usa ahora /pwa/mensual?uid=XXXX
 * (misma fuente que el dashboard: schedules por ownerId).
 * Ya no se usa companySlug ni el endpoint público.
 * /pwa/[companySlug]/mensual → /pwa/mensual
 */
export default function PwaMensualLegacyRedirect() {
  redirect("/pwa/mensual")
}
