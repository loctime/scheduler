"use client"

import { LucideIcon } from "lucide-react"

type Props = {
  icon: LucideIcon
  title: string
  description?: string
}

export function SectionHeader({ icon: Icon, title, description }: Props) {
  return (
    <div className="flex items-start gap-4 pb-6 mb-6 border-b border-border">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30 shadow-sm">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div className="space-y-1 min-w-0">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-base text-foreground/80">{description}</p>
        )}
      </div>
    </div>
  )
}
