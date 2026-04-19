"use client"

import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon, Sparkles } from "lucide-react"

type Props = {
  title: string
  description?: string
  icon?: LucideIcon
}

export function ComingSoonSection({ icon: Icon = Sparkles }: Props) {
  return (
    <Card className="border-dashed border-border/60 bg-gradient-to-br from-muted/20 to-muted/5">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Icon className="h-7 w-7 text-primary" />
          </div>
          <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow-sm">
            <Sparkles className="h-3 w-3" />
          </div>
        </div>
        <div className="space-y-1.5 max-w-md">
          <p className="text-base font-semibold text-foreground">Próximamente</p>
          <p className="text-sm text-muted-foreground">
            Esta sección estará disponible pronto. Seguimos trabajando para mejorar tu experiencia.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
