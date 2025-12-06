export interface Empleado {
  id: string
  name: string
  email?: string
  phone?: string
  userId: string
  createdAt?: any
  updatedAt?: any
}

export interface Turno {
  id: string
  name: string
  startTime?: string // formato "HH:mm" - Primera franja horaria
  endTime?: string // formato "HH:mm" - Primera franja horaria
  startTime2?: string // formato "HH:mm" - Segunda franja horaria (turno cortado)
  endTime2?: string // formato "HH:mm" - Segunda franja horaria (turno cortado)
  color: string // código hex
  userId: string
  createdAt?: any
  updatedAt?: any
}

// Asignación de turno con horarios ajustados opcionales
export interface ShiftAssignment {
  shiftId?: string // Opcional para franco/medio_franco
  type?: "shift" | "franco" | "medio_franco" // Tipo de asignación (por defecto "shift")
  startTime?: string // horario ajustado (opcional, si no existe usa el del turno base)
  endTime?: string // horario ajustado (opcional)
  startTime2?: string // segunda franja ajustada (opcional)
  endTime2?: string // segunda franja ajustada (opcional)
}

// Tipo que soporta tanto formato antiguo (string[]) como nuevo (ShiftAssignment[])
export type ShiftAssignmentValue = string[] | ShiftAssignment[]

export interface Horario {
  id: string
  nombre: string
  weekStart: string // formato "yyyy-MM-dd"
  semanaInicio: string
  semanaFin: string
  assignments: {
    [date: string]: {
      [empleadoId: string]: ShiftAssignmentValue // array de IDs (string[]) o asignaciones con horarios ajustados (ShiftAssignment[])
    }
  }
  completada?: boolean // Indica si la semana fue marcada como finalizada
  completadaPor?: string // ID del usuario que marcó como completada
  completadaPorNombre?: string // Nombre del usuario que marcó como completada
  completadaEn?: any // Timestamp de cuando fue marcada como completada
  // Snapshot de empleados cuando se completó (para mantener historial incluso si se eliminan empleados)
  empleadosSnapshot?: Array<{
    id: string
    name: string
    email?: string
    phone?: string
  }>
  ordenEmpleadosSnapshot?: string[] // Orden de empleados cuando se completó
  createdAt?: any
  updatedAt?: any
  createdBy?: string
  createdByName?: string
  modifiedBy?: string
  modifiedByName?: string
}

export interface HistorialItem {
  id: string
  horarioId: string
  nombre: string
  semanaInicio: string
  semanaFin: string
  weekStart?: string
  assignments: {
    [date: string]: {
      [empleadoId: string]: ShiftAssignmentValue // array de IDs (string[]) o asignaciones con horarios ajustados (ShiftAssignment[])
    }
  }
  createdAt?: any
  createdBy?: string
  createdByName?: string
  accion: "creado" | "modificado"
  versionAnterior?: boolean
}

export interface ShiftOverlap {
  employeeId: string
  date: string
  shifts: string[] // IDs de turnos que se solapan
  message: string
}

export interface MedioTurno {
  id: string // ID único para identificar el medio turno
  startTime: string // formato "HH:mm"
  endTime: string // formato "HH:mm"
  nombre?: string // Nombre opcional para identificar el medio turno (ej: "Mañana", "Tarde")
  color?: string // código hex para el color del medio franco (por defecto verde)
}

export interface Separador {
  id: string // ID único para identificar el separador
  nombre: string // Nombre del separador (ej: "SALÓN", "COCINA", "BACHA")
  tipo: "puesto" | "personalizado" // Tipo de separador
  color?: string // código hex para el color del separador (opcional)
  createdAt?: any
  updatedAt?: any
}

export interface Pedido {
  id: string
  nombre: string // Nombre del pedido (ej: "Proveedor Bebidas")
  stockMinimoDefault: number // Stock mínimo por defecto para nuevos productos
  formatoSalida: string // Formato personalizable con placeholders: {nombre}, {cantidad}, {unidad}
  mensajePrevio?: string // Mensaje que aparece al inicio del pedido (ej: "Pedido de insumos para fábrica:")
  userId: string
  createdAt?: any
  updatedAt?: any
}

export interface Producto {
  id: string
  pedidoId: string // ID del pedido al que pertenece
  nombre: string
  stockMinimo: number // Stock mínimo configurado por el usuario
  unidad?: string // Unidad de medida (ej: "kg", "unidades", "cajas")
  orden?: number // Orden de visualización (para mantener el orden de importación y permitir reordenar)
  userId: string
  createdAt?: any
  updatedAt?: any
}

