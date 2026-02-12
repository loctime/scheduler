import { redirect } from "next/navigation"

/**
 * Panel PWA requiere slug: /pwa/[companySlug]/home
 * Sin slug se redirige a /pwa (404).
 */
export default function PwaHomeEntryPage() {
  redirect("/pwa")
}
