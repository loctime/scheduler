# Manifest Dinámico PWA Horarios

## Resumen de Implementación

Se ha implementado un manifest dinámico para el PWA de horarios que personaliza el nombre de la aplicación con el nombre de la empresa del usuario.

### Funcionalidad
- **Nombre dinámico**: `Horarios – {companyName}`
- **Nombre corto**: `Horarios` (fijo)
- **Descripción**: Incluye el nombre de la empresa
- **Compatibilidad**: Android e iOS
- **Fallback**: Usa "Empleado" si no hay configuración

## Cambios Implementados

### 1. Route Handler Dinámico
**Archivo**: `app/api/manifest-horario/route.ts`

```typescript
GET /api/manifest-horario?ownerId=XXX
```

**Características**:
- Obtiene `companyName` desde Firestore configuración del usuario
- Fallback a "Empleado" si no hay configuración
- Headers de cache optimizados
- Error handling robusto
- Compatible con PWA estándar

### 2. Layout Actualizado
**Archivo**: `app/pwa/horario/layout.tsx`

```typescript
manifest: "/api/manifest-horario" // Dinámico
```

**Cambio**: Apunta al endpoint dinámico en lugar del archivo estático

### 3. Página PWA Mejorada
**Archivo**: `app/pwa/horario/page.tsx`

**Nueva funcionalidad**:
- Detecta `ownerId` automáticamente
- Actualiza dinámicamente el link del manifest
- Usa `useEffect` para manipular el DOM
- Compatible con Next.js App Router

## Flujo de Funcionamiento

### 1. Primera Carga (sin ownerId)
```
1. Usuario accede a /pwa/horario
2. Layout carga manifest: /api/manifest-horario
3. Sin ownerId → usa fallback "Empleado"
4. Muestra: "Horarios – Empleado"
```

### 2. Con ownerId en URL
```
1. Usuario accede: /pwa/horario?ownerId=XXX
2. useEffect detecta ownerId
3. Actualiza manifest: /api/manifest-horario?ownerId=XXX
4. Obtiene companyName desde Firestore
5. Muestra: "Horarios – {companyName}"
```

### 3. PWA Instalado
```
1. Usuario abre PWA instalado
2. Recupera ownerId desde localStorage
3. Actualiza manifest dinámicamente
4. Muestra nombre personalizado
```

## Estructura del Manifest Dinámico

### Campos Personalizados
```json
{
  "name": "Horarios – {companyName}",
  "short_name": "Horarios",
  "description": "Visualización del horario semanal del personal – {companyName}",
  "shortcuts": [
    {
      "name": "Ver Horario",
      "description": "Ver el horario semanal – {companyName}",
      "url": "/pwa/horario"
    }
  ]
}
```

### Campos Estáticos
```json
{
  "start_url": "/pwa/horario",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "scope": "/pwa/horario",
  "icons": [...],
  "categories": ["productivity", "business"]
}
```

## Cache y Performance

### Headers del Endpoint
```http
Content-Type: application/manifest+json
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

**Estrategia**:
- **Fresh**: 1 hora (cache del navegador)
- **Stale**: 24 horas (sirve viejo mientras revalida)
- **Error**: 5 minutos (fallback)

## Compatibilidad PWA

### Android
- ✅ Nombre dinámico en launcher
- ✅ Nombre corto en notificaciones
- ✅ Descripción personalizada
- ✅ Shortcuts con nombre de empresa

### iOS
- ✅ Nombre en home screen
- ✅ Compatible con estándar PWA
- ✅ Sin cambios en comportamiento

## Limitaciones Importantes

### ⚠️ Actualización del Nombre
**NOTA**: El nombre del PWA solo se actualiza al reinstalar la aplicación.

**Explicación**:
- Los navegadores cachean el manifest permanentemente
- No se vuelve a descargar hasta reinstalar el PWA
- Es comportamiento estándar de todos los navegadores

### Soluciones Alternativas
1. **Reinstalación manual**: Usuario debe reinstalar PWA
2. **Forzar actualización**: No disponible en navegadores estándar
3. **Nombre genérico**: Usar "Horarios" sin personalización

## Testing Manual

### 1. Manifest Dinámico
```bash
# Test sin ownerId
curl "http://localhost:3000/api/manifest-horario"

# Test con ownerId
curl "http://localhost:3000/api/manifest-horario?ownerId=USER123"
```

### 2. PWA en Navegador
1. Abrir DevTools → Application → Manifest
2. Verificar que carga el endpoint dinámico
3. Comprobar nombre personalizado

### 3. Instalación PWA
1. Instalar PWA con diferentes ownerId
2. Verificar nombre en launcher
3. Cambiar ownerId y reinstalar para probar actualización

## Ejemplos de Nombres

### Con Configuración
```
companyName: "Restaurant El Sabor"
→ "Horarios – Restaurant El Sabor"

companyName: "Clinica Médica Central"
→ "Horarios – Clinica Médica Central"

companyName: "Tienda La Bendición"
→ "Horarios – Tienda La Bendición"
```

### Sin Configuración
```
→ "Horarios – Empleado"
```

## Consideraciones de Seguridad

### Validación de Datos
- ✅ Sanitización de `ownerId`
- ✅ Validación de configuración
- ✅ Fallback seguro
- ✅ Error handling robusto

### Performance
- ✅ Cache inteligente
- ✅ Mínimas llamadas a Firestore
- ✅ Headers optimizados
- ✅ Sin impacto en UX

## Resumen

El manifest dinámico proporciona:
- **Personalización**: Nombre con empresa del usuario
- **Compatibilidad**: Android e iOS estándar
- **Performance**: Cache optimizado
- **Robustez**: Fallbacks y error handling
- **Mantenibilidad**: Código simple y documentado

**Limitación**: El nombre solo actualiza al reinstalar el PWA (comportamiento estándar del navegador).
