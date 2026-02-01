# Sistema de Navegación de Horarios Semanales

## Overview

Se ha implementado una nueva página `/horario` que permite navegar por semanas con formato argentino (DD/MM/AAAA) y navegación temporal.

## Características Principales

### ✅ Formato Argentino de Fechas
- **TODAS** las fechas visibles usan formato DD/MM/AAAA
- Nunca se usa formato ISO ni anglosajón
- Componentes reutilizables para consistencia

### ✅ IDs de Semana Estandarizados
- Formato: `MM/AAAA-W{n}` (ej: `01/2025-W1`, `12/2024-W52`)
- Basado en semanas que comienzan en lunes
- Generación automática y parsing inverso

### ✅ Estructura de Datos en Firestore

#### Settings (`apps/horarios/settings/main`)
```javascript
{
  publishedWeekId: "01/2025-W1",  // Semana actualmente publicada
  updatedAt: timestamp,
  updatedBy: "userId"
}
```

#### Weeks (`apps/horarios/weeks/{weekId}`)
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

#### `DateDisplay`
- Muestra fechas en formato argentino
- Soporta múltiples formatos (short, long, time, datetime)

```typescript
<DateDisplay date={new Date()} format="short" />
// Output: 01/01/2025
```

#### `WeekDisplay`
- Muestra información de semana en formato humano
- Incluye weekId y rango de fechas descriptivo

```typescript
<WeekDisplay 
  weekId="01/2025-W1"
  startDate="01/01/2025"
  endDate="05/01/2025"
/>
// Output: "1 al 5 de enero de 2025"
```

## Comportamiento de la Aplicación

### 1. Carga Inicial
- Lee `settings.publishedWeekId` desde Firestore
- Muestra esa semana por defecto
- Si no existe, usa semana actual

### 2. Navegación
- **Semana anterior**: Resta 7 días
- **Semana siguiente**: Suma 7 días
- **Navegación directa**: Permite ir a cualquier weekId

### 3. Datos de Semana
- Cada navegación carga/crea el documento de la semana
- Los datos se sincronizan automáticamente
- Todo el histórico está disponible

## Uso

### Acceder a la página
```
http://localhost:3000/horario
```

### Navegación
- Usar botones ← → para cambiar de semana
- El ID de semana se muestra en el centro
- Las fechas siempre en formato DD/MM/AAAA

### Extensión Futura
Esta página está diseñada como base para:
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
