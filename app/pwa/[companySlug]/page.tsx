import { redirect } from "next/navigation"

export default function PwaCompanyEntryPage({
  params,
}: {
  params: { companySlug: string }
}) {
  redirect(`/pwa/${params.companySlug}/horario`)
}
