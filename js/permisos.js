// Quién ve qué.
//
// Hay dos roles: el dueño ve todo y el empleado ve todo menos la plata del
// negocio —los saldos de las cuentas y los totales vendidos—. Puede cotizar,
// pasar a pedido, cobrar y ver cuánto sale y cuánto debe cada pedido.
//
// El rol viaja en el usuario de Supabase, dentro de `app_metadata`. Va ahí y
// no en `user_metadata` porque esta última la puede editar el propio usuario
// con su token; `app_metadata` sólo se cambia desde el panel de Supabase.
//
// Ojo con el alcance: esto esconde pantallas, no blinda datos. El empleado
// entra con su usuario y su token puede leer las mismas tablas que el tuyo, así
// que es un cerco para el uso diario y no una caja fuerte. Para que sea de
// verdad habría que separar la plata en otra tabla con su propia política de
// acceso (RLS por rol) en Supabase.

import { estado } from './store.js';

/** Qué puede abrir cada rol. El que no está acá, ve todo (es el dueño). */
const PERMISOS = {
  empleado: [],
};

export const NOMBRE_ROL = { empleado: 'Empleado', dueño: 'Dueño' };

export function rolActual() {
  return estado.sesion?.rol === 'empleado' ? 'empleado' : 'dueño';
}

export function esEmpleado() {
  return rolActual() === 'empleado';
}

/**
 * Permisos que se usan hoy:
 *   caja           — la sección Caja entera (saldos de las cuentas)
 *   reportes       — la sección Reportes entera (ventas por mes)
 *   ajustes        — Ajustes: costos, respaldos y el resto de la configuración
 *   resumenVentas  — el resumen de venta del período, arriba de Pedidos
 *   costos         — "Qué te salió este pedido" (costo y margen) en cada pedido
 */
export function puede(permiso) {
  const lista = PERMISOS[rolActual()];
  return lista ? lista.includes(permiso) : true;
}
