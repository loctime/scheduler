"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ActionCardProps {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  /** Clase para el borde (ej. border-orange-600). Si no se pasa, se usa el borde por defecto. */
  borderClassName?: string
}

export function ActionCard({ icon, title, description, href, borderClassName }: ActionCardProps) {
  return (
    <Button
      asChild
      variant="outline"
      className={cn(
        "h-auto w-full min-w-0 flex flex-col items-center justify-center gap-2 p-0 rounded-xl shadow-sm hover:shadow-md border transition-all duration-200 cursor-pointer text-center bg-card whitespace-normal",
        borderClassName ?? "border-border/60 hover:border-border"
      )}
    >
      <Link href={href} className="flex flex-col items-center gap-2 w-full min-w-0 max-w-full text-center whitespace-normal">
        {icon}
        <span className="font-semibold text-foreground w-full min-w-0 break-words [overflow-wrap:anywhere]">{title}</span>
        <span className="text-sm text-muted-foreground w-full min-w-0 break-words [overflow-wrap:anywhere]">{description}</span>
      </Link>
    </Button>
  )
}
