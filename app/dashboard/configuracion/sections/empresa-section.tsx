"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Globe, Building, Palette } from "lucide-react"
import { Configuracion } from "@/lib/types"
import { doc, setDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import {
  changePublicCompanySlug,
  normalizeCompanySlug,
  isValidSlugFormat,
} from "@/lib/public-companies"
import { SectionFooter } from "./section-footer"

type Props = {
  config: Configuracion
  saveSection: (partial: Partial<Configuracion>) => Promise<void>
  ownerId: string | null
  onSlugChanged: (slug: string) => void
}

export function EmpresaSection({ config, saveSection, ownerId, onSlugChanged }: Props) {
  const { toast } = useToast()
  const [nombreEmpresa, setNombreEmpresa] = useState(config.nombreEmpresa || "")
  const [colorEmpresa, setColorEmpresa] = useState<string | undefined>(config.colorEmpresa)
  const [slug, setSlug] = useState<string>(config.publicSlug || "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setNombreEmpresa(config.nombreEmpresa || "")
    setColorEmpresa(config.colorEmpresa)
    setSlug(config.publicSlug || "")
  }, [config.nombreEmpresa, config.colorEmpresa, config.publicSlug])

  const slugDirty = slug !== (config.publicSlug || "")
  const dirty =
    (nombreEmpresa || "") !== (config.nombreEmpresa || "") ||
    (colorEmpresa || "") !== (config.colorEmpresa || "") ||
    slugDirty

  const handleSave = async () => {
    if (slugDirty) {
      const normalized = normalizeCompanySlug(slug.trim())
      if (!isValidSlugFormat(normalized)) {
        toast({
          title: "URL inválida",
          description: "Solo letras minúsculas, números y guiones. Entre 3 y 40 caracteres.",
          variant: "destructive",
        })
        return
      }
    }

    try {
      setSaving(true)

      await saveSection({
        nombreEmpresa: nombreEmpresa || "Empleado",
        colorEmpresa: colorEmpresa || undefined,
      })

      if (slugDirty && ownerId && db) {
        const normalized = normalizeCompanySlug(slug.trim())
        if (normalized !== (config.publicSlug || "")) {
          try {
            await changePublicCompanySlug(normalized, ownerId, nombreEmpresa || "")
            const configRef = doc(db, COLLECTIONS.CONFIG, ownerId)
            await setDoc(configRef, { publicSlug: normalized }, { merge: true })
            onSlugChanged(normalized)
            toast({
              title: "URL actualizada",
              description: `La app ahora está en /pwa/${normalized}/`,
            })
          } catch (err: any) {
            toast({
              title: "Error al cambiar la URL",
              description: err.message || "No se pudo cambiar la URL",
              variant: "destructive",
            })
          }
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-md border-l-4 border-l-primary/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 shadow-sm">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold text-foreground">Identidad</CardTitle>
                <CardDescription className="text-sm text-foreground/75 font-normal">Nombre visible en la grilla de horarios</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombreEmpresa">Nombre de la empresa</Label>
              <Input
                id="nombreEmpresa"
                type="text"
                placeholder="Empleado"
                value={nombreEmpresa}
                onChange={(e) => setNombreEmpresa(e.target.value)}
              />
              <p className="text-sm text-foreground/75">
                Se mostrará en la columna de empleados
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-l-4 border-l-primary/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 shadow-sm">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-lg font-semibold text-foreground">Color de la empresa</CardTitle>
                <CardDescription className="text-sm text-foreground/75 font-normal">Fondo de la celda del nombre</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="colorEmpresa">Color de fondo</Label>
              <div className="flex gap-2">
                <Input
                  id="colorEmpresa"
                  type="color"
                  value={colorEmpresa || "#ffffff"}
                  onChange={(e) => setColorEmpresa(e.target.value)}
                  className="h-10 w-14 p-1 cursor-pointer shrink-0"
                />
                <Input
                  type="text"
                  placeholder="#ffffff"
                  value={colorEmpresa || ""}
                  onChange={(e) => setColorEmpresa(e.target.value || undefined)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
              <p className="text-sm text-foreground/75">
                Dejalo vacío para usar el color por defecto
              </p>
            </div>
          </CardContent>
        </Card>

        {config.publicSlug && (
          <Card className="border-border/60 lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 shadow-sm">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <CardTitle className="text-lg font-semibold text-foreground">URL de la aplicación</CardTitle>
                  <CardDescription className="text-sm text-foreground/75 font-normal">
                    Identificador público.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="publicSlug">Identificador</Label>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-shadow">
                <span className="text-sm text-muted-foreground shrink-0">/pwa/</span>
                <Input
                  id="publicSlug"
                  value={slug}
                  onChange={(e) => setSlug(normalizeCompanySlug(e.target.value))}
                  className="font-mono text-sm h-9 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                  placeholder="mi-empresa"
                />
                <span className="text-sm text-muted-foreground shrink-0">/</span>
              </div>
              <p className="text-sm text-foreground/75">
                Solo letras minúsculas, números y guiones. Ej:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">mi-empresa</code>
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {dirty || saving ? (
        <SectionFooter onSave={handleSave} saving={saving} dirty={dirty} label="Guardar empresa" />
      ) : null}
    </div>
  )
}
