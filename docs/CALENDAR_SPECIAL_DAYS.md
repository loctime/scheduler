# Sistema de Días Especiales del Calendario

## Overview

El sistema de días especiales permite gestionar feriados, días no laborables y eventos que afectan la generación de horarios. Se integra automáticamente con la API de feriados de Argentina y permite agregar días especiales manualmente.

## Características Principales

### ✅ Funcionalidades Implementadas

1. **Detección automática de feriados** mediante API oficial de Argentina
2. **Gestión manual de días especiales** locales
3. **Almacenamiento centralizado** en Firestore
4. **Visualización en calendario** con badges y advertencias
5. **Advertencias automáticas** al generar horarios
6. **Soporte multi-ubicación** (ciudades, provincias, países)
7. **Control de acceso** por roles de usuario
8. **Formato argentino DD/MM/AAAA** en toda la UI

## Arquitectura

### Modelo de Datos (Firestore)

```
calendarSpecialDays/{specialDayId}
├── id: string              // "viedma-2026-01-01"
├── date: string            // "2026-01-01" (ISO)
├── city: string            // "Viedma"
├── province: string        // "Río Negro"
├── country: string         // "Argentina"
├── title: string           // "Año Nuevo"
├── description?: string    // Descripción opcional
├── type: enum              // feriado | no_laborable | local | evento
├── scope: enum             // nacional | provincial | municipal
├── severity: enum          // info | warning | critical
├── affectsScheduling: bool // true si afecta horarios
├── source: enum            // api | manual
├── createdAt: timestamp
└── updatedAt: timestamp
```

### Componentes Principales

#### 1. Tipos y Utilidades
- `lib/types/calendar-special-days.ts` - Definiciones de tipos
- `lib/calendar-special-days.ts` - Utilidades de formato y conversión

#### 2. Servicios
- `lib/services/holidays-api.ts` - Cliente API de feriados Argentina

#### 3. Hooks
- `hooks/use-calendar-special-days.ts` - Hook principal de gestión
- `hooks/use-holiday-import.ts` - Hook de importación

#### 4. Componentes UI
- `components/calendar/special-day-badge.tsx` - Badges para días especiales
- `components/calendar/special-day-calendar.tsx` - Calendario visual
- `components/calendar/special-day-manager.tsx` - CRUD y gestión
- `components/calendar/scheduling-warnings.tsx` - Advertencias

#### 5. Páginas
- `app/dashboard/dias-especiales/page.tsx` - Panel de administración

## Uso

### 1. Importar Feriados Automáticamente

```typescript
import { useHolidayImport } from '@/hooks/use-calendar-special-days'

function HolidayImporter() {
  const { importNationalHolidays, importRioNegroHolidays, importing } = useHolidayImport()
  
  const handleImport = async () => {
    try {
      await importNationalHolidays(2026)
      console.log('Feriados importados')
    } catch (error) {
      console.error('Error:', error)
    }
  }
  
  return (
    <button onClick={handleImport} disabled={importing}>
      {importing ? 'Importando...' : 'Importar Feriados Nacionales'}
    </button>
  )
}
```

### 2. Mostrar Días Especiales en Calendario

```typescript
import { SpecialDayCalendar } from '@/components/calendar/special-day-calendar'

function MyCalendar() {
  return (
    <SpecialDayCalendar
      city="Viedma"
      province="Río Negro"
      country="Argentina"
      onDateSelect={(date, specialDays) => {
        console.log('Fecha seleccionada:', date)
        console.log('Días especiales:', specialDays)
      }}
      showWeekends={true}
      compact={false}
    />
  )
}
```

### 3. Verificar Advertencias al Generar Horarios

```typescript
import { SchedulingWarnings } from '@/components/calendar/scheduling-warnings'

function ScheduleGenerator() {
  const startDate = '2026-01-01'
  const endDate = '2026-01-31'
  
  return (
    <SchedulingWarnings
      startDate={startDate}
      endDate={endDate}
      city="Viedma"
      province="Río Negro"
      onContinue={() => {
        console.log('Continuar con generación')
      }}
      onCancel={() => {
        console.log('Cancelar generación')
      }}
    />
  )
}
```

### 4. Gestión Manual de Días Especiales

```typescript
import { useCalendarSpecialDays } from '@/hooks/use-calendar-special-days'

function SpecialDayManager() {
  const { 
    specialDays, 
    addSpecialDay, 
    updateSpecialDay, 
    deleteSpecialDay 
  } = useCalendarSpecialDays()
  
  const handleAdd = async () => {
    await addSpecialDay({
      date: '2026-12-25',
      city: 'Viedma',
      province: 'Río Negro',
      country: 'Argentina',
      title: 'Navidad',
      type: 'feriado',
      scope: 'nacional',
      severity: 'critical',
      affectsScheduling: true,
      source: 'manual'
    })
  }
  
  return (
    <div>
      <button onClick={handleAdd}>Agregar Día Especial</button>
      {/* Lista de días especiales */}
    </div>
  )
}
```

