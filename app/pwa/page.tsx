import { notFound } from "next/navigation"

/**
 * El PWA requiere el slug en la URL: /pwa/[companySlug]
 * Ejemplo: /pwa/maximia → redirige a /pwa/maximia/horario
 * Sin slug no hay contexto multi-tenant; se muestra 404.
 */
export default function PwaEntryPage() {
  notFound()
}
