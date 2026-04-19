"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PenLine } from "lucide-react"
import { Configuracion } from "@/lib/types"
import { FirmaDigital } from "@/components/remitos/firma-digital"
import { ProfileCard } from "../components/profile-card"
import { SectionFooter } from "./section-footer"

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
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProfileCard />

        <Card className="shadow-md border-l-4 border-l-primary/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 shadow-sm">
                <PenLine className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold text-foreground">Firma Digital</CardTitle>
                <CardDescription className="text-sm text-foreground/75 font-normal">Para usar en remitos y documentos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FirmaDigital
              nombre={nombreFirma}
              firma={firmaDigital}
              onFirmaChange={(firma) => {
                setNombreFirma(firma.nombre)
                setFirmaDigital(firma.firma)
              }}
            />
          </CardContent>
        </Card>
      </div>

      {dirty || saving ? (
        <SectionFooter
          onSave={handleSave}
          saving={saving}
          dirty={dirty}
          label="Guardar firma"
        />
      ) : null}
    </div>
  )
}
