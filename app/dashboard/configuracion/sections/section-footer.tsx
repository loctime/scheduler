"use client"

import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  onSave: () => void
  saving: boolean
  dirty: boolean
  label?: string
}

export function SectionFooter({ onSave, saving, dirty, label = "Guardar cambios" }: Props) {
  return (
    <div
      className={cn(
        "sticky bottom-4 mt-6 flex items-center justify-between gap-3 rounded-xl border bg-card/80 px-4 py-3 backdrop-blur-md shadow-lg transition-all",
        dirty ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <p className={cn("text-sm", dirty ? "text-foreground" : "text-muted-foreground")}>
        {dirty
          ? "Tenés cambios sin guardar"
          : saving
            ? "Guardando..."
            : "Todo al día"}
      </p>
      <Button onClick={onSave} disabled={saving || !dirty} size="default">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            {label}
          </>
        )}
      </Button>
    </div>
  )
}
