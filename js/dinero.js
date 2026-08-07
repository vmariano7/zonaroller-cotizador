// Cuentas de un pedido. Vive aparte de las vistas para que cualquiera
// (pedidos, caja, clientes, reportes) las use sin importarse entre sí.

import { estado } from './store.js';
import { calcularTotales } from './calc.js';

/** Total del pedido. Usamos el guardado: un cambio de precios de hoy no reescribe la historia. */
export function totalPedido(pedido) {
  if (Number.isFinite(pedido?.total)) return pedido.total;
  return calcularTotales(pedido?.items, estado.config, { descuentoPct: pedido?.descuentoPct }).total;
}

export function cobrado(pedido) {
  return (pedido?.pagos || []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
}

export function saldo(pedido) {
  return totalPedido(pedido) - cobrado(pedido);
}

/** Lo que hay que pagarle al instalador por este pedido. */
export function costoInstalacion(pedido) {
  if (Number.isFinite(pedido?.costoInstalacion)) return pedido.costoInstalacion;
  return calcularTotales(pedido?.items, estado.config, {}).costoInstalacion;
}
