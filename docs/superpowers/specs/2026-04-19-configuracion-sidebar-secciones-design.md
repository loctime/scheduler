# Configuración — Sidebar con secciones y guardado por sección

**Fecha:** 2026-04-19
**Archivo afectado principal:** `app/dashboard/configuracion/page.tsx`

## Problema

La página de configuración actual apila ~11 tarjetas en una sola columna vertical sin agrupación. Mezcla cosas del perfil del usuario, datos de la empresa, reglas del calendario, cálculos de horas extra, medios turnos, invitaciones, etc. Es difícil encontrar una opción puntual y el botón único "Guardar configuración" guarda todo a la vez, lo que genera fricción cuando se edita solo un campo.

## Objetivo

Reorganizar la página de configuración en secciones navegables por un sidebar vertical, con guardado independiente por sección. Dejar preparadas secciones futuras ("Próximamente") para que crezca sin volver a rehacer el layout.

## Alcance

- **In scope:** reorganización visual de la página, guardado por sección, estructura de archivos por sección, sidebar con navegación persistida en URL, placeholders de secciones futuras.
- **Out of scope:** implementación del contenido real de las secciones "Próximamente" (Notificaciones, Apariencia, Integraciones, Facturación, Seguridad, Datos y privacidad). Quedan con un componente placeholder.
- **Out of scope:** cambios al esquema de `Configuracion` en Firestore. Los campos y la forma de persistencia no cambian.
- **Out of scope:** cambios al guardado interno de `ProfileCard` e `InvitationsCard` (ya guardan por su cuenta).

## Diseño

### Layout

Dentro de `DashboardLayout`, dos columnas:

- **Izquierda (sidebar, ~240px de ancho):** lista vertical de secciones. Cada item es un botón con icono + label. El item activo tiene fondo resaltado. Las secciones "Próximamente" se ven con opacidad reducida y están deshabilitadas (cursor-not-allowed).
- **Derecha (contenido):** solo renderiza el componente de la sección activa. Ocupa el resto del ancho disponible.

En mobile (`md:` breakpoint), el sidebar se convierte en un `Select` (shadcn) arriba del contenido, que cambia la sección activa. La columna de contenido ocupa todo el ancho.

### Navegación y estado

- Estado `activeSection: string` en `useState` dentro de `page.tsx`, con default `"perfil"`.
- Sincronizado con el query param `?section=xxx` de la URL usando `useSearchParams` + `router.replace`, sin recargar la página. Esto permite linkear directo a una sección (ej: `/dashboard/configuracion?section=calendario`).
- Si el query param trae una sección inválida o restringida, cae al default `"perfil"`.

### Permisos

Las secciones sensibles solo aparecen en el sidebar si `canSeeAdminAndOperatorSettings` (rol `admin` u `operador`):
- Empresa, Calendario, Horarios y cálculos, Medios turnos, Equipo.

Las secciones "Próximamente" y "Mi perfil" son visibles para cualquier rol.

Si un usuario sin permisos intenta acceder a una sección restringida vía query param, se fuerza `activeSection = "perfil"` y se limpia el query param.

### Secciones del sidebar

| # | Clave | Label | Estado | Visibilidad |
|---|---|---|---|---|
| 1 | `perfil` | Mi perfil | Activa | Todos |
| 2 | `empresa` | Empresa | Activa | Admin/operador |
| 3 | `calendario` | Calendario | Activa | Admin/operador |
| 4 | `horarios` | Horarios y cálculos | Activa | Admin/operador |
| 5 | `medios-turnos` | Medios turnos | Activa | Admin/operador |
| 6 | `equipo` | Equipo | Activa | Admin/operador |
| 7 | `notificaciones` | Notificaciones | Próximamente | Todos |
| 8 | `apariencia` | Apariencia | Próximamente | Todos |
| 9 | `integraciones` | Integraciones | Próximamente | Todos |
| 10 | `facturacion` | Facturación / Plan | Próximamente | Todos |
| 11 | `seguridad` | Seguridad | Próximamente | Todos |
| 12 | `datos-privacidad` | Datos y privacidad | Próximamente | Todos |

### Contenido por sección

- **`perfil`** — `ProfileCard` (sin cambios) + card de **Firma Digital** con botón "Guardar firma" propio.
- **`empresa`** — Card "Configuración General" (nombre empresa, color empresa) + Card "URL de la aplicación" (slug público, ya guarda aparte). Un botón "Guardar empresa" al final de la primera card.
- **`calendario`** — Card unificada con: día inicio de mes, día inicio de semana, mostrar fines de semana, formato hora 24h. Un botón "Guardar calendario" al final.
- **`horarios`** — Card unificada con: horas máximas por día, minutos descanso, horas mínimas para descanso, y reglas horarias (normales/día, normales/semana, inicio horario nocturno, límite diario). Un botón "Guardar horarios" al final.
- **`medios-turnos`** — La misma card actual de medios turnos, con un botón "Guardar medios turnos" al final.
- **`equipo`** — `InvitationsCard` (sin cambios, guarda por su cuenta).
- **`notificaciones`, `apariencia`, `integraciones`, `facturacion`, `seguridad`, `datos-privacidad`** — placeholder `ComingSoonSection` (card con título de la sección e ícono + texto "Esta sección estará disponible pronto").

### Guardado por sección

**Patrón:**

