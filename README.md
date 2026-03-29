# Horarios Simple

Aplicacion web para gestionar horarios y operacion diaria en un solo lugar: horarios, stock, pedidos, remitos, tareas y acceso PWA.

## Funcionalidades principales
- Horarios semanales y mensuales con turnos configurables (incluye turnos cortados en dos franjas)
- Franco y medio franco como estados de dia, con medios turnos configurables
- Calculo de horas extra en base a horario real vs turno base
- Validaciones de solapamiento, cruce de medianoche y descanso
- Separadores para agrupar personal con nombre y color

## Horarios y publicacion
- Publicacion de semana y estado visible de semana publicada vs visualizada
- Pagina publica /horario/{ownerId} sin login y compartible
- PWA para ver el horario publicado con nombre de empresa

## Stock y pedidos
- Pedidos/proveedores con productos, unidades o packs
- Stock actual por producto con movimientos de entrada y salida
- Stock minimo y calculo de cantidad a pedir
- Ajustes manuales a la cantidad sugerida
- Importacion de productos
- Enlaces publicos de pedidos

## Remitos y recepciones
- Generacion de remitos desde pedidos
- Firma digital de remitos por fabrica y sucursal
- Recepcion con cantidades recibidas, devoluciones y observaciones
- Estados de pedido: creado, processing, enviado, recibido, completado

## Chat de stock
- Chat en lenguaje natural para consultar, ingresar o egresar stock
- Funciona sin IA y con IA opcional (Ollama)
- Modos: pregunta, ingreso, egreso, stock
- Confirmacion y acumulacion de productos antes de aplicar cambios

## Tareas
- Calendario semanal fijo con turnos de manana y tarde
- Tareas diarias, semanales y especificas
- Creacion rapida desde celda y edicion completa
- Asignacion de empleados y estado activo/inactivo

## Roles y grupos
- Roles: admin, manager, factory, branch, invited
- Grupos para organizar sucursales y fabricas
- Panel de fabrica para procesar pedidos y remitos
- Links de registro por rol

## Exportaciones
- Exportar horarios como imagen
- Exportar PDF semanal y mensual
- Exportar Excel respetando orden y separadores

## PWA
- Instalable en celular y desktop
- Acceso rapido al horario publicado
