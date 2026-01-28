import { NextRequest, NextResponse } from 'next/server'
import { doc, getDoc } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'

// NOTA: El nombre del PWA solo se actualiza al reinstalar la aplicación.
// Los navegadores cachean el manifest y no lo vuelven a descargar
// hasta que se reinstala el PWA o se fuerza la actualización.

export async function GET(request: NextRequest) {
  try {
    // Obtener ownerId de los query params o usar un valor por defecto
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')
    
    let companyName = "Empleado" // Valor por defecto
    
    // Si hay ownerId, intentar obtener la configuración del usuario
    if (ownerId && db) {
      try {
        const configRef = doc(db, COLLECTIONS.CONFIG, ownerId)
        const configDoc = await getDoc(configRef)
        
        if (configDoc.exists()) {
          const config = configDoc.data()
          companyName = config.nombreEmpresa || "Empleado"
        }
      } catch (error) {
        console.error('Error obteniendo configuración:', error)
        // Usar valor por defecto si hay error
      }
    }
    
    // Construir manifest dinámico
    const manifest = {
      name: `Horarios – ${companyName}`,
      short_name: "Horarios",
      description: `Visualización del horario semanal del personal – ${companyName}`,
      start_url: "/pwa/horario",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#3b82f6",
      orientation: "portrait-primary",
      scope: "/pwa/horario",
      icons: [
        {
          src: "/icon-light-32x32.png",
          sizes: "32x32",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/icon-dark-32x32.png",
          sizes: "32x32",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable"
        },
        {
          src: "/apple-icon.png",
          sizes: "180x180",
          type: "image/png",
          purpose: "any"
        }
      ],
      categories: ["productivity", "business"],
      screenshots: [],
      shortcuts: [
        {
          name: "Ver Horario",
          short_name: "Horario",
          description: `Ver el horario semanal – ${companyName}`,
          url: "/pwa/horario",
          icons: [
            {
              src: "/icon-light-32x32.png",
              sizes: "32x32"
            }
          ]
        }
      ]
    }
    
    // Devolver manifest con headers correctos
    return new NextResponse(JSON.stringify(manifest, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', // 1 hora fresh, 24h stale
      },
    })
    
  } catch (error) {
    console.error('Error generando manifest:', error)
    
    // Manifest fallback en caso de error
    const fallbackManifest = {
      name: "Horarios – Empleado",
      short_name: "Horarios",
      description: "Visualización del horario semanal del personal",
      start_url: "/pwa/horario",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#3b82f6",
      orientation: "portrait-primary",
      scope: "/pwa/horario",
      icons: [
        {
          src: "/icon-light-32x32.png",
          sizes: "32x32",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/icon-dark-32x32.png",
          sizes: "32x32",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable"
        },
        {
          src: "/apple-icon.png",
          sizes: "180x180",
          type: "image/png",
          purpose: "any"
        }
      ],
      categories: ["productivity", "business"],
      screenshots: [],
      shortcuts: [
        {
          name: "Ver Horario",
          short_name: "Horario",
          description: "Ver el horario semanal",
          url: "/pwa/horario",
          icons: [
            {
              src: "/icon-light-32x32.png",
              sizes: "32x32"
            }
          ]
        }
      ]
    }
    
    return new NextResponse(JSON.stringify(fallbackManifest, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=300', // 5 minutos en caso de error
      },
    })
  }
}
