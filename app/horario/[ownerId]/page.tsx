import { redirect } from "next/navigation"

export default async function LegacyHorarioOwnerPage({ params }: { params: Promise<{ ownerId: string }> }) {
  const { ownerId } = await params
  redirect(`/pwa/horario/${ownerId}`)
}
