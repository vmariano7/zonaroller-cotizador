// Cuentas de un pedido. Vive aparte de las vistas para que cualquiera
// (pedidos, caja, clientes, reportes) las use sin importarse entre sí.

import { estado } from './store.js';
import { calcularTotales } from './calc.js';
import { datosContado } from './mensaje.js';

/** Total del pedido. Usamos el guardado: un cambio de precios de hoy no reescribe la historia. */
export function totalPedido(pedido) {
  if (Number.isFinite(pedido?.total)) return pedido.total;
  return venta(pedido).total;
}

/**
 * El precio de lista del pedido: la base sobre la que se calcula el contado.
 * Los pedidos viejos no lo tienen guardado; en ellos lo que quedó guardado en
 * `total` es el precio de lista, así que se usa ese.
 */
export function totalLista(pedido) {
  if (Number.isFinite(pedido?.totalLista)) return pedido.totalLista;
  if (Number.isFinite(pedido?.total)) return pedido.total;
  return calcularTotales(pedido?.items, estado.config, { descuentoPct: pedido?.descuentoPct }).total;
}

/**
 * Cómo se cerró la venta.
 *
 * Todo pedido arranca con el precio de lista, que es el que salió en el
 * presupuesto. Si se cobró en efectivo o por transferencia se pasa a contado,
 * y `totalAcordado` pisa a los dos: es para cuando redondeás con el cliente y
 * el número que cerraron no es exactamente ninguno de los dos.
 */
export function venta(pedido) {
  const lista = totalLista(pedido);
  const d = datosContado(pedido, estado.config, lista);
  const modo = pedido?.modoVenta === 'contado' ? 'contado' : 'lista';
  const segunModo = modo === 'contado' ? d.contado : lista;
  const acordado = aMano(pedido?.totalAcordado);
  return {
    lista,
    contado: d.contado,
    pct: d.pct,
    modo,
    segunModo,
    acordado,
    total: acordado ?? segunModo,
    redondeo: acordado == null ? 0 : acordado - segunModo,
  };
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

/** Un número puesto a mano, o null si el campo está vacío. */
function aMano(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * Qué te salió el pedido, separado en tres.
 * `materiales` sale de los costos cargados, salvo que lo hayas puesto a mano
 * en el pedido (`costoMateriales`): pasa seguido que una compra se hizo con
 * descuento y el número real no es el que deduce la calculadora.
 */
export function costos(pedido) {
  const t = calcularTotales(pedido?.items, estado.config, {});
  const calculado = t.costoPropio - t.costoInstalacion;
  const manual = aMano(pedido?.costoMateriales);
  const materiales = manual ?? calculado;
  return {
    materiales,
    calculado,
    esManual: manual !== null,
    instalacion: t.costoInstalacion,
    total: materiales + t.costoInstalacion,
    // Cuánto se desvía del automático: sirve para corregir la ganancia sin
    // recalcularla desde cero.
    desvio: materiales - calculado,
  };
}

/** Lo que te queda del pedido después de pagar todo. */
export function margen(pedido) {
  return totalPedido(pedido) - costos(pedido).total;
}
