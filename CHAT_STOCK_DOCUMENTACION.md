# Documentación del Chat de Stock

## Índice
1. [Introducción](#introducción)
2. [Funcionalidades Principales](#funcionalidades-principales)
3. [Modos de Operación](#modos-de-operación)
4. [Comandos Disponibles](#comandos-disponibles)
5. [Acciones y Respuestas](#acciones-y-respuestas)
6. [Integración con Ollama (IA)](#integración-con-ollama-ia)
7. [Ejemplos de Uso](#ejemplos-de-uso)
8. [Limitaciones y Consideraciones](#limitaciones-y-consideraciones)

---

## Introducción

El Chat de Stock es un asistente inteligente que permite gestionar el inventario usando lenguaje natural. Puede funcionar con o sin IA (Ollama), adaptándose automáticamente según la disponibilidad.

### Características Principales
- ✅ **Funciona sin IA**: Procesamiento básico de lenguaje natural sin necesidad de Ollama
- ✅ **Soporte opcional de IA**: Integración con Ollama para respuestas más inteligentes
- ✅ **Múltiples modos**: Pregunta, Ingreso, Egreso, Stock
- ✅ **Confirmación de acciones**: Pide confirmación para acciones importantes
- ✅ **Acumulación de productos**: Permite agregar múltiples productos antes de confirmar
- ✅ **Búsqueda inteligente**: Encuentra productos por nombre incluso con variaciones

---

## Funcionalidades Principales

### 1. Gestión de Stock
- **Agregar stock** (entrada): Incrementa el stock de un producto
- **Quitar stock** (salida): Disminuye el stock de un producto
- **Actualizar stock**: Establece un valor específico de stock
- **Consultar stock**: Muestra el stock actual de un producto

### 2. Gestión de Productos
- **Crear productos**: Agrega nuevos productos al inventario
- **Editar productos**: Modifica nombre, unidad o stock mínimo
- **Eliminar productos**: Elimina productos del inventario
- **Listar productos**: Muestra todos los productos con su stock

### 3. Gestión de Pedidos
- **Listar pedidos**: Muestra todos los pedidos/proveedores
- **Ver pedido**: Muestra productos de un pedido específico
- **Generar pedido**: Genera lista de productos a pedir según stock bajo
- **Importar productos**: Inicializa stock desde productos de pedidos

### 4. Consultas y Reportes
- **Stock general**: Muestra todo el inventario agrupado por pedido
- **Stock por pedido**: Muestra productos de un pedido específico
- **Stock bajo**: Lista productos con stock por debajo del mínimo
- **Ayuda**: Muestra comandos disponibles

---

## Modos de Operación

El chat tiene 4 modos de operación que determinan cómo se procesan los mensajes:

### 1. Modo Pregunta (Por Defecto)
**Cuándo usar**: Consultas generales, preguntas, comandos específicos

**Características**:
- Procesa comandos como "stock", "pedido nombrepedido", etc.
- Permite hacer preguntas generales
- No acumula productos

**Ejemplos**:
- "stock" → Muestra todo el inventario
- "stock Verdulería" → Muestra stock de productos del pedido Verdulería
- "pedido Verdulería" → Genera pedido para Verdulería
- "¿cuánto tengo de leche?" → Consulta stock de leche

### 2. Modo Ingreso
**Cuándo usar**: Para agregar stock de múltiples productos

**Características**:
- Acumula productos antes de confirmar
- Permite agregar varios productos escribiendo "producto cantidad"
- Requiere escribir "confirmar" para aplicar todos los cambios
- Filtra productos por pedido seleccionado (opcional)

**Ejemplos**:
- "leche 20" → Agrega 20 unidades de leche a la lista
- "papa 10" → Agrega 10 unidades de papa a la lista
- "confirmar" → Aplica todos los cambios acumulados

### 3. Modo Egreso
**Cuándo usar**: Para quitar stock de múltiples productos

**Características**:
- Similar al modo ingreso pero para quitar stock
- Valida que haya stock suficiente antes de quitar
- Acumula productos hasta confirmar

**Ejemplos**:
- "leche 5" → Quita 5 unidades de leche de la lista
- "harina 2" → Quita 2 unidades de harina de la lista
- "confirmar" → Aplica todos los cambios acumulados

### 4. Modo Stock
**Cuándo usar**: Para establecer valores específicos de stock

**Características**:
- Actualiza el stock directamente (reemplaza el valor)
- No acumula, aplica cambios inmediatamente
- Útil para correcciones o inventarios físicos

**Ejemplos**:
- "leche 15" → Establece el stock de leche en 15 unidades
- "papa 30" → Establece el stock de papa en 30 unidades

---

## Comandos Disponibles

### Comandos de Consulta

#### `stock` o `stock todo`
Muestra todo el inventario agrupado por pedido/proveedor.

**Respuesta**:
```
📦 **Stock General**

**Verdulería** (5 productos):
✅ Tomate: 20 kg
⚠️ Lechuga: 3 kg
✅ Papa: 50 kg
...

Total: 15 productos
```

#### `stock [nombre pedido]`
Muestra el stock de productos de un pedido específico.

**Ejemplo**: `stock Verdulería`

**Respuesta**:
```
📦 **Stock de Verdulería**

✅ Tomate: 20 kg
⚠️ Lechuga: 3 kg
✅ Papa: 50 kg

Total: 5 productos
```

#### `stock [nombre producto]`
Muestra el stock de un producto específico.

**Ejemplo**: `stock leche`

**Respuesta**:
```
📦 **Leche**: 15 litros
📋 Pedido: Lácteos
✅ Mínimo: 10 litros
```

#### `pedido [nombre pedido]`
Genera un pedido para un proveedor específico basado en productos con stock bajo.

**Ejemplo**: `pedido Verdulería`

**Respuesta**:
```
📦 Verdulería

Lechuga (7 kg)
Tomate (10 kg)

Total: 2 productos
```

### Comandos de Gestión

#### Modo Ingreso/Egreso
En estos modos, simplemente escribes el nombre del producto y la cantidad:

**Formato**: `[nombre producto] [cantidad]`

**Ejemplos**:
- `leche 20` → Agrega/quita 20 unidades de leche
- `papa 10 kg` → Agrega/quita 10 kg de papa
- `harina 5` → Agrega/quita 5 unidades de harina

**Después de agregar productos**:
- `confirmar` → Aplica todos los cambios
- `cancelar` o `limpiar` → Limpia la lista acumulada

#### Modo Stock
**Formato**: `[nombre producto] [cantidad]`

**Ejemplo**: `leche 15` → Establece el stock de leche en 15 unidades

### Comandos de Productos

#### Crear Producto
**Formato**: `creá un producto [nombre] en [unidad]`

**Ejemplos**:
- `creá un producto Mayonesa en unidades`
- `creá un producto Aceite en litros`

#### Editar Producto
**Formato**: `cambiá el [campo] de [producto] a [valor]`

**Ejemplos**:
- `cambiá el mínimo de tomate a 10`
- `cambiá el nombre de leche a Leche Entera`

#### Eliminar Producto
**Formato**: `eliminá [producto]`

**Ejemplo**: `eliminá mayonesa`

### Comandos de Pedidos

#### Listar Pedidos
**Comando**: `mostrar pedidos` o `listar pedidos`

**Respuesta**:
```
🏪 Tus 3 pedidos/proveedores:
📋 Verdulería: 5 productos
📋 Lácteos: 8 productos
📋 Carnicería: 3 productos
```

#### Ver Pedido
**Formato**: `qué tiene el pedido [nombre]` o `mostrar pedido [nombre]`

**Ejemplo**: `qué tiene el pedido Verdulería`

**Respuesta**:
```
📋 Productos de "Verdulería" (5):
• Tomate: 20 kg
• Lechuga: 3 kg
• Papa: 50 kg
• Zanahoria: 15 kg
• Cebolla: 30 kg
```

#### Generar Pedido
**Comando**: `qué me falta pedir` o `generá lista de pedido`

**Respuesta**:
```
📝 Lista de pedido (3 productos):

📋 Verdulería:
  • Lechuga: pedir 7 kg
  • Tomate: pedir 10 kg

📋 Lácteos:
  • Leche: pedir 5 litros
```

### Comandos de Utilidad

#### Stock Bajo
**Comando**: `stock bajo` o `productos con stock bajo`

**Respuesta**:
```
📉 Productos con stock bajo (2):
⚠️ Lechuga: 3/10 kg
⚠️ Leche: 5/10 litros
```

#### Importar Productos
**Comando**: `importá los productos de pedidos` o `inicializá el stock`

**Respuesta**:
```
✅ Stock inicializado para 10 productos con 0 unidades cada uno.
```

#### Ayuda
**Comando**: `ayuda` o `help`

**Respuesta**:
```
🤖 Puedo ayudarte con:

📦 **Stock**: "saco 2 cajas de tomate", "agregá 5 kg de harina"
➕ **Crear productos**: "creá un producto Mayonesa en unidades"
📊 **Consultas**: "cuánto tengo de queso", "mostrar productos"
🏪 **Pedidos**: "mostrar pedidos", "qué tiene el pedido Verdulería"
📝 **Generar pedido**: "qué me falta pedir", "generá lista de pedido"
🔄 **Importar**: "inicializá el stock con los productos de pedidos"
✏️ **Editar**: "cambiá el mínimo de tomate a 10"

¡Preguntame lo que necesites!
```

---

## Acciones y Respuestas

### Tipos de Acciones

El sistema puede ejecutar las siguientes acciones:

1. **entrada**: Agregar stock a un producto
2. **salida**: Quitar stock de un producto
3. **actualizar_stock**: Establecer un valor específico de stock
4. **consulta_stock**: Consultar stock de un producto
5. **consulta_general**: Preguntas generales
6. **crear_producto**: Crear nuevo producto
7. **editar_producto**: Editar producto existente
8. **eliminar_producto**: Eliminar producto
9. **listar_productos**: Listar todos los productos
10. **listar_pedidos**: Listar pedidos/proveedores
11. **ver_pedido**: Ver productos de un pedido
12. **importar_productos**: Importar productos de pedidos
13. **inicializar_stock**: Inicializar stock
14. **stock_bajo**: Ver productos con stock bajo
15. **generar_pedido**: Generar lista de pedido
16. **ayuda**: Mostrar ayuda
17. **conversacion**: Conversación general

### Confirmación de Acciones

Algunas acciones requieren confirmación antes de ejecutarse:

**Acciones que requieren confirmación**:
- Eliminar productos
- Acciones con baja confianza en el parsing
- Acciones que modifican datos importantes

**Cómo confirmar**:
- `sí`, `sí`, `ok`, `dale`, `confirmo`, `confirmar`
- `no`, `cancelar`, `cancela` para cancelar

### Respuestas del Sistema

El sistema proporciona respuestas claras y estructuradas:

**Éxito**:
```
✅ Agregado: 20 litros de Leche
Stock: 10 → 30 litros
```

**Error**:
```
❌ No podés quitar 50 litros de Leche. Solo tenés 30 litros disponibles.
```

**Información**:
```
📊 Leche: 30 litros (mínimo: 10 litros)
```

**Advertencia**:
```
⚠️ Leche: 5/10 litros
```

---

## Integración con Ollama (IA)

### ¿Qué es Ollama?

Ollama es una herramienta para ejecutar modelos de IA localmente. El chat puede usar Ollama para generar respuestas más inteligentes y naturales.

### ¿Es Obligatorio?

**NO**. El chat funciona perfectamente sin Ollama usando procesamiento básico de lenguaje natural.

### Configuración

#### Opción 1: Ollama Local (Desarrollo)
1. Instala [Ollama](https://ollama.ai/)
2. Descarga un modelo: `ollama pull llama3.2`
3. El sistema detectará automáticamente Ollama en `http://localhost:11434`

#### Opción 2: Ollama Remoto (Producción)
1. Configura Ollama en un servidor
2. Configura la variable de entorno `OLLAMA_URL` en Vercel
3. El sistema se conectará automáticamente

### Modo IA

El chat tiene un interruptor de "Modo IA" que puedes activar/desactivar:

- **Modo IA activado**: Usa Ollama para generar respuestas más inteligentes
- **Modo IA desactivado**: Usa procesamiento básico (más rápido, menos inteligente)

### Ventajas del Modo IA

- Respuestas más naturales y contextuales
- Mejor comprensión de preguntas complejas
- Puede responder preguntas generales (no solo sobre stock)
- Conversación más fluida

### Limitaciones del Modo IA

- Requiere Ollama configurado y funcionando
- Puede ser más lento que el modo básico
- Consume recursos del servidor donde corre Ollama

---

## Ejemplos de Uso

### Escenario 1: Consultar Stock

**Usuario**: `stock`

**Sistema**:
```
📦 **Stock General**

**Verdulería** (5 productos):
✅ Tomate: 20 kg
⚠️ Lechuga: 3 kg
✅ Papa: 50 kg
✅ Zanahoria: 15 kg
✅ Cebolla: 30 kg

**Lácteos** (3 productos):
✅ Leche: 15 litros
✅ Queso: 8 kg
✅ Yogur: 12 unidades

Total: 8 productos
```

### Escenario 2: Agregar Stock (Modo Ingreso)

**Usuario**: `leche 20`
**Sistema**: `✅ Agregado: 20 litros de Leche`

**Usuario**: `queso 5`
**Sistema**: `✅ Agregado: 5 kg de Queso`

**Usuario**: `confirmar`
**Sistema**:
```
📋 **Confirmando 2 productos:**

• 20 litros de Leche
• 5 kg de Queso

Aplicando cambios...

✅ **Cambios aplicados:**

📥 Agregado: 20 litros de Leche
Stock: 15 → 35 litros
📥 Agregado: 5 kg de Queso
Stock: 8 → 13 kg
```

### Escenario 3: Generar Pedido

**Usuario**: `pedido Verdulería`

**Sistema**:
```
📦 Verdulería

Lechuga (7 kg)
Tomate (10 kg)

Total: 2 productos
```

### Escenario 4: Crear Producto

**Usuario**: `creá un producto Mayonesa en unidades`

**Sistema**: `✅ Producto "Mayonesa" creado correctamente (unidad: unidades, stock mínimo: 1)`

### Escenario 5: Consulta Específica

**Usuario**: `¿cuánto tengo de leche?`

**Sistema**: `📊 Leche: 35 litros (mínimo: 10 litros)`

### Escenario 6: Stock Bajo

**Usuario**: `stock bajo`

**Sistema**:
```
📉 Productos con stock bajo (2):
⚠️ Lechuga: 3/10 kg
⚠️ Yogur: 5/10 unidades
```

### Escenario 7: Actualizar Stock Directo (Modo Stock)

**Usuario**: `leche 25`
**Sistema**: `📊 Stock actualizado: Leche\nStock: 35 → 25 litros`

---

## Limitaciones y Consideraciones

### Búsqueda de Productos

El sistema busca productos usando estos métodos (en orden de prioridad):

1. **Coincidencia exacta**: Nombre exacto (ignorando mayúsculas)
2. **Coincidencia parcial**: Todas las palabras del mensaje están en el nombre
3. **Coincidencia por inicio**: Alguna palabra del mensaje está al inicio del nombre

**Ejemplo**: Si tienes un producto "Leche Entera" y escribes "leche", el sistema lo encontrará.

**Si hay múltiples coincidencias**: Elige el producto con el nombre más corto (más específico).

### Validaciones

- **Stock negativo**: No se permite quitar más stock del disponible
- **Cantidades**: Debe especificarse una cantidad válida (número positivo)
- **Productos**: El producto debe existir en el inventario (o crearse primero)

### Filtrado por Pedido

En modos Ingreso/Egreso/Stock, puedes seleccionar un pedido para filtrar productos:
- Solo se mostrarán productos de ese pedido
- Facilita trabajar con productos de un proveedor específico

### Acumulación de Productos

En modos Ingreso/Egreso:
- Los productos se acumulan en una lista
- Puedes agregar múltiples productos antes de confirmar
- Si agregas el mismo producto dos veces, se suman las cantidades
- Escribe "confirmar" para aplicar todos los cambios
- Escribe "cancelar" para limpiar la lista

### Errores Comunes

1. **"No encontré [producto]"**
   - Verifica que el producto exista
   - Intenta escribir el nombre completo
   - Verifica que el producto pertenezca al pedido seleccionado (si aplica)

2. **"Necesito saber la cantidad"**
   - Asegúrate de incluir un número en el mensaje
   - Ejemplo correcto: "leche 20"
   - Ejemplo incorrecto: "agregar leche"

3. **"No podés quitar [cantidad]"**
   - Verifica el stock disponible
   - Agrega stock primero si es necesario

### Rendimiento

- El procesamiento básico es muy rápido (< 100ms)
- Con Ollama puede ser más lento (1-5 segundos dependiendo del servidor)
- Las consultas de stock son instantáneas (datos en memoria)
- Las actualizaciones de stock se guardan en Firebase (puede tomar 100-500ms)

### Offline

- El chat requiere conexión a Internet
- Los datos se sincronizan con Firebase en tiempo real
- Si pierdes conexión, los cambios se guardarán cuando se recupere

---

## Preguntas Frecuentes

### ¿Puedo usar el chat sin Ollama?
Sí, el chat funciona perfectamente sin Ollama usando procesamiento básico.

### ¿Cómo activo el modo IA?
Hay un interruptor en la interfaz del chat para activar/desactivar el modo IA.

### ¿Puedo cancelar una acción?
Sí, si una acción requiere confirmación, puedes escribir "no" o "cancelar".

### ¿Puedo agregar múltiples productos a la vez?
Sí, en modos Ingreso/Egreso puedes agregar varios productos y luego escribir "confirmar".

### ¿Cómo busco un producto si no recuerdo el nombre exacto?
Escribe parte del nombre. El sistema buscará productos que contengan esas palabras.

### ¿Puedo trabajar con productos de un pedido específico?
Sí, selecciona el pedido en el selector superior del chat (en modos Ingreso/Egreso/Stock).

### ¿Qué pasa si escribo mal el nombre de un producto?
El sistema intentará encontrar el producto más similar. Si no lo encuentra, te pedirá que lo escribas de nuevo o que lo crees.

---

## Soporte

Para problemas o preguntas:
- Revisa esta documentación
- Verifica que los productos y pedidos estén correctamente configurados
- Asegúrate de tener conexión a Internet
- Si usas Ollama, verifica que esté funcionando correctamente

---

**Última actualización**: Diciembre 2024

