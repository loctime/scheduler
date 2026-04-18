"use client"

import { useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/contexts/data-context"
import { canUser } from "@/lib/permissions"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { useCatalogoProductos } from "@/hooks/use-catalogo-productos"
import { useGruposCatalogo } from "@/hooks/use-grupos-catalogo"
import { useUbicacionesCatalogo } from "@/hooks/use-ubicaciones-catalogo"
import { GrupoCard } from "@/components/catalogo/GrupoCard"
import { NuevoGrupoForm } from "@/components/catalogo/NuevoGrupoForm"
import { ProductosTable } from "@/components/catalogo/ProductosTable"
import { Package, Plus } from "lucide-react"

export default function CatalogoAdminPage() {
  const { user, userData } = useData()

  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const ownerIdsParaUsuarios = useMemo(() => {
    if (!ownerId || !user?.uid) return null
    return [...new Set([ownerId, user.uid])]
  }, [ownerId, user?.uid])

  const puede = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "ver_admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const { items, loadingItems } = useCatalogoProductos(ownerId)
  const { gruposCatalogo } = useGruposCatalogo(ownerId)
  const { ubicaciones } = useUbicacionesCatalogo(ownerIdsParaUsuarios)

  const [activeTab, setActiveTab] = useState<"grupos" | "productos">("grupos")
  const [showNuevoGrupoForm, setShowNuevoGrupoForm] = useState(false)
  const [openGroupIds, setOpenGroupIds] = useState<Record<string, boolean>>({})

  const productById = useMemo(() => {
    const map = new Map(items.map((p) => [p.id, p]))
    return map
  }, [items])

  const groupById = useMemo(() => {
    const map = new Map(gruposCatalogo.map((g) => [g.id, g]))
    return map
  }, [gruposCatalogo])

  if (!puede) {
    return (
      <DashboardLayout user={user}>
        <Card>
          <CardHeader>
            <CardTitle>Catálogo</CardTitle>
            <CardDescription>Solo administradores pueden gestionar el catálogo.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "grupos" | "productos")} className="gap-4">
          <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-center">
                <TabsList>
                  <TabsTrigger value="grupos">Grupos</TabsTrigger>
                  <TabsTrigger value="productos">Productos</TabsTrigger>
                </TabsList>
              </div>
              <Button
                className="ml-4"
                disabled={activeTab !== "grupos"}
                onClick={() => setShowNuevoGrupoForm((prev) => !prev)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Nuevo grupo
              </Button>
            </div>

          <TabsContent value="grupos" className="space-y-4">
            {gruposCatalogo.map((g) => (
              <GrupoCard
                key={g.id}
                grupo={g}
                items={items}
                ubicaciones={ubicaciones}
                productById={productById}
                ownerId={ownerId!}
                open={openGroupIds[g.id] === true}
                onOpenChange={(next) => setOpenGroupIds((prev) => ({ ...prev, [g.id]: next }))}
              />
            ))}
            {showNuevoGrupoForm ? (
              <NuevoGrupoForm
                items={items}
                ubicaciones={ubicaciones}
                ownerId={ownerId!}
                userId={user!.uid}
                onCreado={() => setShowNuevoGrupoForm(false)}
                onCancelar={() => setShowNuevoGrupoForm(false)}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="productos" className="space-y-4">
            <ProductosTable
              items={items}
              ownerId={ownerId!}
              userId={user!.uid}
              loadingItems={loadingItems}
              groupById={groupById}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
