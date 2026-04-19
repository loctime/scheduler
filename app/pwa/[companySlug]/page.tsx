import { redirect } from "next/navigation"

export default async function PwaCompanyEntryPage({
  params,
}: {
  params: Promise<{ companySlug: string }>
}) {
  const { companySlug } = await params
  redirect(`/pwa/${companySlug}/horario`)
}
