"use client"

import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type SidebarItem = {
  key: string
  label: string
  icon: LucideIcon
  description?: string
  disabled?: boolean
  hidden?: boolean
  children?: SidebarItem[]
}

type Props = {
  items: SidebarItem[]
  active: string
  onChange: (key: string) => void
}

export function flattenSidebarItems(items: SidebarItem[]): SidebarItem[] {
  return items.flatMap((item) =>
    item.children ? flattenSidebarItems(item.children) : [item],
  )
}

function isGroupVisible(group: SidebarItem): boolean {
  if (!group.children || group.children.length === 0) return !group.hidden
  return group.children.some((c) => !c.hidden)
}

function SidebarLeafButton({
  item,
  isActive,
  onChange,
  indented = false,
}: {
  item: SidebarItem
  isActive: boolean
  onChange: (key: string) => void
  indented?: boolean
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={() => !item.disabled && onChange(item.key)}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-all",
        indented && "ml-2",
        isActive && [
          "bg-primary/10 text-primary font-semibold",
          "shadow-sm ring-1 ring-primary/20",
        ],
        !isActive && !item.disabled && "text-foreground hover:bg-accent hover:text-accent-foreground",
        item.disabled && "opacity-60 cursor-not-allowed text-muted-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-primary" : "text-foreground/70 group-hover:text-foreground",
          item.disabled && "text-muted-foreground",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.disabled && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 px-1.5 py-0.5 rounded bg-muted">
          Pronto
        </span>
      )}
    </button>
  )
}

export function SettingsSidebar({ items, active, onChange }: Props) {
  const visibleItems = items.filter(isGroupVisible)

  return (
    <>
      {/* Mobile: Select with groups */}
      <div className="md:hidden">
        <Select
          value={active}
          onValueChange={(v) => {
            const flat = flattenSidebarItems(items)
            const item = flat.find((i) => i.key === v)
            if (!item || item.disabled) return
            onChange(v)
          }}
        >
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibleItems.map((item) => {
              if (item.children) {
                const visibleChildren = item.children.filter((c) => !c.hidden)
                return (
                  <SelectGroup key={item.key}>
                    <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </SelectLabel>
                    {visibleChildren.map((child) => {
                      const Icon = child.icon
                      return (
                        <SelectItem key={child.key} value={child.key} disabled={child.disabled}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{child.label}</span>
                            {child.disabled && (
                              <span className="text-xs text-muted-foreground ml-1">(pronto)</span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectGroup>
                )
              }
              const Icon = item.icon
              return (
                <SelectItem key={item.key} value={item.key} disabled={item.disabled}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: vertical list with groups */}
      <aside className="hidden md:block md:w-64 md:shrink-0">
        <nav className="sticky top-4 flex flex-col gap-0.5 rounded-xl border border-border bg-card/50 p-2">
          {visibleItems.map((item, idx) => {
            if (item.children) {
              const visibleChildren = item.children.filter((c) => !c.hidden)
              const GroupIcon = item.icon
              return (
                <div key={item.key} className={cn("flex flex-col gap-0.5", idx > 0 && "mt-2")}>
                  <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                    <GroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                  {visibleChildren.map((child) => (
                    <SidebarLeafButton
                      key={child.key}
                      item={child}
                      isActive={child.key === active}
                      onChange={onChange}
                      indented
                    />
                  ))}
                </div>
              )
            }
            return (
              <SidebarLeafButton
                key={item.key}
                item={item}
                isActive={item.key === active}
                onChange={onChange}
              />
            )
          })}
        </nav>
      </aside>
    </>
  )
}