## Configuración

### Variables de Entorno

No se requieren variables de entorno adicionales. El sistema usa la API pública de ArgentinaDatos.

### Configuración de Ubicación

Por defecto, el sistema está configurado para:
- **Ciudad**: Viedma
- **Provincia**: Río Negro  
- **País**: Argentina

Para cambiar la configuración, modifica los valores en los componentes:

```typescript
const config = {
  city: 'Bariloche',
  province: 'Río Negro',
  country: 'Argentina'
}
```

## API de Feriados

### Endpoint

```
https://apis.datos.gob.ar/feriados/v1.0/{year}
```

### Respuesta

```json
[
  {
    "id": 1,
    "dia": 1,
    "mes": 1,
    "motivo": "Año Nuevo",
    "tipo": "nacional",
    "info": "",
    "opcional": "No",
    "id_tipo": 1,
    "id_info": 0,
    "id_opcional": 0
  }
]
```

## Reglas de Seguridad (Firestore)

### Permisos

- **Lectura**: Todos los usuarios autenticados
- **Creación**: Admin/Manager (cualquier tipo) o Invitados (solo locales/provinciales)
- **Actualización**: Admin/Manager (cualquier) o Invitados (solo manuales locales/provinciales)
- **Eliminación**: Admin/Manager (cualquier) o Invitados (solo manuales locales/provinciales)

### Validaciones

- Fecha en formato YYYY-MM-DD
- Tipo, alcance y severidad válidos
- Campos obligatorios presentes
- Timestamps válidos

## Integración con Sistema de Horarios

### 1. Advertencias Automáticas

El sistema muestra advertencias cuando se generan horarios para períodos que contienen días especiales.

### 2. Badges en Calendario

Los días especiales se muestran como badges coloreados en el calendario principal.

### 3. Filtros por Ubicación

El sistema filtra automáticamente según la ubicación configurada para el usuario.

## Formatos de Fecha

### Importante

- **Firestore/Lógica**: Siempre usar formato ISO `YYYY-MM-DD`
- **UI/Usuario**: Siempre mostrar formato argentino `DD/MM/YYYY`

### Ejemplos

```typescript
// Almacenamiento en Firestore
const dateISO = '2026-01-01'

// Mostrar al usuario
const dateDisplay = formatDateDisplay(dateISO) // '01/01/2026'
```

## Estados y Severidad

### Tipos de Día

- `feriado`: Feriado oficial
- `no_laborable`: Día no laborable
- `local`: Evento o día especial local
- `evento`: Evento especial

### Alcance

- `nacional`: Aplica a todo el país
- `provincial`: Aplica a una provincia
- `municipal`: Aplica a una ciudad/municipio

### Severidad

- `critical`: Afecta críticamente la operación (rojo)
- `warning`: Puede afectar la operación (naranja)
- `info`: Informativo (azul)

## Buenas Prácticas

### 1. Importación Inicial

```typescript
// Importar feriados para los próximos 3 años
const currentYear = new Date().getFullYear()
for (let year = currentYear; year <= currentYear + 3; year++) {
  await importNationalHolidays(year)
}
```

### 2. Actualización Periódica

```typescript
// Programar actualización anual de feriados
const updateHolidays = async () => {
  const nextYear = new Date().getFullYear() + 1
  await importNationalHolidays(nextYear)
}
```

### 3. Manejo de Errores

```typescript
try {
  await importNationalHolidays(2026)
} catch (error) {
  console.error('Error importando feriados:', error)
  // Mostrar notificación al usuario
}
```

## Troubleshooting

### Problemas Comunes

1. **Error de autenticación**: Verificar que el usuario esté autenticado
2. **Error de permisos**: Verificar rol del usuario (admin/manager requerido para algunas operaciones)
3. **Error de API**: Verificar conexión a internet y disponibilidad del servicio
4. **Formato de fecha incorrecto**: Usar siempre YYYY-MM-DD para Firestore

### Logs y Debug

```typescript
// Habilitar logs detallados
console.log('Días especiales cargados:', formattedSpecialDays)
console.log('Advertencias:', schedulingWarnings)
```

## Roadmap Futuro

### Mejoras Planificadas

1. **Soporte para más países** (Chile, Uruguay, etc.)
2. **Sincronización automática** periódica
3. **Notificaciones push** de próximos días especiales
4. **Integración con calendarios externos** (Google Calendar, Outlook)
5. **Reportes y estadísticas** de impacto en horarios
6. **Configuración por empresa** de ubicaciones preferidas

## Contribución

Para agregar nuevas funcionalidades:

1. Crear tipos en `calendar-special-days.ts`
2. Implementar lógica en hooks correspondientes
3. Agregar componentes UI si es necesario
4. Actualizar reglas de seguridad
5. Agregar tests y documentación

## Licencia

Este sistema es parte del proyecto de horarios y sigue las mismas licencias y políticas del proyecto principal.
