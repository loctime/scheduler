"use client"

import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface LoadingStateCardProps {
  message?: string
}

interface EmptyStateCardProps {
  message: string
}

export function LoadingStateCard({ message = "Cargando datos..." }: LoadingStateCardProps) {
  return (
    <Card className="p-12 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">{message}</p>
    </Card>
  )
}

export function EmptyStateCard({ message }: EmptyStateCardProps) {
  return (
    <Card className="p-12 text-center">
      <p className="text-muted-foreground">{message}</p>
    </Card>
  )
}