export interface Configuracion {
  id?: string
  nombreEmpresa?: string // Nombre de la empresa
  colorEmpresa?: string // Color de fondo de la celda del nombre de empresa (hex)
  mesInicioDia: number // Día del mes en que empieza (1-28)
  horasMaximasPorDia: number // Horas máximas por día
  semanaInicioDia: number // Día de la semana que inicia (0=domingo, 1=lunes, etc.)
  mostrarFinesDeSemana: boolean
  formatoHora24: boolean
  minutosDescanso: number // Minutos de descanso que se restan (por defecto 30)
  horasMinimasParaDescanso: number // Horas mínimas para aplicar descanso (por defecto 6)
  mediosTurnos?: MedioTurno[] // Medios turnos predefinidos para 1/2 franco
  separadores?: Separador[] // Separadores para organizar empleados
  ordenEmpleados?: string[] // Orden personalizado: puede incluir IDs de empleados o IDs de separadores
  fixedSchedules?: Array<{ 
    employeeId: string
    dayOfWeek: number
    assignments?: ShiftAssignment[] // Asignaciones guardadas cuando se marcó como fijo (opcional)
  }> // Horarios marcados manualmente como fijos (día de semana: 0=domingo, 1=lunes, etc.)
  createdAt?: any
  updatedAt?: any
  updatedBy?: string
  updatedByName?: string
}

// ==================== STOCK ====================

export interface StockMovimiento {
  id: string
  productoId: string
  productoNombre?: string // Nombre del producto (para historial)
  tipo: "entrada" | "salida"
  cantidad: number
  unidad?: string
  motivo?: string // Motivo o descripción del movimiento
  userId: string
  userName?: string
  pedidoId?: string // ID del pedido al que pertenece el producto
  createdAt?: any
}

export interface StockActual {
  id: string
  productoId: string
  pedidoId: string // ID del pedido al que pertenece
  cantidad: number
  ultimaActualizacion: any
  userId: string
}

// Tipos para el chat de stock
export interface ChatMessage {
  id: string
  tipo: "usuario" | "sistema" | "error" | "confirmacion"
  contenido: string
  timestamp: Date
  accion?: StockAccionParsed // Acción parseada por Ollama (si aplica)
  requiereConfirmacion?: boolean
  confirmacionId?: string
}

export type TipoAccion = 
  | "entrada"              // Agregar stock
  | "salida"               // Quitar stock
  | "actualizar_stock"     // Actualizar stock directamente (reemplazar valor)
  | "consulta_stock"       // Consultar stock de un producto
  | "consulta_general"     // Preguntas generales sobre inventario
  | "crear_producto"       // Crear nuevo producto
  | "editar_producto"      // Editar producto existente
  | "eliminar_producto"    // Eliminar producto
  | "listar_productos"     // Listar todos los productos
  | "listar_pedidos"       // Listar pedidos/proveedores
  | "ver_pedido"           // Ver productos de un pedido específico
  | "importar_productos"   // Importar productos de pedidos al stock
  | "inicializar_stock"    // Inicializar stock con valores
  | "stock_bajo"           // Ver productos con stock bajo
  | "generar_pedido"       // Generar lista de pedido
  | "ayuda"                // Mostrar ayuda
  | "conversacion"         // Conversación general
  | "desconocido"

export interface StockAccionParsed {
  accion: TipoAccion
  producto?: string
  productoId?: string
  cantidad?: number
  unidad?: string
  stockMinimo?: number
  pedidoId?: string
  mensaje?: string // Respuesta conversacional de Ollama
  confianza: number // 0-1 nivel de confianza del parsing
  requiereConfirmacion?: boolean
  comandoSugerido?: { // Comando que Ollama sugiere ejecutar (se ejecuta con fallback)
    accion: TipoAccion
    producto?: string
    productoId?: string
    cantidad?: number
    unidad?: string
    stockMinimo?: number
    pedidoId?: string
  }
}

// Sinónimos de unidades para el parser
export const SINONIMOS_UNIDADES: Record<string, string> = {
  "cajon": "caja",
  "cajón": "caja",
  "cajones": "cajas",
  "kilo": "kg",
  "kilos": "kg",
  "kilogramo": "kg",
  "kilogramos": "kg",
  "paquete": "pack",
  "paquetes": "packs",
  "unidad": "u",
  "unidades": "u",
  "botella": "bot",
  "botellas": "bot",
  "lata": "lata",
  "latas": "latas",
  "litro": "l",
  "litros": "l",
}
