import type { Metadata, Viewport } from "next"
import { PwaShell } from "@/components/pwa/pwa-shell"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"

export const metadata: Metadata = {
  title: "PWA Horarios",
  description: "Horario publicado, vista mensual y stock console",
  manifest: "/manifest-pwa.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PWA Horarios",
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#3b82f6",
}

export default function PwaLayout({ children }: { children: React.ReactNode }) {
  return (
    <PwaShell>
      {children}
      <PWAInstallPrompt />
    </PwaShell>
  )
}
