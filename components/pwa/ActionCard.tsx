"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

interface ActionCardProps {
  icon: React.ReactNode
  title: string
  description: string
  href: string
}

export function ActionCard({ icon, title, description, href }: ActionCardProps) {
  return (
    <Button
      asChild
      variant="outline"
      className="h-auto w-full min-w-0 flex flex-col items-center justify-center gap-2 p-0 rounded-xl shadow-sm hover:shadow-md border border-border/60 hover:border-border transition-all duration-200 cursor-pointer text-center bg-card"
    >
      <Link href={href} className="flex flex-col items-center gap-2 w-full min-w-0 text-center overflow-hidden">
        {icon}
        <span className="font-semibold text-foreground break-words w-full">{title}</span>
        <span className="text-sm text-muted-foreground break-words w-full">{description}</span>
      </Link>
    </Button>
  )
}
