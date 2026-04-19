"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon, Sparkles } from "lucide-react"

type Props = {
  title: string
  description?: string
  icon?: LucideIcon
}

export function ComingSoonSection({ title, description, icon: Icon = Sparkles }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="rounded-full bg-muted p-3">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Próximamente</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Esta sección estará disponible pronto.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
