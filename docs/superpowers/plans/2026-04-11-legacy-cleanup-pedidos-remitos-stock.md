# Legacy Cleanup — Pedidos / Remitos / Stock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead files, a zombie stock Provider, and the last client write to the legacy `stock_movimientos` collection, so the project stops carrying half-finished refactors from the pedidos/remitos/stock subsystems.

**Architecture:** Pure subtractive cleanup — no new abstractions, no new providers. The only code change (as opposed to a deletion) is stripping the movement-log write from `src/services/stock/movimientosService.ts`; the stock-value update it already does against `stock_ubicaciones` stays untouched.

**Tech Stack:** Next.js 14 app router, TypeScript, Firebase/Firestore, pnpm.

**Spec:** `docs/superpowers/specs/2026-04-11-legacy-cleanup-pedidos-remitos-stock-design.md`

**Project root for all commands:** `C:\Users\User\Desktop\horarios simple` (bash uses `/c/Users/User/Desktop/horarios simple`).

**Global conventions:**
- Before starting each task, verify `git status` is clean (previous task's commit made it that way).
- After any task that touches `.ts`/`.tsx` files, run `pnpm exec tsc --noEmit` and expect zero errors before committing. (`tsc` is a devDep, not a package.json script — `pnpm exec` runs it from `node_modules/.bin`.)
- If a task fails partway, do NOT `--amend` — the spec says create a new commit after fixing.
- Commit messages use present-tense imperative: `chore(cleanup): delete dead pedidos service`.

---

### Task 1: Delete dead pedidos service chain

**Files:**
- Delete: `src/services/pedidos/pedidosService.ts`
- Delete: `src/domain/pedidos/stockOperations.ts`
- Delete: `src/domain/pedidos/pedidoState.ts`
- Delete: `src/domain/pedidos/calcularPedido.ts`

**Context:** `pedidosService.ts` has zero inbound imports (verified by grep on 2026-04-11). It imports `aplicarRecepcionAStock` from `stockOperations.ts` and `transicionarEstadoPedido` from `pedidoState.ts`, both of which are used nowhere else. `calcularPedido.ts` was already an orphan independent of this chain. `prepararRecepcion.ts` is NOT dead — it's still used by `components/pedidos/recepcion-form.tsx` — do not touch it.

- [ ] **Step 1: Re-verify nothing imports these before deleting**

Run from project root:
```bash
grep -rn "pedidosService\|stockOperations\|pedidoState\b\|calcularPedido" \
  --include="*.ts" --include="*.tsx" \
  app components contexts hooks lib src
```

Expected: the only matches are internal — `pedidosService.ts` importing from the other three, and the files defining them. If any application file outside `src/services/pedidos/` and `src/domain/pedidos/` matches, STOP and investigate before deleting.

- [ ] **Step 2: Delete the four files**

```bash
cd "/c/Users/User/Desktop/horarios simple"
rm src/services/pedidos/pedidosService.ts
rm src/domain/pedidos/stockOperations.ts
rm src/domain/pedidos/pedidoState.ts
rm src/domain/pedidos/calcularPedido.ts
```

- [ ] **Step 3: Clean up empty directory if applicable**

```bash
cd "/c/Users/User/Desktop/horarios simple"
rmdir src/services/pedidos 2>/dev/null || true
# Only rmdir if empty; the `|| true` keeps the task from failing if it's not.
```

- [ ] **Step 4: Typecheck**

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm exec tsc --noEmit
```

Expected: zero errors. If there are errors, they point to a file that imported one of the deleted symbols that Step 1's grep missed (e.g., a dynamic import or a path alias grep didn't catch). Restore the file the importer actually needs, investigate why the grep missed it, and re-run Step 1 more carefully.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/User/Desktop/horarios simple"
git add -u src/services src/domain/pedidos
git commit -m "$(cat <<'EOF'
chore(cleanup): delete dead pedidos service chain

pedidosService.ts had zero inbound imports; its only imports
(stockOperations, pedidoState, plus the orphan calcularPedido)
are now deleted as well. prepararRecepcion stays — still used
by components/pedidos/recepcion-form.tsx.
EOF
)"
```

---

### Task 2: Delete `lib/remito-enlace-publico.ts`

**Files:**
- Delete: `lib/remito-enlace-publico.ts`

**Context:** Confirmed orphan. It contains helpers that write to the legacy `apps/horarios/remitos` collection, and nothing imports it.

- [ ] **Step 1: Re-verify no imports**

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -rn "remito-enlace-publico" \
  --include="*.ts" --include="*.tsx" \
  app components contexts hooks lib src
```

Expected: only the file itself matches. If anything else matches, STOP.

- [ ] **Step 2: Delete**

```bash
cd "/c/Users/User/Desktop/horarios simple"
rm lib/remito-enlace-publico.ts
```

- [ ] **Step 3: Typecheck**

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/User/Desktop/horarios simple"
git add -u lib/remito-enlace-publico.ts
git commit -m "chore(cleanup): delete orphan lib/remito-enlace-publico.ts"
```

---

### Task 3: Delete legacy `docs_v2` remito docs

**Files:**
- Delete: `docs/docs_v2/ESQUEMA_REMITOS.md`
- Delete: `docs/docs_v2/ARQUITECTURA_REMITOS.md`
- Delete: `docs/docs_v2/FLUJO_REMITOS_BLINDADO.md`
- Delete: `docs/docs_v2/ESTRUCTURA_REMITOS.md`

**Context:** Docs-only; no code referenced them. No typecheck needed.

- [ ] **Step 1: Verify files exist**

```bash
cd "/c/Users/User/Desktop/horarios simple"
ls docs/docs_v2/ESQUEMA_REMITOS.md \
   docs/docs_v2/ARQUITECTURA_REMITOS.md \
   docs/docs_v2/FLUJO_REMITOS_BLINDADO.md \
   docs/docs_v2/ESTRUCTURA_REMITOS.md
```

If any are already missing (someone deleted them between audit and execution), note which and skip those in Step 2.

- [ ] **Step 2: Delete**

```bash
cd "/c/Users/User/Desktop/horarios simple"
rm docs/docs_v2/ESQUEMA_REMITOS.md
rm docs/docs_v2/ARQUITECTURA_REMITOS.md
rm docs/docs_v2/FLUJO_REMITOS_BLINDADO.md
rm docs/docs_v2/ESTRUCTURA_REMITOS.md
```

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/User/Desktop/horarios simple"
git add -u docs/docs_v2
git commit -m "chore(cleanup): delete obsolete legacy remito docs"
```

---

### Task 4: Unwrap `StockProvider` from `app/dashboard/layout.tsx`

**Files:**
- Modify: `app/dashboard/layout.tsx`

**Context:** `StockProvider` is a zombie. It subscribes to three Firestore collections but `useStock()` has zero consumers across the repo. We remove the wrapper *before* deleting the file so `tsc` has the chance to catch any consumer we missed.

The layout currently looks like this at lines 64–72:

```tsx
  return (
    <DataProvider user={user}>
      <StockProvider user={user}>
        <ProtectedRoute user={user} pathname={pathname} router={router}>
          {children}
        </ProtectedRoute>
      </StockProvider>
    </DataProvider>
  )
```

And the import on line 8:

```tsx
import { StockProvider } from "@/contexts/stock-context"
```

- [ ] **Step 1: Remove the import**

Edit `app/dashboard/layout.tsx`, delete line 8 (`import { StockProvider } from "@/contexts/stock-context"`). Do not renumber or touch any other imports.

- [ ] **Step 2: Unwrap the JSX**

Replace lines 64–72 with:

```tsx
  return (
    <DataProvider user={user}>
      <ProtectedRoute user={user} pathname={pathname} router={router}>
        {children}
      </ProtectedRoute>
    </DataProvider>
  )
```

(One less level of indentation on `ProtectedRoute` and `{children}`, and `<StockProvider>` / `</StockProvider>` gone.)

- [ ] **Step 3: Typecheck**

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm exec tsc --noEmit
```

Expected: zero errors. If `tsc` complains about `useStock` being used somewhere, that means the grep missed a consumer. DO NOT proceed — investigate the failing file and either migrate it or restore the wrapper and add it to the plan as a new task.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/User/Desktop/horarios simple"
git add -u app/dashboard/layout.tsx
git commit -m "chore(cleanup): unwrap zombie StockProvider from dashboard layout"
```

---

### Task 5: Delete `contexts/stock-context.tsx`

**Files:**
- Delete: `contexts/stock-context.tsx`

**Context:** Now that the provider is unwrapped, nothing imports the file. Confirmed on 2026-04-11 that `useStock(` and `useStockChatContext` have zero application-code consumers.

- [ ] **Step 1: Re-verify**

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -rn "stock-context\|useStock(\|useStockChatContext\|StockProvider" \
  --include="*.ts" --include="*.tsx" \
  app components contexts hooks lib src
```

Expected: only matches in `contexts/stock-context.tsx` itself (its own self-definition). No match in `app/` after Task 4. If there are hits elsewhere, STOP.

- [ ] **Step 2: Delete**

```bash
cd "/c/Users/User/Desktop/horarios simple"
rm contexts/stock-context.tsx
```

- [ ] **Step 3: Typecheck**

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/User/Desktop/horarios simple"
git add -u contexts/stock-context.tsx
git commit -m "chore(cleanup): delete zombie contexts/stock-context.tsx"
```

---

### Task 6: Delete orphan `components/stock/stock-sidebar.tsx` and barrel

**Files:**
- Delete: `components/stock/stock-sidebar.tsx`
- Delete: `components/stock/index.ts`

**Context:** Discovered during the 2026-04-11 audit. `StockSidebar` is exported from `components/stock/index.ts` but nothing in the repo imports it (grep found zero callers of `StockSidebar` or `@/components/stock`). It depends on the `StockMovimiento` type from `lib/types.ts` — that dependency goes away with this deletion.

- [ ] **Step 1: Re-verify no imports**

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -rn "StockSidebar\|from [\"']@/components/stock[\"']\|from [\"']\./components/stock[\"']" \
  --include="*.ts" --include="*.tsx" \
  app components contexts hooks lib src
```

Expected: only matches in `components/stock/stock-sidebar.tsx` (self-definition) and `components/stock/index.ts` (the barrel that re-exports it). If anything else matches, STOP — this component is not orphaned; remove it from this task and note the importer for future work.

- [ ] **Step 2: Delete**

```bash
cd "/c/Users/User/Desktop/horarios simple"
rm components/stock/stock-sidebar.tsx
rm components/stock/index.ts
rmdir components/stock 2>/dev/null || true
```

- [ ] **Step 3: Typecheck**

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/User/Desktop/horarios simple"
git add -u components/stock
git commit -m "chore(cleanup): delete orphan components/stock/stock-sidebar"
```

---

### Task 7: Strip audit-log write from `movimientosService.ts`

**Files:**
- Modify: `src/services/stock/movimientosService.ts`
- Modify: `src/domain/stock/types.ts`

**Context:** `confirmarMovimientos` does two things inside its transaction: (1) update `stock_ubicaciones` docs (keep this), and (2) write an entry to the legacy `COLLECTIONS.STOCK_MOVIMIENTOS` collection (remove this). The caller `hooks/use-stock-console.ts` only inspects `result.ok` and `result.error` on the response — it does not read `result.movimientos` or `result.stockActualizado` (verified by reading lines 689–731 of that file on 2026-04-11). So the success shape can collapse to `{ ok: true }`.

The current `ConfirmarMovimientoResult` type at `src/domain/stock/types.ts:33-40`:

```ts
export type ConfirmarMovimientoResult = {
  ok: true
  movimientos: MovimientoStock[]
  stockActualizado: Record<string, number>
} | {
  ok: false
  error: string
}
```

- [ ] **Step 1: Simplify the result type**

Edit `src/domain/stock/types.ts`. Replace the `ConfirmarMovimientoResult` definition with:

```ts
export type ConfirmarMovimientoResult =
  | { ok: true }
  | { ok: false; error: string }
```

Also remove the now-unused `MovimientoStock` type export *only if* nothing else uses it. Verify first:

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -rn "MovimientoStock\b" \
  --include="*.ts" --include="*.tsx" \
  app components contexts hooks lib src \
  | grep -v "src/domain/stock/types.ts" \
  | grep -v "src/services/stock/movimientosService.ts"
```

If the grep shows zero results, delete the `MovimientoStock` type definition too (lines 3–16 of `types.ts`). If it shows any results, leave the type alone — it's used elsewhere.

- [ ] **Step 2: Strip the audit-log write from `movimientosService.ts`**

The current `confirmarMovimientos` function (in `src/services/stock/movimientosService.ts`) builds up `movimientosGuardados` and `stockActualizado`, and on line ~113 does `transaction.set(movimientoRef, ...)` to write to `COLLECTIONS.STOCK_MOVIMIENTOS`. Replace the entire file body (from line 1 to the end) with this:

```ts
import {
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { stockUbicacionRef } from "@/lib/stock-ubicaciones-service"
import type {
  MovimientoInput,
  ConfirmarMovimientoResult,
  MovimientoStockTipo,
} from "@/src/domain/stock/types"

/**
 * Valida que un egreso no genere stock negativo
 */
function validarStockNegativo(
  stockActual: number,
  cantidad: number,
  tipo: MovimientoStockTipo
): { ok: true } | { ok: false; error: string } {
  if (tipo === "EGRESO" && stockActual < cantidad) {
    return {
      ok: false,
      error: `Stock insuficiente. Actual: ${stockActual}, requerido: ${cantidad}`,
    }
  }
  return { ok: true }
}

/**
 * Confirma múltiples movimientos de stock en una transacción.
 * Actualiza stock_ubicaciones atómicamente. No escribe audit log
 * del lado del cliente: el v2 backend es quien produce
 * stock_movements_v2 cuando corresponda.
 */
export async function confirmarMovimientos(
  movimientos: MovimientoInput[],
  ownerId: string,
  userId: string,
  locationId: string
): Promise<ConfirmarMovimientoResult> {
  if (!db) {
    return { ok: false, error: "Firestore no está inicializado" }
  }

  if (!locationId) {
    return {
      ok: false,
      error: "Falta la ubicación (locationId) para actualizar el stock",
    }
  }

  const firestore = db

  try {
    await runTransaction(firestore, async (transaction) => {
      const stockRefs = movimientos.map((m) =>
        stockUbicacionRef(firestore, ownerId, m.productoId, locationId)
      )
      const stockDocs = await Promise.all(
        stockRefs.map((ref) => transaction.get(ref))
      )

      const filas = stockDocs.map((snap, index) => {
        if (!snap.exists()) {
          throw new Error(
            `Producto ${movimientos[index].productoId} sin stock en esta ubicación. Activá el producto en «Mi stock».`
          )
        }
        const data = snap.data()
        const stockActual = Math.max(0, Math.floor(Number(data.stockActual) || 0))
        return { ref: snap.ref, stockActual, movimiento: movimientos[index] }
      })

      for (const { stockActual, movimiento } of filas) {
        const validacion = validarStockNegativo(
          stockActual,
          movimiento.cantidad,
          movimiento.tipo
        )
        if (!validacion.ok) {
          throw new Error(validacion.error)
        }
      }

      for (const { ref, stockActual, movimiento } of filas) {
        const nuevoStock =
          movimiento.tipo === "INGRESO"
            ? stockActual + movimiento.cantidad
            : stockActual - movimiento.cantidad

        transaction.update(ref, {
          stockActual: nuevoStock,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        })
      }
    })

    return { ok: true }
  } catch (error: any) {
    console.error("Error en confirmarMovimientos:", error)
    return {
      ok: false,
      error: error.message || "Error al procesar movimientos",
    }
  }
}
```

Notes on what changed:
- Removed `collection`, `doc`, `addDoc` from the Firestore imports — no longer needed.
- Removed `COLLECTIONS` import — no collection name is referenced anymore.
- Removed `MovimientoStock` from the type import (if you removed the type in Step 1; if you kept it, you can still remove this import since the function no longer constructs one).
- Removed the `getMovimientosHistorial` stub at the bottom of the old file (it always returned `[]` and nothing calls it — verified by grep).
- The function body no longer builds `movimientosGuardados` / `stockActualizado` and no longer writes to `STOCK_MOVIMIENTOS`.
- The success return collapses to `{ ok: true }` to match the new type.

- [ ] **Step 3: Verify no other caller depends on the dropped fields**

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -rn "confirmarMovimientos\b\|confirmarMovimientosService\b" \
  --include="*.ts" --include="*.tsx" \
  app components contexts hooks lib src
```

Inspect each hit (there should be a handful in `hooks/use-stock-console.ts` and `components/stock-console-content.tsx`). Confirm that no caller reads `result.movimientos`, `result.stockActualizado`, or calls `getMovimientosHistorial`. If any caller DOES read those, STOP and update that caller as part of this task — do not leave a broken reference.

- [ ] **Step 4: Typecheck**

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm exec tsc --noEmit
```

Expected: zero errors. If there are errors, they're about unused imports or callers reading removed fields. Fix them (remove unused imports from callers; drop destructures of removed fields) before committing.

- [ ] **Step 5: Run the existing stock domain tests**

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm run test:stock
```

Expected: the script compiles via `tsconfig.stock-tests.json` into `.codex-test/` and then runs `node .codex-test/tests/stock-domain.test.js`. It should pass. If compilation fails due to a type change, the error will point at the exact file — fix it before committing. The test runner only pulls in `lib/unidades-utils.ts`, `lib/pedido-engine.ts`, `lib/build-pedido-oficial.ts`, `lib/types.ts`, and `lib/stock-status.ts` (per `tsconfig.stock-tests.json`), none of which this plan touches, so a failure here would be unexpected.

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/User/Desktop/horarios simple"
git add -u src/services/stock/movimientosService.ts src/domain/stock/types.ts
git commit -m "$(cat <<'EOF'
chore(cleanup): stop writing to legacy stock_movimientos

confirmarMovimientos now only updates stock_ubicaciones inside its
transaction. The client-side audit log has been removed; stock_movements_v2
is produced by the v2 backend instead. ConfirmarMovimientoResult collapses
to { ok } / { ok: false, error } since no caller read the dropped fields.
EOF
)"
```

---

### Task 8: Remove `STOCK_MOVIMIENTOS` from `lib/firebase.ts` COLLECTIONS

**Files:**
- Modify: `lib/firebase.ts`

**Context:** After Task 7, nothing references `COLLECTIONS.STOCK_MOVIMIENTOS`. The `STOCK_MOVEMENTS` entry at line 92 is a different collection name (`stock_movements`, not `stock_movimientos`) — do not touch it; it may still be used.

- [ ] **Step 1: Verify STOCK_MOVIMIENTOS is unused**

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -rn "STOCK_MOVIMIENTOS\b\|stock_movimientos" \
  --include="*.ts" --include="*.tsx" \
  app components contexts hooks lib src
```

Expected: only one match — the definition in `lib/firebase.ts` itself. If anything else matches, STOP — there's still a reader/writer that Task 7 missed.

- [ ] **Step 2: Remove the line**

Edit `lib/firebase.ts`. Delete this line (currently line 77):

```ts
  STOCK_MOVIMIENTOS: getCollectionPath("stock_movimientos"),
```

Leave `STOCK_MOVEMENTS` (different name, at line 92) intact.

- [ ] **Step 3: Typecheck**

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/User/Desktop/horarios simple"
git add -u lib/firebase.ts
git commit -m "chore(cleanup): drop STOCK_MOVIMIENTOS from COLLECTIONS"
```

---

### Task 9: Drop legacy blocks from `firestore.rules`

**Files:**
- Modify: `firestore.rules`

**Context:** `firebase.json` points at `firestore.rules` at the project root. Two blocks need to go: `stock_actual` (around lines 311–324) and `stock_movimientos` (around lines 326–339). Leave the `/rules/firestore.rules` and `/rules/horarios.rules` files alone — they're not the active rules per `firebase.json`.

- [ ] **Step 1: Identify exact line ranges**

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -n "stock_actual\|stock_movimientos" firestore.rules
```

Expected output includes at least two line numbers matching the block headers (one per collection). Note them.

- [ ] **Step 2: Delete the stock_actual block**

Find and delete the contiguous block that looks like this (section header + match block):

```
/* ===============================
   STOCK ACTUAL
   =============================== */

match /apps/horarios/stock_actual/{docId} {
  allow read: if true;

  allow create: if horariosCanActFor(request.resource.data.ownerId);
  allow update, delete: if horariosCanActFor(
    resource.data.ownerId != null
      ? resource.data.ownerId
      : request.resource.data.ownerId
  );
}
```

Preserve indentation of surrounding blocks. If the section header comment belongs to this block only, delete the comment too.

- [ ] **Step 3: Delete the stock_movimientos block**

Similarly, delete the contiguous block matching:

```
/* ===============================
   STOCK MOVIMIENTOS
   =============================== */

match /apps/horarios/stock_movimientos/{docId} {
  allow read: if true;

  allow create: if horariosCanActFor(request.resource.data.ownerId);
  allow update, delete: if horariosCanActFor(
    resource.data.ownerId != null
      ? resource.data.ownerId
      : request.resource.data.ownerId
  );
}
```

- [ ] **Step 4: Verify the file is still structurally valid**

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -c "^[[:space:]]*match " firestore.rules
grep -c "^[[:space:]]*}" firestore.rules
```

Brace counts should still balance. If they don't, you deleted too much or too little — recover from git and redo the deletion more carefully.

- [ ] **Step 5: Confirm references are gone**

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -n "stock_actual\|stock_movimientos" firestore.rules
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/User/Desktop/horarios simple"
git add -u firestore.rules
git commit -m "chore(cleanup): drop stock_actual and stock_movimientos rules"
```

---

### Task 10: Final verification

**Files:** None modified. This task runs checks across the repo to confirm the cleanup is complete.

**Context:** Every prior task has its own typecheck + commit; this task is the global sanity check called out in Phase 4 of the spec.

- [ ] **Step 1: Final typecheck**

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Run stock domain tests**

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm run test:stock 2>&1 | tail -40
```

Expected: the `test:stock` script passes (same script as Task 7 Step 5). It's the only test command wired up in `package.json` for this repo.

- [ ] **Step 3: Grep checks — no legacy references remain**

Run these one at a time and expect **no hits in application code** (hits in `docs/`, `AUDITORIA_SISTEMA_PEDIDOS.md`, `.codex-test/`, or `rules/` sub-directory files are fine — they're historical / inactive):

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -rn "stock_movimientos\|STOCK_MOVIMIENTOS" \
  --include="*.ts" --include="*.tsx" \
  app components contexts hooks lib src
```

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -rn "stock_actual" firestore.rules
```

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -rn "remito-enlace-publico\|pedidosService\|pedidoState\b\|stockOperations\b" \
  --include="*.ts" --include="*.tsx" \
  app components contexts hooks lib src
```

```bash
cd "/c/Users/User/Desktop/horarios simple"
grep -rn "stock-context\|useStockChatContext\|StockProvider" \
  --include="*.ts" --include="*.tsx" \
  app components contexts hooks lib src
```

All four greps should return zero hits (or hits only in comments/docs that got indexed, which the include filter should exclude).

Note: `calcularPedido` may still appear as a substring in the unrelated `lib/pedido-engine.ts` / `lib/unidades-utils.ts` files (e.g., `calcularPedidoSugerido`, `calcularPedidoBaseEnPacks`). That is NOT the legacy `calcularPedido.ts` we deleted — those are different functions in a different module. If the grep returns only those matches, that's fine.

- [ ] **Step 4: Dev server smoke test**

Start the dev server in a second terminal:

```bash
cd "/c/Users/User/Desktop/horarios simple"
pnpm dev
```

Wait for it to report "ready". Then manually check in a browser:
1. `/dashboard` loads without a runtime error in the DevTools console.
2. `/dashboard/mi-stock` renders the stock table.
3. `/dashboard/stock-console` renders. Enter a small stock adjustment (e.g., +1 on any active product), click confirm, and verify the toast says "Movimientos confirmados". Reload the page and verify the new quantity persists.
4. DevTools → Network tab: confirm no request attempts to write to `apps/horarios/stock_movimientos` during step 3. (The only stock-related writes should be to `stock_ubicaciones`.)

Stop the dev server (Ctrl+C).

- [ ] **Step 5: Summary commit (optional — only if any docs were touched in this task)**

If Step 3 turned up hits that required follow-up edits to a doc file, commit those changes now:

```bash
cd "/c/Users/User/Desktop/horarios simple"
git status
# if there are uncommitted changes:
git add -u
git commit -m "chore(cleanup): final cleanup touch-ups"
```

If there are no changes, skip this step.

- [ ] **Step 6: Report**

Summarize in the response to the user:
- Number of commits created in this plan (should be 8–9, depending on whether Task 10 Step 5 produced one).
- Confirm each of the spec's Success Criteria is met (point-by-point).
- Flag any deviations from the plan and why.

---

## Spec coverage check

Each spec Success Criterion, mapped to the task that satisfies it:

| Spec requirement | Task |
|---|---|
| Phase 1 files deleted | Tasks 1, 2, 3 |
| `contexts/stock-context.tsx` gone | Task 5 |
| `StockProvider` no longer wraps dashboard layout | Task 4 |
| `movimientosService.ts` no longer writes to `stock_movimientos` | Task 7 |
| `lib/firebase.ts` COLLECTIONS no longer has `STOCK_MOVIMIENTOS` | Task 8 |
| `firestore.rules` has no `stock_movimientos`/`stock_actual` blocks | Task 9 |
| Phase 4 verification passes | Task 10 |

Orphans discovered during plan writing and added beyond the strict spec text:
- `components/stock/stock-sidebar.tsx` + `components/stock/index.ts` (Task 6). These are clearly part of the same zombie system (they consume the `StockMovimiento` type from `lib/types.ts`) and leaving them would undermine the stated goal of "sistema de stock unificado en una sola fuente". If the user wants to leave them in, skip Task 6 — the rest of the plan still works.
