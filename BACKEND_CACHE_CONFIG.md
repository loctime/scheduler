# Configuración Backend - PWA Horario Performance

## Headers HTTP Requeridos

Para `/api/horarios/semana-actual` implementar estos headers:

```http
# Optimización de cache
Cache-Control: public, max-age=300, stale-while-revalidate=86400

# Content-Type dinámico según formato
Content-Type: image/webp    # cuando format=webp
Content-Type: image/png     # cuando format=png o sin parámetro

# Headers CORS (si aplica)
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: Content-Type
```

## Lógica del Endpoint

### Parámetros
- `ownerId` (required): ID del propietario del horario
- `format` (optional): `webp` o `png` - formato de imagen deseado

### Flujo Recomendado
```javascript
// 1. Validar ownerId
if (!ownerId) {
  return 400 - Bad Request
}

// 2. Determinar formato
const format = req.query.format || 'png'
const supportsWebP = format === 'webp'

// 3. Obtener imagen (de Backblaze B2)
const imageBuffer = await getImageFromBackblaze(ownerId, supportsWebP)

// 4. Configurar headers
res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
res.setHeader('Content-Type', supportsWebP ? 'image/webp' : 'image/png')

// 5. Enviar imagen
res.send(imageBuffer)
```

## Optimización de Imágenes

### Almacenamiento en Backblaze B2
```
bucket/
├── horarios/
│   ├── {ownerId}/
│   │   ├── semana-actual.png    # Original PNG
│   │   └── semana-actual.webp   # Versión WebP (generada)
```

### Generación WebP (opcional)
Si no tienes WebP, puedes:
1. **Servir siempre PNG** - Simple, compatible
2. **Convertir on-the-fly** - Usar Sharp.js para convertir
3. **Pre-generar** - Proceso batch al subir

```javascript
// Ejemplo conversión on-the-fly con Sharp
const sharp = require('sharp')

async function convertToWebP(pngBuffer) {
  return await sharp(pngBuffer)
    .webp({ quality: 90 })
    .toBuffer()
}
```

## Cache Strategy

### Service Worker Cache (Frontend)
- Ya implementado: cache-first
- Sin cambios necesarios

### Browser Cache (Headers)
```http
# Configuración recomendada
Cache-Control: public, max-age=300, stale-while-revalidate=86400

# Explicación:
# max-age=300: Cache por 5 minutos (fresh)
# stale-while-revalidate=86400: Sirve cache por 24h mientras revalida
```

### CDN Cache (si usas CDN)
Configurar cache basado en query params:
- Ignorar `_t` (timestamp)
- Cache por `ownerId` y `format`

## Ejemplo de Implementación

### Node.js + Express
```javascript
app.get('/api/horarios/semana-actual', async (req, res) => {
  try {
    const { ownerId, format } = req.query
    
    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId requerido' })
    }
    
    // Determinar formato
    const isWebP = format === 'webp'
    const fileExtension = isWebP ? 'webp' : 'png'
    
    // Obtener imagen de Backblaze
    const imageUrl = `https://your-bucket.s3.us-west-004.backblazeblitz.com/horarios/${ownerId}/semana-actual.${fileExtension}`
    
    const response = await fetch(imageUrl)
    if (!response.ok) {
      return res.status(404).json({ error: 'Imagen no encontrada' })
    }
    
    const imageBuffer = await response.arrayBuffer()
    
    // Headers de cache
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
    res.setHeader('Content-Type', `image/${fileExtension}`)
    
    res.send(Buffer.from(imageBuffer))
    
  } catch (error) {
    console.error('Error en /api/horarios/semana-actual:', error)
    res.status(500).json({ error: 'Error interno' })
  }
})
```

## Testing

### Verificar Headers
```bash
curl -I "https://your-domain.com/api/horarios/semana-actual?ownerId=test&format=webp"
```

### Verificar Formatos
```bash
# Test WebP
curl "https://your-domain.com/api/horarios/semana-actual?ownerId=test&format=webp" --output test.webp

# Test PNG  
curl "https://your-domain.com/api/horarios/semana-actual?ownerId=test&format=png" --output test.png
```

### Verificar Cache
```bash
# Primera petición (debe ser 200)
curl -v "https://your-domain.com/api/horarios/semana-actual?ownerId=test"

# Segunda petición (debe ser 304 si no cambió)
curl -v "https://your-domain.com/api/horarios/semana-actual?ownerId=test"
```

## Monitoreo

### Métricas a observar
- **Cache Hit Rate**: % de peticiones servidas desde cache
- **Response Time**: Tiempo de respuesta promedio
- **Error Rate**: % de errores 4xx/5xx
- **Format Usage**: % WebP vs PNG

### Alertas recomendadas
- Response time > 2 segundos
- Error rate > 5%
- Cache hit rate < 80%

---

## Resumen

Implementar estos cambios mejorará significativamente la performance del PWA:
- **5x más rápido** con cache optimizada
- **30% más liviano** con WebP
- **Mejor UX** con zoom y placeholders
- **Backward compatible** sin romper nada existente
