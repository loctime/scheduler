// ... existing code ...

export interface InvitacionLink {
  id: string
  token: string // Token único para el link
  ownerId: string // ID del usuario que creó el link
  activo: boolean
  usado: boolean
  usadoPor?: string // ID del usuario que usó el link
  usadoPorEmail?: string // Email del usuario que usó el link
  usadoEn?: any // Timestamp de cuando se usó
  createdAt?: any
  expiresAt?: any // Opcional: fecha de expiración
  role?: "branch" | "factory" | "admin" | "invited" | "manager" | "delivery" // Rol que se asignará al usuario que use el link
  grupoId?: string // ID del grupo al que pertenecerá el usuario (para links creados por manager)
  permisos?: {
    paginas?: string[] // Páginas accesibles: "horarios", "pedidos", "fabrica", "empleados", "turnos", "configuracion"
    crearLinks?: boolean // Permiso para crear links de colaborador
  }
}

export interface Group {
  id: string
  nombre: string // Nombre del grupo (ej: "Grupo Norte", "Grupo Sur")
  managerId: string // ID del usuario gerente del grupo
  managerEmail?: string // Email del gerente (para referencia)
  userIds: string[] // IDs de usuarios del grupo (branch, factory)
  createdAt?: any
  updatedAt?: any
}

export type TipoAccion = 
  | "entrada" 
  | "salida" 
  | "actualizar_stock" 
  | "crear_producto" 
  | "editar_producto" 
  | "eliminar_producto" 
  | "consulta_stock" 
  | "listar_productos"
  | "listar_pedidos"
  | "ver_pedido"
  | "importar_productos"
  | "inicializar_stock"
  | "stock_bajo"
  | "generar_pedido"
  | "ayuda"
  | "consulta_general"
  | "conversacion"
  | "cambiar_modo"
  | "seleccionar_pedido"
  | "ver_lista_acumulada"
  | "deshacer_ultimo"
  | "quitar_de_lista"
  | "cambiar_cantidad"
  | "agregar_multiples"
  | "ver_ultimo_cambio_stock"
  | "deshacer_ultimo_stock"
  | "toggle_batch_stock"
  | "ver_lista_cambios_stock"
  | "actualizar_stock_multiples"

export interface StockAccionParsed {
  accion: TipoAccion
  productoId?: string
  producto?: string
  cantidad?: number
  unidad?: string
  confianza?: number
  mensaje?: string
  comandoSugerido?: StockAccionParsed
  stockMinimo?: number
  pedidoId?: string
  requiereConfirmacion?: boolean
}

export interface ChatMessage {
  id: string
  timestamp: Date
  tipo: "usuario" | "sistema" | "error" | "confirmacion"
  contenido: string
  accion?: StockAccionParsed
  requiereConfirmacion?: boolean
  accionesRapidas?: Array<{
    texto: string
    accion: () => void
  }>
}

export interface StockMovimiento {
  id: string
  productoId: string
  productoNombre: string
  tipo: "entrada" | "salida"
  cantidad: number
  unidad?: string
  userId: string
  userName?: string
  motivo?: string
  fecha?: any
  createdAt?: any
  pedidoId?: string
}

export interface StockActual {
  productoId: string
  cantidad: number
  ultimaActualizacion: any
  userId: string
  pedidoId?: string
}

export interface MedioTurno {
  id: string
  nombre: string
  startTime: string
  endTime: string
  color: string
}

export interface Configuracion {
  nombreEmpresa: string
  colorEmpresa?: string
  mesInicioDia: number
  horasMaximasPorDia: number
  semanaInicioDia: number
  mostrarFinesDeSemana: boolean
  formatoHora24: boolean
  minutosDescanso: number
  horasMinimasParaDescanso: number
  mediosTurnos: MedioTurno[]
  separadores?: Separador[]
  ordenEmpleados?: string[]
  fixedSchedules?: Array<{
    employeeId: string
    dayOfWeek: number
    assignments?: ShiftAssignment[]
  }>
  formatoSalida?: string
  mensajePrevio?: string
  nombreFirma?: string
  firmaDigital?: string
  // Reglas horarias (para cálculo de horas extra)
  reglasHorarias?: {
    horasNormalesPorDia?: number // Ej: 8 horas normales por día
    horasNormalesPorSemana?: number // Ej: 48 horas normales por semana
    inicioHorarioNocturno?: string // Ej: "21:00" - hora de inicio del horario nocturno
    limiteDiarioRecomendado?: number // Límite diario recomendado de horas trabajadas
  }
}

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
  startTime?: string
  endTime?: string
  startTime2?: string
  endTime2?: string
  color: string
  colorPrimeraFranja?: string
  colorSegundaFranja?: string
  userId: string
  createdAt?: any
  updatedAt?: any
}

export interface ShiftAssignment {
  shiftId?: string
  type?: "shift" | "franco" | "medio_franco" | "licencia" | "nota"
  startTime?: string
  endTime?: string
  startTime2?: string
  endTime2?: string
  texto?: string
  licenciaType?: "embarazo" | "vacaciones" | "otro"
}

