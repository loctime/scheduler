"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"
import { Configuracion } from "@/lib/types"
import { FirmaDigital } from "@/components/remitos/firma-digital"
import { ProfileCard } from "../components/profile-card"

type Props = {
  config: Configuracion
  saveSection: (partial: Partial<Configuracion>) => Promise<void>
}

export function PerfilSection({ config, saveSection }: Props) {
  const [nombreFirma, setNombreFirma] = useState<string>(config.nombreFirma || "")
  const [firmaDigital, setFirmaDigital] = useState<string | undefined>(config.firmaDigital)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setNombreFirma(config.nombreFirma || "")
    setFirmaDigital(config.firmaDigital)
  }, [config.nombreFirma, config.firmaDigital])

  const dirty =
    (nombreFirma || "") !== (config.nombreFirma || "") ||
    (firmaDigital || "") !== (config.firmaDigital || "")

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveSection({
        nombreFirma: nombreFirma || "",
        firmaDigital: firmaDigital ?? undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <ProfileCard />

      <Card>
        <CardHeader>
          <CardTitle>Firma Digital</CardTitle>
          <CardDescription>Configura tu firma digital para usar en remitos y documentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FirmaDigital
            nombre={nombreFirma}
            firma={firmaDigital}
            onFirmaChange={(firma) => {
              setNombreFirma(firma.nombre)
              setFirmaDigital(firma.firma)
            }}
          />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar firma
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
