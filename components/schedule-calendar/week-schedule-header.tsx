"use client"

import { ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react"
import { CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"

interface WeekScheduleHeaderProps {
  title: string
  isOpen: boolean
  isCompleted: boolean
}

export function WeekScheduleHeader({ title, isOpen, isCompleted }: WeekScheduleHeaderProps) {
  return (
    <CollapsibleTrigger asChild>
      <button
        type="button"
        className="h-auto p-0 hover:bg-accent/50 flex-1 justify-start text-left bg-transparent border-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
        aria-label={isOpen ? "Contraer semana" : "Expandir semana"}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
          )}
          <h3 className="text-2xl font-semibold text-foreground">{title}</h3>
          {isCompleted && (
            <Badge variant="default" className="ml-2 bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Completada
            </Badge>
          )}
        </div>
      </button>
    </CollapsibleTrigger>
  )
}


