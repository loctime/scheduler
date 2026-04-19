"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Configuracion } from "@/lib/types"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useData } from "@/contexts/data-context"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2,
  User,
  Building2,
  Calendar,
  Clock,
  Coffee,
  Users,
  Bell,
  Palette,
  Puzzle,
  CreditCard,
  Shield,
  Database,
  CalendarClock,
  Sparkles,
} from "lucide-react"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import {
  createPublicCompanySlug,
  getCompanySlugFromOwnerId,
  normalizeCompanySlug,
  isValidSlugFormat,
} from "@/lib/public-companies"
import { SettingsSidebar, SidebarItem, flattenSidebarItems } from "./components/settings-sidebar"
import { PerfilSection } from "./sections/perfil-section"
import { EmpresaSection } from "./sections/empresa-section"
import { CalendarioSection } from "./sections/calendario-section"
import { HorariosSection } from "./sections/horarios-section"
import { MediosTurnosSection } from "./sections/medios-turnos-section"
import { EquipoSection } from "./sections/equipo-section"
import { ComingSoonSection } from "./sections/coming-soon-section"
import { SectionHeader } from "./sections/section-header"

const DEFAULT_CONFIG: Configuracion = {
  nombreEmpresa: "Empleado",
  colorEmpresa: undefined,
  mesInicioDia: 1,
  horasMaximasPorDia: 8,
  semanaInicioDia: 1,
  mostrarFinesDeSemana: true,
  formatoHora24: true,
  minutosDescanso: 30,
  horasMinimasParaDescanso: 6,
  mediosTurnos: [],
  nombreFirma: undefined,
  firmaDigital: undefined,
  reglasHorarias: {
    horasNormalesPorDia: 8,
    horasNormalesPorSemana: 48,
    inicioHorarioNocturno: "21:00",
    limiteDiarioRecomendado: 10,
  },
}

const ADMIN_SECTIONS = new Set(["empresa", "calendario", "horarios", "medios-turnos", "equipo"])

