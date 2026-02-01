# Sistema de Navegación de Horarios Semanales

## Overview

Se ha implementado una nueva página `/horario` que permite navegar por semanas con formato argentino (DD/MM/AAAA), navegación temporal y UI de estado clara.

## Características Principales

### ✅ Formato Argentino de Fechas
- **TODAS** las fechas visibles usan formato DD/MM/AAAA
- Formato de rango: "26 de enero – 01 de febrero, 2026"
- Nunca se usa formato ISO ni anglosajón
- Componentes reutilizables para consistencia

### ✅ IDs de Semana Estandarizados
- Formato: `MM/AAAA-W{n}` (ej: `01/2025-W1`, `12/2024-W52`)
- Basado en semanas que comienzan en lunes
- Generación automática y parsing inverso

### ✅ UI de Estado Clara
- **Chips de estado visual**:
  - 🔵 "Semana visualizada": weekId actualmente mostrada
  - 🟢 "Semana publicada": settings.publishedWeekId
- **Destaque visual**: Si coinciden → color primary verde
- **Claridad**: Si no coinciden → ambos chips claramente visibles

### ✅ Header Principal Mejorado
- **Rango de fechas**: Formato "26 de enero – 01 de febrero, 2026"
- **Navegación explícita**: Botones "← Semana anterior" y "→ Semana siguiente"
- **Empresa activa**: Muestra nombre debajo del título
- **Estilo consistente**: Similar al dashboard (compacto, limpio)

### ✅ Barra de Acciones Admin
- **Botón "Publicar esta semana"**: Solo visible para usuarios admin
- **Acción directa**: `settings.publishedWeekId = weekId visualizada`
- **Confirmación visual**: Toast notification + actualización de UI
- **Estado contextual**: Muestra si la semana está publicada o no

## Comportamiento Mejorado

### 1. Carga Inicial
- Lee `settings.publishedWeekId` desde Firestore
- Muestra esa semana por defecto
- Si no existe, usa semana actual

### 2. Navegación
- **Semana anterior**: Resta 7 días
- **Semana siguiente**: Suma 7 días
- **Navegación directa**: Permite ir a cualquier weekId
- **Feedback inmediato**: Actualización de UI sin recarga

### 3. Gestión de Estado
- **Lectura**: Siempre muestra estado actual
- **Publicación**: Solo admins pueden publicar semanas
- **Visualización**: Todos pueden navegar, pero solo ven semanas publicadas

## Componentes y Hooks

### Hooks Personalizados

#### `useWeekNavigation`
- Maneja la navegación entre semanas
- Generación y parsing de weekIds
- Formato humanizado de rangos de fechas

```typescript
const {
  currentWeek,
  isLoading,
  goToPreviousWeek,
  goToNextWeek,
  goToWeek,
  formatWeekDisplay,
  getAllWeeksOfYear
} = useWeekNavigation(initialWeekId)
```

#### `useSettings`
- Maneja configuración global de settings
- Lectura/escritura de `publishedWeekId`

```typescript
const {
  settings,
  isLoading,
  updatePublishedWeek,
  refreshSettings
} = useSettings()
```

#### `useWeekData`
- Maneja datos específicos de una semana en Firestore
- CRUD operations para documentos de semana

```typescript
const {
  weekData,
  isLoading,
  error,
  saveWeekData,
  refreshWeekData
} = useWeekData(weekId)
```

### Componentes UI

#### `WeekRangeDisplay`
- Muestra rango de fechas en formato argentino
- Formato: "26 de enero – 01 de febrero, 2026"

```typescript
<WeekRangeDisplay 
  startDate="26/01/2026"
  endDate="01/02/2026"
/>
// Output: "26 de enero – 01 de febrero, 2026"
```

#### `DateDisplay`
- Muestra fechas individuales en formato DD/MM/AAAA

```typescript
<DateDisplay date={new Date()} format="short" />
// Output: 26/01/2026
```

