import { useState } from "react"
import { Globe, Share2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { usePublicPublisher } from "@/hooks/use-public-publisher"
import { useData } from "@/contexts/data-context"

interface PublicSchedulePublisherProps {
  weekId: string
  weekData?: any
}

export function PublicSchedulePublisher({ weekId, weekData }: PublicSchedulePublisherProps) {
  const [companyName, setCompanyName] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  
  const { userData } = useData()
  const { publishToPublic, isPublishing, error } = usePublicPublisher()
  const { toast } = useToast()

  // Solo los admins pueden publicar
  const canPublish = userData?.role === 'admin'

  const handlePublish = async () => {
    console.log("🔧 [PublicSchedulePublisher] Iniciando publicación")
    console.log("🔧 [PublicSchedulePublisher] Datos:", {
      companyName: companyName.trim(),
      weekId,
      hasWeekData: !!weekData,
      weekDataKeys: weekData ? Object.keys(weekData) : [],
      userData: { role: userData?.role, uid: userData?.uid }
    })

    if (!companyName.trim()) {
      console.warn("🔧 [PublicSchedulePublisher] Error: companyName vacío")
      toast({
        title: "Error",
        description: "El nombre de la empresa es requerido",
        variant: "destructive"
      })
      return
    }

    try {
      console.log("🔧 [PublicSchedulePublisher] Llamando a publishToPublic...")
      const companySlug = await publishToPublic({
        companyName: companyName.trim(),
        weekId,
        weekData
      })

      console.log("🔧 [PublicSchedulePublisher] publishToPublic retornó companySlug:", companySlug)
      
      // Generar URL con nueva arquitectura PWA
      const url = `${window.location.origin}/pwa/horario/${companySlug}`
      console.log("🔧 [PublicSchedulePublisher] URL pública generada:", url)
      setPublishedUrl(url)

      // Copiar automáticamente al portapapeles
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
        
        toast({
          title: "✅ Horario publicado y enlace copiado",
          description: "El enlace ya está en el portapapeles para compartir",
        })
      } catch (clipboardError) {
        console.warn("🔧 [PublicSchedulePublisher] No se pudo copiar automáticamente:", clipboardError)
        toast({
          title: "Horario publicado",
          description: "El horario ahora está disponible públicamente",
        })
      }

      setIsDialogOpen(false)
    } catch (error) {
      console.error("🔧 [PublicSchedulePublisher] Error en publicación:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo publicar el horario",
        variant: "destructive"
      })
    }
  }

  const handleCopyUrl = async () => {
    if (!publishedUrl) return

    try {
      await navigator.clipboard.writeText(publishedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      toast({
        title: "URL copiada",
        description: "El enlace ha sido copiado al portapapeles",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace",
        variant: "destructive"
      })
    }
  }

  if (!canPublish) {
    return null
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsDialogOpen(true)}
        className="flex items-center gap-2"
      >
        <Globe className="h-4 w-4" />
        Publicar Horario
      </Button>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Publicar Horario Público
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="companyName">Nombre de la empresa</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej: Mi Empresa S.A."
                  className="mt-1"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Importante:</strong> Al publicar, se generará un enlace único basado en el nombre de la empresa. 
                  El enlace se copiará automáticamente al portapapeles para compartir.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing || !companyName.trim()}
                  className="flex-1"
                >
                  {isPublishing ? "Publicando..." : "Publicar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {publishedUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Horario Publicado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Enlace público</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={publishedUrl}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>

              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>✅ Enlace copiado automáticamente</strong><br/>
                  Comparte este enlace con los empleados para que puedan ver el horario sin necesidad de registrarse.
                  La URL usa el nuevo formato PWA: <code className="bg-green-100 px-1 rounded">/pwa/horario/{companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}</code>
                </p>
              </div>

              <Button
                onClick={() => {
                  setPublishedUrl(null)
                  setCompanyName("")
                }}
                className="w-full"
              >
                Cerrar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
