// Quién ve qué.
//
// Hay tres roles:
//
//   dueño      — ve todo.
//   empleado   — todo menos la plata del negocio: los saldos de las cuentas y
//                los totales vendidos. Cotiza, pasa a pedido, cobra, y ve
//                cuánto sale y cuánto debe cada pedido.
//   instalador — sólo los pedidos listos para instalar, y de cada uno la hoja
//                de ruta: cliente, teléfono, dirección, saldo a cobrar y la
//                orden de trabajo. Además puede cotizar, por si tiene que
//                hacer un presupuesto en el lugar.
//
// El rol viaja en el usuario de Supabase, dentro de `app_metadata`. Va ahí y
// no en `user_metadata` porque esta última la puede editar el propio usuario
// con su token; `app_metadata` sólo se cambia desde el panel de Supabase.
//
// Ojo con el alcance: esto esconde pantallas, no blinda datos. Quien entra con
// su usuario tiene un token que puede leer las mismas tablas que el tuyo, así
// que es un cerco para el uso diario y no una caja fuerte. Para que sea de
// verdad habría que separar los datos en otras tablas con su propia política
// de acceso (RLS por rol) en Supabase.

import { estado } from './store.js';

/**
 * Permisos que se usan hoy:
 *   caja            — la sección Caja entera (saldos de las cuentas)
 *   reportes        — la sección Reportes entera (ventas por mes)
 *   ajustes         — Ajustes: costos, respaldos y el resto de la configuración
 *   resumenVentas   — el resumen de venta del período, arriba de Pedidos
 *   costos          — "Qué te salió este pedido" (costo y margen) en cada pedido
 *   presupuestos    — la sección Presupuestos: el listado y la ficha de cada uno
 *   clientes        — la sección Clientes
 *   agenda          — la Agenda
 *   pedidosTodos    — ver todos los pedidos; sin esto, sólo los listos para instalar
 *   pedidoCompleto  — la ficha completa del pedido: precios, pagos y seguimiento.
 *                     Sin esto se ve la hoja de ruta (cliente, dirección, saldo
 *                     y la orden de trabajo).
 *   editarPedidos   — crear, editar y borrar pedidos
 *   cobrar          — registrar y borrar pagos
 *
 * Cotizar no lleva permiso: lo puede hacer cualquiera que entre.
 */
const PERMISOS = {
  empleado: ['presupuestos', 'clientes', 'agenda', 'pedidosTodos', 'pedidoCompleto', 'editarPedidos', 'cobrar'],
  instalador: ['presupuestos'],
};

export const NOMBRE_ROL = { empleado: 'Empleado', instalador: 'Instalador', dueño: 'Dueño' };

/** El rol de quien entró. Un rol que no esté en la tabla entra como dueño. */
export function rolActual() {
  const rol = estado.sesion?.rol;
  return PERMISOS[rol] ? rol : 'dueño';
}

export function esEmpleado() {
  return rolActual() === 'empleado';
}

export function esInstalador() {
  return rolActual() === 'instalador';
}

/** ¿Este rol puede abrir/hacer esto? El dueño no está en la tabla: puede todo. */
export function puede(permiso) {
  const lista = PERMISOS[rolActual()];
  return lista ? lista.includes(permiso) : true;
}
