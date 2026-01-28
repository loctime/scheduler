# PWA Horario - Solución de Persistencia de OwnerId

## Problema Resuelto

El PWA de horarios funcionaba correctamente en desktop pero fallaba en móvil con el error "falta el id del propietario del horario" cuando se instalaba como PWA, ya que no tenía acceso a la navegación previa que contenía el `ownerId`.

## Cambios Implementados

### 1. Archivo: `lib/pwa-horario.ts`

#### Nuevas Constantes:
- `PWA_HORARIO_OWNER_ID_KEY`: Key para localStorage (`"pwa_horario_owner_id"`)
- `OWNER_ID_MISSING_ERROR`: Error explícito (`"OWNER_ID_MISSING"`)

#### Nuevas Funciones:
- `setHorarioOwnerId(ownerId: string)`: Guarda el ownerId en localStorage
- `getHorarioOwnerId(): string | null`: Recupera el ownerId desde localStorage

#### Funciones Modificadas:
- `getPwaHorarioUrls(ownerId?: string)`: Ahora acepta ownerId opcional, usa localStorage si no se proporciona, lanza error si no hay ninguno
- `savePublishedHorario()`: El parámetro `ownerId` ahora es opcional
- `loadPublishedHorario()`: El parámetro `ownerId` ahora es opcional

### 2. Archivo: `app/pwa/horario/page.tsx`

#### Mejoras:
- Importa las nuevas funciones del helper
- Implementa lógica de prioridad: URL parameter → localStorage → error
- Guarda el ownerId en localStorage cuando se encuentra
- Manejo explícito de errores con estados diferenciados
- Mejor UX con indicadores de carga y error específicos

### 3. Archivo: `components/schedule-calendar.tsx`

#### Mejoras:
- Importa `setHorarioOwnerId`
- Guarda automáticamente el ownerId en localStorage cuando se publica el horario PWA
- Esto asegura que el PWA instalado tenga el ownerId disponible en futuras visitas

## Flujo de Funcionamiento

### 1. Primera Publicación (Desktop)
1. Usuario publica horario usando el botón "Actualizar PWA de horarios"
2. `handlePublishPwa()` guarda el `ownerId` en localStorage
3. Horario se publica correctamente

### 2. Acceso via Link (Desktop/Móvil)
1. Usuario accede a `/pwa/horario?ownerId=xxx`
2. Página detecta ownerId en URL
3. Guarda ownerId en localStorage
4. Muestra horario correctamente

### 3. Acceso Directo PWA Instalado (Móvil)
1. Usuario abre PWA instalado (sin parámetros URL)
2. Página busca ownerId en localStorage
3. Si encuentra ownerId → muestra horario
4. Si no encuentra ownerId → muestra error explícito

## Características de Seguridad

- **Validación explícita**: No se permite continuar sin ownerId válido
- **Error claro**: Mensaje específico cuando falta el ownerId
- **Persistencia segura**: Solo se guarda el ownerId, no datos sensibles
- **Fallback robusto**: Múltiples fuentes para obtener el ownerId

## Testing

Se incluye archivo de prueba: `__tests__/pwa-horario.test.ts`

Pruebas cubren:
- Persistencia de ownerId en localStorage
- Generación de URLs con diferentes fuentes de ownerId
- Manejo de errores cuando falta ownerId
- Guardado y carga de horarios publicados

## Compatibilidad

- **Desktop**: 100% compatible, sin cambios visibles
- **Móvil PWA**: Ahora funciona correctamente después de instalación
- **Backend**: Sin cambios necesarios
- **Service Worker**: Sin cambios necesarios

## Resolución del Error Original

El error "falta el id del propietario del horario" ahora se resuelve mediante:

1. **Persistencia**: El ownerId se guarda la primera vez que se publica o accede
2. **Recuperación**: El PWA instalado puede recuperar el ownerId desde localStorage
3. **Claridad**: Error explícito si realmente no hay ownerId disponible
4. **Automatización**: El proceso es transparente para el usuario

El PWA móvil ahora muestra el horario correctamente en todos los escenarios.
