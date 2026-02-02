import { useState } from "react"
import { Share2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface ShareScheduleButtonProps {
  shareUrl: string | null
  disabled?: boolean
}

export function ShareScheduleButton({ shareUrl, disabled = false }: ShareScheduleButtonProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopyUrl = async () => {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      toast({
        title: "Enlace copiado",
        description: "El enlace del horario ha sido copiado al portapapeles",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace",
        variant: "destructive"
      })
    }
  }

  const handleShare = async () => {
    if (!shareUrl) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Horario Semanal",
          text: "Mira el horario de esta semana",
          url: shareUrl
        })
      } catch (error) {
        console.log("Share cancelled or failed:", error)
      }
    } else {
      // Fallback a copiar si Web Share API no está disponible
      handleCopyUrl()
    }
  }

  if (!shareUrl) {
    return (
      <Button variant="outline" disabled className="flex items-center gap-2">
        <Share2 className="h-4 w-4" />
        Compartir horario
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      onClick={handleShare}
      disabled={disabled}
      className="flex items-center gap-2"
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Copiado" : "Compartir horario"}
    </Button>
  )
}
