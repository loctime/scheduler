import { redirect } from "next/navigation"

/**
 * Stock console requiere slug en la URL: /pwa/[companySlug]/stock-console
 * Sin slug se redirige a /pwa (404).
 */
export default function PwaStockConsoleEntryPage() {
  redirect("/pwa")
}
