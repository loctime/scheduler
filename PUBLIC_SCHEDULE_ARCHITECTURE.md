# Arquitectura de Horario Público (PWA)

## Overview

Sistema para publicar horarios de forma pública sin requerir autenticación, destinado a empleados no registrados.

## Estructura de Carpetas

```
app/
├── horario/                          # Página interna (con auth)
│   ├── page.tsx                     # Navegación interna con ownerId
│   └── layout.tsx                    # DataProvider + auth
└── pwa/
    └── horario/
        ├── layout.tsx                # Layout PWA (sin auth)
        └── [publicScheduleId]/
            └── page.tsx              # Página pública

hooks/
├── use-public-schedule.ts            # Lectura de horarios públicos
├── use-public-week-navigation.ts     # Navegación de semanas públicas
├── use-public-publisher.ts           # Publicación de horarios
└── use-owner-id.ts                   # Helper compartido para ownerId

components/
└── public-schedule-publisher.tsx     # Componente de publicación
```

## Esquema de Datos

### Colección Pública: `/public/horarios/{publicScheduleId}`

```typescript
interface PublicSchedule {
  id: string                    // {ownerId}_{timestamp}
  companyName: string           // Nombre de la empresa
  ownerId: string               // Owner original
  publishedWeekId: string       // ID de semana publicada
  weekData: {
    weekId: string
    startDate: string           // DD/MM/YYYY
    endDate: string             // DD/MM/YYYY
    weekNumber: number
    year: number
    month: number
    assignments: Record<string, Record<string, any[]>>
  }
  updatedAt: Timestamp
  publishedAt: Timestamp
}
```

### Flujo de Datos

```
1. Admin publica semana interna (/horario)
   ↓
2. Sistema copia datos de /apps/horarios/schedules/{weekId}
   ↓
3. Crea snapshot en /public/horarios/{publicScheduleId}
   ↓
4. Genera URL pública: /pwa/horario/{publicScheduleId}
   ↓
5. Empleados acceden sin login
```

## Hooks Principales

### `usePublicSchedule(publicScheduleId)`
- Lee datos de `/public/horarios/{publicScheduleId}`
- Solo lectura
- Sin autenticación requerida

### `usePublicWeekNavigation(publishedWeekId)`
- Navegación entre semanas públicas
- Formato argentino DD/MM/AAAA
- Sin dependencia de auth

### `usePublicPublisher()`
- Publica horarios desde admin
- Copia datos de schedules → public
- Genera ID único: `{ownerId}_{timestamp}`

## Rutas y URLs

### Interna (con auth)
- `/horario` - Administración de horarios
- Usa `ownerId` implícito (uid o userData.ownerId)

### Pública (sin auth)
- `/pwa/horario/{publicScheduleId}` - Visualización pública
- Solo lectura
- Accesible para cualquiera con el enlace

## Componentes

### `PublicSchedulePublisher`
- Botón "Publicar Horario"
- Modal para nombre de empresa
- Genera y copia URL pública
- Solo visible para admins

## Seguridad y Permisos

### Publicación
- Solo usuarios `role: "admin"` pueden publicar
- Requiere `ownerId` válido
- Valida existencia de datos en schedules

### Acceso Público
- Sin autenticación
- Solo lectura
- Datos aislados en colección `public`

## Formato de Fechas

**Regla estricta**: Todas las fechas visibles usan formato argentino DD/MM/AAAA

- Navegación: "26 de enero – 01 de febrero, 2026"
- Headers: "Lunes 26/01/2026"
- IDs: "01/2026-W4"

## Integración con Sistema Interno

### Sin cambios en:
- `/horario` existente
- Reglas Firestore
- Modelo de datos interno
- Lógica de negocio

### Nuevas funcionalidades:
- Botón "Publicar Horario" en admin
- Página pública `/pwa/horario/{id}`
- Copia automática de datos

## Ejemplo de Flujo Completo

1. **Admin** accede a `/horario`
2. Navega a semana que quiere publicar
3. Hace clic en "Publicar Horario"
4. Ingresa nombre: "Mi Empresa S.A."
5. Sistema genera ID: `abc123_1703123456789`
6. Copia datos de `schedules/01/2026-W4` → `public/horarios/abc123_1703123456789`
7. URL generada: `https://app.com/pwa/horario/abc123_1703123456789`
8. **Empleado** accede a URL sin login
9. Ve horario en modo solo lectura

## Consideraciones Técnicas

### Performance
- Datos públicos duplicados (trade-off por seguridad)
- Snapshot en momento de publicación
- Sin queries complejas en lado público

### Escalabilidad
- Cada publicación genera nuevo documento
- IDs únicos por timestamp
- Sin límite de publicaciones

### Mantenimiento
- Datos públicos independientes
- No afecta sistema interno
- Fácil limpieza si es necesario

## Próximos Pasos (Futuro)

- PWA manifest dinámico por empresa
- Offline mode para horarios públicos
- Notificaciones de cambios
- QR codes para fácil compartir
- Integración con calendarios externos