export default function ConfiguracionPage() {
  const { user, userData } = useData()
  const router = useRouter()
  const searchParams = useSearchParams()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const canSeeAdminAndOperatorSettings =
    userData?.role === "admin" || userData?.role === "operador"
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<Configuracion>(DEFAULT_CONFIG)

  const sections: SidebarItem[] = useMemo(
    () => [
      {
        key: "perfil",
        label: "Mi perfil",
        icon: User,
        description: "Tu información personal, credenciales y firma digital",
      },
      {
        key: "empresa",
        label: "Empresa",
        icon: Building2,
        description: "Identidad de la empresa y URL pública de la app",
        hidden: !canSeeAdminAndOperatorSettings,
      },
      {
        key: "__group-calendario",
        label: "Calendario y turnos",
        icon: CalendarClock,
        children: [
          {
            key: "calendario",
            label: "Calendario",
            icon: Calendar,
            description: "Cómo se muestran y organizan los horarios en la grilla",
            hidden: !canSeeAdminAndOperatorSettings,
          },
          {
            key: "horarios",
            label: "Horarios y cálculos",
            icon: Clock,
            description: "Límites, descansos y reglas para el cálculo de horas extra",
            hidden: !canSeeAdminAndOperatorSettings,
          },
          {
            key: "medios-turnos",
            label: "Medios turnos",
            icon: Coffee,
            description: "Horarios predefinidos para los 1/2 francos",
            hidden: !canSeeAdminAndOperatorSettings,
          },
        ],
      },
      {
        key: "equipo",
        label: "Equipo",
        icon: Users,
        description: "Invitaciones y gestión de miembros",
        hidden: !canSeeAdminAndOperatorSettings,
      },
      {
        key: "__group-proximamente",
        label: "Próximamente",
        icon: Sparkles,
        children: [
          { key: "notificaciones", label: "Notificaciones", icon: Bell, description: "Configurá cuándo y cómo recibir avisos", disabled: true },
          { key: "apariencia", label: "Apariencia", icon: Palette, description: "Tema, densidad y preferencias visuales", disabled: true },
          { key: "integraciones", label: "Integraciones", icon: Puzzle, description: "Conectá tu cuenta con otras herramientas", disabled: true },
          { key: "facturacion", label: "Facturación / Plan", icon: CreditCard, description: "Tu plan, facturas y método de pago", disabled: true },
          { key: "seguridad", label: "Seguridad", icon: Shield, description: "Contraseña, 2FA y sesiones activas", disabled: true },
          { key: "datos-privacidad", label: "Datos y privacidad", icon: Database, description: "Exportá tus datos o eliminá tu cuenta", disabled: true },
        ],
      },
    ],
    [canSeeAdminAndOperatorSettings],
  )

  const flatSections = useMemo(() => flattenSidebarItems(sections), [sections])

  const resolveSection = useCallback(
    (key: string | null): string => {
      if (!key) return "perfil"
      const found = flatSections.find((s) => s.key === key)
      if (!found || found.hidden || found.disabled) return "perfil"
      if (ADMIN_SECTIONS.has(key) && !canSeeAdminAndOperatorSettings) return "perfil"
      return key
    },
    [flatSections, canSeeAdminAndOperatorSettings],
  )

  const [activeSection, setActiveSection] = useState<string>(() =>
    resolveSection(searchParams.get("section")),
  )

  useEffect(() => {
    const resolved = resolveSection(searchParams.get("section"))
    if (resolved !== activeSection) setActiveSection(resolved)
  }, [searchParams, resolveSection, activeSection])

  const handleSectionChange = (key: string) => {
    setActiveSection(key)
    const params = new URLSearchParams(searchParams.toString())
    params.set("section", key)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const activeItem = flatSections.find((s) => s.key === activeSection) ?? flatSections[0]

  useEffect(() => {
    if (!user || !ownerId) return

    const loadConfig = async () => {
      if (!db) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const configRef = doc(db, COLLECTIONS.CONFIG, ownerId)
        const configSnap = await getDoc(configRef)

        if (configSnap.exists()) {
          setConfig(configSnap.data() as Configuracion)
        } else {
          const initial: any = {
            nombreEmpresa: DEFAULT_CONFIG.nombreEmpresa,
            mesInicioDia: DEFAULT_CONFIG.mesInicioDia,
            horasMaximasPorDia: DEFAULT_CONFIG.horasMaximasPorDia,
            semanaInicioDia: DEFAULT_CONFIG.semanaInicioDia,
            mostrarFinesDeSemana: DEFAULT_CONFIG.mostrarFinesDeSemana,
            formatoHora24: DEFAULT_CONFIG.formatoHora24,
            minutosDescanso: DEFAULT_CONFIG.minutosDescanso,
            horasMinimasParaDescanso: DEFAULT_CONFIG.horasMinimasParaDescanso,
            mediosTurnos: DEFAULT_CONFIG.mediosTurnos,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
            updatedByName: user.displayName || user.email,
          }
          await setDoc(configRef, { ...initial, ownerId })
          setConfig(DEFAULT_CONFIG)
        }
      } catch (error: any) {
        console.error("Error loading config:", error)
        toast({
          title: "Error",
          description: "No se pudo cargar la configuración",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [user, ownerId, toast])

  const saveSection = useCallback(
    async (partial: Partial<Configuracion>) => {
      if (!user || !ownerId) {
        toast({ title: "Error", description: "No estás autenticado", variant: "destructive" })
        throw new Error("not authenticated")
      }
      if (!db) {
        toast({ title: "Error", description: "Firebase no está configurado", variant: "destructive" })
        throw new Error("firebase not configured")
      }

      try {
        const configRef = doc(db, COLLECTIONS.CONFIG, ownerId)
        const dataToSave: any = {
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email || "",
        }

        for (const [key, value] of Object.entries(partial)) {
          if (value === undefined) continue
          if (key === "firmaDigital") {
            dataToSave.firmaDigital = value ?? null
            continue
          }
          if (key === "colorEmpresa" && (value === "" || value == null)) continue
          dataToSave[key] = value
        }

        await setDoc(configRef, dataToSave, { merge: true })

        let nextConfig: Configuracion = { ...config, ...partial }

        if (
          partial.nombreEmpresa !== undefined &&
          !config.publicSlug &&
          userData?.role === "admin"
        ) {
          const companyName = (partial.nombreEmpresa || "").trim()
          const baseSlug = normalizeCompanySlug(companyName)
          if (companyName && isValidSlugFormat(baseSlug)) {
            try {
              const existingSlug = await getCompanySlugFromOwnerId(ownerId)
              const slugToUse =
                existingSlug || (await createPublicCompanySlug(companyName, ownerId))
              await setDoc(configRef, { publicSlug: slugToUse }, { merge: true })
              nextConfig = { ...nextConfig, publicSlug: slugToUse }
            } catch (slugError) {
              console.warn("No se pudo crear el slug público:", slugError)
            }
          }
        }

        setConfig(nextConfig)
        toast({ title: "Cambios guardados", description: "Los datos se actualizaron correctamente" })
      } catch (error: any) {
        console.error("Error saving config:", error)
        toast({
          title: "Error",
          description: error.message || "No se pudo guardar la configuración",
          variant: "destructive",
        })
        throw error
      }
    },
    [user, ownerId, config, userData, toast],
  )

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  const renderSection = () => {
    switch (activeSection) {
      case "perfil":
        return <PerfilSection config={config} saveSection={saveSection} />
      case "empresa":
        return (
          <EmpresaSection
            config={config}
            saveSection={saveSection}
            ownerId={ownerId}
            onSlugChanged={(slug) => setConfig((prev) => ({ ...prev, publicSlug: slug }))}
          />
        )
      case "calendario":
        return <CalendarioSection config={config} saveSection={saveSection} />
      case "horarios":
        return <HorariosSection config={config} saveSection={saveSection} />
      case "medios-turnos":
        return <MediosTurnosSection config={config} saveSection={saveSection} />
      case "equipo":
        return <EquipoSection />
      case "notificaciones":
        return (
          <ComingSoonSection
            title="Notificaciones"
            description="Configurá cuándo y cómo recibir avisos"
            icon={Bell}
          />
        )
      case "apariencia":
        return (
          <ComingSoonSection
            title="Apariencia"
            description="Tema, densidad y preferencias visuales"
            icon={Palette}
          />
        )
      case "integraciones":
        return (
          <ComingSoonSection
            title="Integraciones"
            description="Conectá tu cuenta con otras herramientas"
            icon={Puzzle}
          />
        )
      case "facturacion":
        return (
          <ComingSoonSection
            title="Facturación / Plan"
            description="Tu plan, facturas y método de pago"
            icon={CreditCard}
          />
        )
      case "seguridad":
        return (
          <ComingSoonSection
            title="Seguridad"
            description="Contraseña, 2FA y sesiones activas"
            icon={Shield}
          />
        )
      case "datos-privacidad":
        return (
          <ComingSoonSection
            title="Datos y privacidad"
            description="Exportá tus datos o eliminá tu cuenta"
            icon={Database}
          />
        )
      default:
        return <PerfilSection config={config} saveSection={saveSection} />
    }
  }

  return (
    <DashboardLayout user={user}>
      <div className="flex flex-col md:flex-row gap-6">
        <SettingsSidebar items={sections} active={activeSection} onChange={handleSectionChange} />
        <div className="flex-1 min-w-0">
          <SectionHeader
            icon={activeItem.icon}
            title={activeItem.label}
            description={activeItem.description}
          />
          {renderSection()}
        </div>
      </div>
    </DashboardLayout>
  )
}
