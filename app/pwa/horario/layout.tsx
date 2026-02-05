import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Horario publicado",
  description: "Visualización del horario semanal del personal",
}

export default function HorarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