export type ShiftAssignmentValue = ShiftAssignment | ShiftAssignment[] | string[]

export interface ShiftOverlap {
  employeeId: string
  date: string
  shifts: string[]
  message?: string
}

export interface Horario {
  id: string
  nombre: string
  weekStart: string
  semanaInicio: string
  semanaFin: string
  assignments: {
    [date: string]: {
      [empleadoId: string]: ShiftAssignment[] | string[]
    }
  }
  completada?: boolean
  completadaPor?: string
  completadaPorNombre?: string
  completadaEn?: any
  empleadosSnapshot?: Array<{
    id: string
    name: string
    email?: string
    phone?: string
  }>
  ordenEmpleadosSnapshot?: string[]
  createdAt?: any
  updatedAt?: any
  createdBy?: string
  createdByName?: string
  modifiedBy?: string
  modifiedByName?: string
}

export interface Separador {
  id: string
  nombre: string
  tipo: "puesto" | "personalizado"
  color?: string
  createdAt?: any
  updatedAt?: any
}

export interface HistorialItem {
  id: string
  horarioId: string
  version: number
  nombre: string
  weekStart: string
  semanaInicio: string
  semanaFin: string
  assignments: {
    [date: string]: {
      [empleadoId: string]: ShiftAssignment[] | string[]
    }
  }
  empleadosSnapshot?: Array<{
    id: string
    name: string
    email?: string
    phone?: string
  }>
  ordenEmpleadosSnapshot?: string[]
  accion?: string
  versionAnterior?: boolean
  createdAt?: any
  createdBy?: string
  createdByName?: string
}

export interface Pedido {
  id: string
  nombre: string
  stockMinimoDefault: number
  formatoSalida: string
  mensajePrevio?: string
  sheetUrl?: string
  userId: string
  estado?: string
  assignedTo?: string
  assignedToNombre?: string
  remitoEnvioId?: string
  fechaEnvio?: any
  enlacePublicoId?: string
  origenDefault?: string
  destinoDefault?: string
  createdAt?: any
  updatedAt?: any
}

export interface Producto {
  id: string
  pedidoId: string
  nombre: string
  stockMinimo: number
  unidad?: string
  orden?: number
  cantidadPedida?: number
  userId: string
  createdAt?: any
  updatedAt?: any
}

export interface EnlacePublico {
  id: string
  pedidoId: string
  token: string
  activo: boolean
  userId?: string
  productosSnapshot?: Array<{
    id: string
    nombre: string
    stockMinimo: number
    unidad?: string
    cantidadPedida?: number
    orden?: number
  }>
  productosDisponibles?: Array<{
    productoId: string
    disponible: boolean
    cantidadEnviar?: number
    observaciones?: string
  }>
  createdAt?: any
  expiresAt?: any
}

export interface Remito {
  id: string
  pedidoId: string
  numero: string
  tipo: "envio" | "recepcion" | "pedido"
  productos: Array<{
    productoId: string
    productoNombre: string
    cantidad: number
    cantidadPedida?: number
    cantidadEnviada?: number
    cantidadRecibida?: number
    unidad?: string
    observaciones?: string
  }>
  fecha?: any
  desde?: string
  hacia?: string
  horaRetiroFabrica?: string
  horaRecepcionLocal?: string
  observaciones?: string
  firmaEnvio?: {
    nombre: string
    firma?: string
  }
  firmaRecepcion?: {
    nombre: string
    firma?: string
  }
  final?: boolean
  userId?: string
  createdAt?: any
}

export interface Recepcion {
  id: string
  pedidoId: string
  fecha: any
  productos: Array<{
    productoId: string
    productoNombre: string
    cantidadEnviada: number
    cantidadRecibida: number
    estado?: string
    esDevolucion?: boolean
    cantidadDevolucion?: number
    observaciones?: string
  }>
  esParcial?: boolean
  completada?: boolean
  observaciones?: string
  userId: string
  createdAt?: any
}

export interface MensajeGrupo {
  id: string
  conversacionId: string
  remitenteId: string
  remitenteNombre?: string
  remitenteEmail?: string
  remitenteRole?: string
  contenido: string
  leido: boolean
  leidoPor?: string[] // IDs de usuarios que leyeron el mensaje
  timestamp?: Date
  createdAt?: any
  updatedAt?: any
}

export interface ConversacionGrupo {
  id: string
  tipo: "grupo" | "directo" | "rol" // grupo = entre grupos, directo = entre usuarios, rol = por rol (factory, branch)
  participantes: string[] // IDs de grupos o usuarios según el tipo
  nombresParticipantes?: string[] // Nombres para mostrar
  ultimoMensaje?: string
  ultimoMensajeAt?: any
  ultimoMensajePor?: string
  noLeidos?: Record<string, number> // { userId: cantidad }
  createdAt?: any
  updatedAt?: any
  activa: boolean
}

export interface EmployeeFixedRule {
  id: string
  employeeId: string
  ownerId: string
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  type: "SHIFT" | "OFF"
  shiftId?: string
  startDate?: string
  endDate?: string
  priority: number
  createdAt: any
  updatedAt: any
}