#### `WeekDisplay`
- Muestra información completa de semana

```typescript
<WeekDisplay 
  weekId="01/2025-W1"
  startDate="01/01/2025"
  endDate="05/01/2025"
/>
```

## Estructura de Datos en Firestore

### Settings (`apps/horarios/settings/main`)
```javascript
{
  publishedWeekId: "01/2025-W1",  // Semana actualmente publicada
  updatedAt: timestamp,
  updatedBy: "userId"
}
```

### Weeks (`apps/horarios/weeks/{weekId}`)
```javascript
{
  weekId: "01/2025-W1",
  startDate: "01/01/2025",  // DD/MM/AAAA
  endDate: "05/01/2025",    // DD/MM/AAAA
  weekNumber: 1,
  year: 2025,
  month: 0,  // JavaScript month (0-indexed)
  createdAt: timestamp,
  updatedAt: timestamp,
  scheduleData: {}  // Aquí se guardará el horario real
}
```

## UI/UX Implementada

### Header Principal
```
Horario Semanal
📅 26 de enero – 01 de febrero, 2026
Empresa activa: Nombre Empresa

[← Semana anterior]     [Semana siguiente →]
```

### Chips de Estado
```
🔵 Semana visualizada: 01/2025-W1
🟢 ✓ Semana publicada: 01/2025-W1
```

### Barra de Acciones (Admin)
```
📤 Esta semana está publicada y visible para todos los usuarios.

[Publicar esta semana] ← (solo si no está publicada)
```

## Flujo de Usuario

### Para Todos los Usuarios:
1. **Navegación**: Pueden navegar por cualquier semana
2. **Visualización**: Ven chips de estado claros
3. **Fechas**: Todas en formato argentino

### Para Administradores:
1. **Publicación**: Botón para publicar semana actual
2. **Confirmación**: Toast + actualización inmediata de UI
3. **Control**: Estado claro de qué está publicado vs visualizado

## Restriciones Cumplidas

- ✅ **NO modificar modelo de datos**: Se usa estructura existente
- ✅ **NO agregar lógica PWA**: Base limpia para futuro
- ✅ **NO usar formatos ISO**: Solo DD/MM/AAAA
- ✅ **TODAS las fechas en formato argentino**: Verificado en todos los componentes

## Uso

### Acceder a la página
```
http://localhost:3000/horario
```

### Navegación
- Botones ← → para cambiar de semana
- Chips de estado siempre visibles
- Publicación solo para admins

### Extensión Futura
Esta página está lista para:
- Integración con horarios existentes
- Funcionalidad PWA futura
- Edición de horarios semanales

## Scripts de Mantenimiento

### Inicializar Settings
```bash
node scripts/init-settings.js
```
Crea el documento `settings/main` con la semana actual publicada.

## Consideraciones Técnicas

### Manejo de Errores
- Validación de fechas inválidas
- Verificación de disponibilidad de Firestore
- Toast notifications para feedback al usuario

### Performance
- Loading states optimizados
- Carga lazy de datos de semana
- Cache local de settings

### Seguridad
- Solo admins pueden publicar semanas
- Validación de roles en cliente
- Feedback claro de permisos

### TypeScript
- Tipado completo para todos los componentes
- Interfaces bien definidas
- Validación de datos en runtime

## Próximos Pasos

1. **Integración con horarios existentes**: Conectar con la lógica de horarios actual
2. **Funcionalidad de edición**: Permitir modificar horarios semanales
3. **PWA**: Convertir en aplicación progresiva
4. **Offline support**: Caché local para navegación sin conexión

## Notas Importantes

- **NO** se copia datos entre semanas
- **NO** se usa lógica de PWA actualmente
- **SÍ** todo el histórico está disponible
- **SÍ** las fechas son siempre en formato argentino
- **SÍ** la navegación es infinita (sin límites de tiempo)
- **SÍ** hay UI de estado clara y acciones explícitas
