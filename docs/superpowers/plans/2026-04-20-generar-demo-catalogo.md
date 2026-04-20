# Generar Productos Demo en Catálogo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un botón "Generar demo" en la toolbar del catálogo que crea 10 productos de almacén genérico en paralelo.

**Architecture:** Modificación puntual de `ProductosTable.tsx` — nuevo estado `generandoDemo`, función `generarDemo` que llama `crearProductoCatalogo()` x10 via `Promise.all`, y botón en la toolbar existente.

**Tech Stack:** React, Firebase/Firestore, lucide-react (Wand2 icon)

---

### Task 1: Agregar botón y lógica de generación demo

**Files:**
- Modify: `components/catalogo/ProductosTable.tsx`

- [ ] **Step 1: Agregar el import del ícono Wand2**

En la línea 22 de `components/catalogo/ProductosTable.tsx`, cambiar:

```tsx
import { Download, Loader2, Pencil, Plus, Upload } from "lucide-react"
```

por:

```tsx
import { Download, Loader2, Pencil, Plus, Upload, Wand2 } from "lucide-react"
```

- [ ] **Step 2: Agregar estado `generandoDemo`**

Después de la línea que declara `importandoMasivo` (buscar `const [importandoMasivo, setImportandoMasivo] = useState(false)`), agregar:

```tsx
const [generandoDemo, setGenerandoDemo] = useState(false)
```

- [ ] **Step 3: Agregar la función `generarDemo`**

Después de la función `crearProducto` (buscar el cierre de esa función, alrededor de la línea 107), agregar:

```tsx
const DEMO_PRODUCTS = [
  { nombre: "Arroz", unidad: "kg" },
  { nombre: "Aceite", unidad: "L" },
  { nombre: "Harina", unidad: "kg" },
  { nombre: "Azúcar", unidad: "kg" },
  { nombre: "Sal", unidad: "kg" },
  { nombre: "Fideos", unidad: "kg" },
  { nombre: "Yerba", unidad: "kg" },
  { nombre: "Café", unidad: "kg" },
  { nombre: "Leche", unidad: "L" },
  { nombre: "Galletitas", unidad: "u" },
]

const generarDemo = async () => {
  setGenerandoDemo(true)
  try {
    await Promise.all(
      DEMO_PRODUCTS.map((p) =>
        crearProductoCatalogo({
          ownerId,
          nombre: p.nombre,
          unidad: p.unidad,
          pedidoId: "",
          stockMinimo: 0,
          user: { uid: userId },
        })
      )
    )
    toast({ title: "10 productos de demo creados" })
  } catch (e) {
    toast({
      title: "Error",
      description: e instanceof Error ? e.message : "No se pudo generar",
      variant: "destructive",
    })
  } finally {
    setGenerandoDemo(false)
  }
}
```

- [ ] **Step 4: Agregar el botón en la toolbar**

Buscar en el JSX el bloque de botones de importar/exportar (alrededor de línea 362):

```tsx
<Button variant="outline" onClick={() => xlsxInputRef.current?.click()}>
  <Upload className="mr-1 h-4 w-4" />
  Importar .xlsx
</Button>
```

Agregar el botón de demo ANTES de ese botón:

```tsx
<Button variant="outline" onClick={() => void generarDemo()} disabled={generandoDemo}>
  {generandoDemo ? (
    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
  ) : (
    <Wand2 className="mr-1 h-4 w-4" />
  )}
  Generar demo
</Button>
```

- [ ] **Step 5: Verificar que compila sin errores**

```bash
cd "C:/Users/User/Desktop/horarios simple" && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/User/Desktop/horarios simple" && git add components/catalogo/ProductosTable.tsx && git commit -m "feat: boton generar demo en catalogo"
```
