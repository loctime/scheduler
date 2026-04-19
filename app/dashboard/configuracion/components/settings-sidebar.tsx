"use client"

import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type SidebarItem = {
  key: string
  label: string
  icon: LucideIcon
  disabled?: boolean
  hidden?: boolean
}

type Props = {
  items: SidebarItem[]
  active: string
  onChange: (key: string) => void
}

export function SettingsSidebar({ items, active, onChange }: Props) {
  const visibleItems = items.filter((i) => !i.hidden)

  return (
    <>
      {/* Mobile: Select */}
      <div className="md:hidden">
        <Select
          value={active}
          onValueChange={(v) => {
            const item = visibleItems.find((i) => i.key === v)
            if (!item || item.disabled) return
            onChange(v)
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibleItems.map((item) => {
              const Icon = item.icon
              return (
                <SelectItem key={item.key} value={item.key} disabled={item.disabled}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.disabled && (
                      <span className="text-xs text-muted-foreground ml-1">(próximamente)</span>
                    )}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: vertical list */}
      <nav className="hidden md:flex md:flex-col md:gap-1 md:w-60 md:shrink-0">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = item.key === active
          return (
            <button
              key={item.key}
              type="button"
              disabled={item.disabled}
              onClick={() => !item.disabled && onChange(item.key)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-left transition-colors",
                isActive && "bg-accent text-accent-foreground font-medium",
                !isActive && !item.disabled && "hover:bg-accent/50 text-foreground",
                item.disabled && "opacity-50 cursor-not-allowed text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.disabled && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                  pronto
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </>
  )
}