- Se elimina el botón global "Guardar configuración" sticky al final de la página.
- Cada sección editable tiene su propio botón "Guardar" al final.
- Estado `saving` local por sección (no compartido).
- Cada sección mantiene un **borrador local** (`useState`) inicializado desde `config`, y se compara contra `config` para determinar "dirty". El botón "Guardar" se deshabilita si no hay cambios.
- Al guardar con éxito, el borrador local se actualiza al valor guardado y el `config` global (en `page.tsx`) también.

**API compartida desde `page.tsx` a las secciones:**

```ts
type SaveSectionFn = (partial: Partial<Configuracion>) => Promise<void>
```

`saveSection` recibe solo los campos que edita la sección, agrega `updatedAt`, `updatedBy`, `updatedByName`, y hace `setDoc(configRef, partial, { merge: true })`. También actualiza el estado `config` en `page.tsx`. Muestra un toast de éxito/error.

Para valores `undefined` (ej: `colorEmpresa`, `nombreFirma`, `firmaDigital`), `saveSection` aplica la misma lógica actual de limpieza (no incluir el campo si es undefined, usar `null` para `firmaDigital` cuando corresponde).

**Secciones y los campos que guardan:**

- **Empresa:** `nombreEmpresa`, `colorEmpresa` (más el flujo de crear slug público si no existe; se mantiene el check actual).
- **Calendario:** `mesInicioDia`, `semanaInicioDia`, `mostrarFinesDeSemana`, `formatoHora24`.
- **Horarios y cálculos:** `horasMaximasPorDia`, `minutosDescanso`, `horasMinimasParaDescanso`, `reglasHorarias`.
- **Medios turnos:** `mediosTurnos`.
- **Perfil (firma):** `nombreFirma`, `firmaDigital`.

### Estructura de archivos

```
app/dashboard/configuracion/
├── page.tsx                                  # orquesta estado, saveSection, router de sección
├── components/
│   ├── profile-card.tsx                      # existente, sin cambios
│   ├── invitations-card.tsx                  # existente, sin cambios
│   └── settings-sidebar.tsx                  # NUEVO
└── sections/                                 # NUEVO directorio
    ├── perfil-section.tsx
    ├── empresa-section.tsx
    ├── calendario-section.tsx
    ├── horarios-section.tsx
    ├── medios-turnos-section.tsx
    ├── equipo-section.tsx
    └── coming-soon-section.tsx
```

**Props de cada sección editable:**

```ts
type SectionProps = {
  config: Configuracion
  saveSection: SaveSectionFn
}
```

Cada componente maneja su propio borrador local, botón guardar, estado `saving` y `dirty`.

### Unidades y responsabilidades

- **`page.tsx`** — carga inicial del `config`, estado `activeSection`, sync con URL, permisos, provee `saveSection` y renderiza sidebar + sección activa.
- **`settings-sidebar.tsx`** — recibe `sections: SidebarItem[]`, `active: string`, `onChange: (key: string) => void`. No conoce el contenido de cada sección. En mobile, renderiza un `Select`.
- **`sections/*-section.tsx`** — cada una sabe qué campos edita, mantiene borrador local, y llama a `saveSection` con su partial.
- **`coming-soon-section.tsx`** — recibe `title: string`, renderiza card con mensaje "Esta sección estará disponible pronto".

### Flujo de datos (editar "Calendario")

1. Usuario hace click en "Calendario" en el sidebar → `activeSection = "calendario"` → URL pasa a `?section=calendario` → se renderiza `<CalendarioSection config saveSection />`.
2. `CalendarioSection` inicializa borrador local con los 4 campos tomados de `config`.
3. Usuario cambia `mostrarFinesDeSemana`. El borrador se actualiza. El botón "Guardar calendario" deja de estar deshabilitado.
4. Click en "Guardar calendario" → `saveSection({ mostrarFinesDeSemana, mesInicioDia, semanaInicioDia, formatoHora24 })` → `setDoc` con merge + toast "Calendario actualizado".
5. `config` global se actualiza en `page.tsx`, el borrador local queda sincronizado, botón "Guardar" vuelve a disabled.

### Manejo de errores

- Si `saveSection` falla, muestra toast destructivo con el mensaje del error. El borrador local se mantiene (no se pierde lo que el usuario estaba editando). El botón "Guardar" vuelve a estar activo para reintentar.
- Si el usuario navega a otra sección con cambios sin guardar en la actual, el borrador se pierde silenciosamente (no hay confirmación). Es aceptable porque el guardado es explícito por diseño — se puede agregar una confirmación después si hace falta.

### Testing

- Verificación manual en dev server:
  1. Entrar a `/dashboard/configuracion` como admin → ve todas las secciones.
  2. Clickear cada sección activa → se renderiza el contenido correcto.
  3. Editar un campo en "Calendario" → botón "Guardar calendario" se activa → guardar → toast de éxito → recargar → el valor persiste.
  4. Deep link: `/dashboard/configuracion?section=horarios` → abre directo en "Horarios y cálculos".
  5. Como rol `colaborador`: solo ve "Mi perfil" + las de "Próximamente". Intentar `?section=empresa` fuerza a `perfil`.
  6. Mobile (ancho < md): el sidebar se convierte en `Select`.
  7. Clickear una sección "Próximamente" no hace nada (está disabled).

## Trade-offs aceptados

- **Borrador local por sección:** duplica el estado (una copia en `page.tsx` + una en cada sección). Vale la pena para poder mostrar "dirty" y habilitar/deshabilitar el botón Guardar correctamente.
- **Sin confirmación al cambiar de sección con cambios sin guardar:** simple, se puede agregar después si molesta.
- **Slug público sigue con su propia lógica de guardado independiente:** ya era así y no tiene sentido tocarlo en esta reorganización.
