"use client"

import { useParams, useRouter } from "next/navigation"
import { useData } from "@/contexts/data-context"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"

const ACTIONS = [
  {
    href: "stock-console/stock",
    icon: "📦",
    title: "Contar stock",
    desc: "Registrá lo que hay en tu sucursal",
    iconBg: "bg-[#E1F5EE]",
    section: "tareas",
  },
  {
    href: "stock-console/pedido",
    icon: "📋",
    title: "Ver y enviar pedido",
    desc: "Revisá las cantidades y mandalo",
    iconBg: "bg-blue-50",
    section: "tareas",
  },
  {
    href: "stock-console/despacho",
    icon: "🏭",
    title: "Tomar y despachar",
    desc: "Preparar y marcar remitos como despachados",
    iconBg: "bg-amber-50",
    section: "fabrica",
  },
  {
    href: "stock-console/recepcion",
    icon: "✅",
    title: "Recibir pedido",
    desc: "Confirmá lo que llegó a tu sucursal",
    iconBg: "bg-red-50",
    section: "fabrica",
  },
]

export default function StockPedidosHome() {
  const params = useParams()
  const router = useRouter()
  const { user } = useData()
  const companySlug = params.companySlug as string

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  const tareas = ACTIONS.filter((a) => a.section === "tareas")
  const fabrica = ACTIONS.filter((a) => a.section === "fabrica")

  return (
    <div className="min-h-screen bg-[#f5f5f3] pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-gray-900">Stock & Pedidos</h1>
      </div>

      <div className="px-4 space-y-6">
        <section>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Mis tareas
          </p>
          <div className="space-y-2">
            {tareas.map((action) => (
              <ActionCard
                key={action.href}
                action={action}
                onClick={() => router.push(`/pwa/${companySlug}/${action.href}`)}
              />
            ))}
          </div>
        </section>

        <section>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Fábrica
          </p>
          <div className="space-y-2">
            {fabrica.map((action) => (
              <ActionCard
                key={action.href}
                action={action}
                onClick={() => router.push(`/pwa/${companySlug}/${action.href}`)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function ActionCard({
  action,
  onClick,
}: {
  action: (typeof ACTIONS)[number]
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-[#ebebeb] rounded-xl px-4 py-3 flex items-center gap-3 active:bg-gray-50 transition-colors text-left"
    >
      <div
        className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-xl shrink-0 ${action.iconBg}`}
      >
        {action.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-gray-900">{action.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
      </div>
      <span className="text-gray-300 text-lg">›</span>
    </button>
  )
}
