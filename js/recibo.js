// Recibo de pago: la hoja que se le entrega al cliente cuando paga.
// Copia el recibo que se venía haciendo a mano, con los mismos textos.

import { estado, guardar, guardarConfig } from './store.js';
import { esc } from './ui.js';
import { totalPedido } from './dinero.js';
import { montarHoja } from './pdf.js';

/* ---------- El monto en letras ---------- */

const HASTA_29 = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
  'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

// `apocope` es para cuando después viene "mil" o "millones": va "un mil", no "uno mil".
function menorACien(n, apocope) {
  if (n < 30) {
    if (apocope && n === 1) return 'un';
    if (apocope && n === 21) return 'veintiún';
    return HASTA_29[n];
  }
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (!u) return DECENAS[d];
  return `${DECENAS[d]} y ${apocope && u === 1 ? 'un' : HASTA_29[u]}`;
}

function menorAMil(n, apocope) {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  return [CENTENAS[c], r ? menorACien(r, apocope) : ''].filter(Boolean).join(' ');
}

/** El monto escrito, como se lee en el recibo: 300000 → "trescientos mil". */
export function enLetras(monto) {
  const n = Math.floor(Math.abs(Number(monto) || 0));
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1e6);
  const miles = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones === 1) partes.push('un millón');
  else if (millones > 1) partes.push(`${menorAMil(millones, true)} millones`);
  if (miles === 1) partes.push('mil');
  else if (miles > 1) partes.push(`${menorAMil(miles, true)} mil`);
  if (resto) partes.push(menorAMil(resto, false));
  return partes.join(' ');
}

/* ---------- Numeración ---------- */

/**
 * El número del recibo. Se asigna la primera vez que se imprime y queda
 * guardado en el pago: reimprimirlo devuelve el mismo número, no uno nuevo.
 */
export async function numeroRecibo(pedido, pago) {
  if (pago.recibo) return pago.recibo;
  const cfg = estado.config.recibos || {};
  const puntoVenta = String(cfg.puntoVenta || '0001');
  const proximo = Math.max(1, Number(cfg.proximo) || 1);
  const numero = `${puntoVenta}-${String(proximo).padStart(8, '0')}`;

  await guardarConfig({ recibos: { ...cfg, puntoVenta, proximo: proximo + 1 } });
  await guardar('pedidos', {
    ...pedido,
    pagos: (pedido.pagos || []).map((g) => (g.id === pago.id ? { ...g, recibo: numero } : g)),
  });
  return numero;
}

/* ---------- La hoja ---------- */

// Los cuatro renglones del recibo, siempre los mismos. El pago cae en el que
// corresponde al medio y los demás quedan en cero.
const RENGLONES = [
  { etiqueta: 'Efectivo', busca: /efectivo/i },
  { etiqueta: 'MercadoPago', busca: /mercado/i },
  { etiqueta: 'Transferencia Bancaria', busca: /transferencia|d[ée]bito|cr[ée]dito/i },
  { etiqueta: 'Cheques por la suma de', busca: /cheque/i },
];

function rengloDelPago(pago) {
  const medio = String(pago.medio || '');
  const i = RENGLONES.findIndex((r) => r.busca.test(medio));
  if (i >= 0) return i;
  // "Otro" y cualquier cosa rara: según dónde entró la plata.
  return pago.caja === 'efectivo' ? 0 : 2;
}

const conCentavos = (n) =>
  (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fechaLarga(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const mes = d.toLocaleDateString('es-AR', { month: 'long' });
  return `${String(d.getDate()).padStart(2, '0')} de ${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${d.getFullYear()}`;
}

/**
 * Lo que quedaba debiendo justo después de este pago, no lo que debe hoy:
 * si el cliente pagó tres veces, el recibo del primero tiene que decir lo que
 * faltaba en ese momento.
 */
function saldoTrasPago(pedido, pago) {
  const orden = [...(pedido.pagos || [])].sort((a, b) =>
    String(a.fecha).localeCompare(String(b.fecha)) || String(a.creado || '').localeCompare(String(b.creado || ''))
  );
  let acumulado = 0;
  for (const g of orden) {
    acumulado += Number(g.monto) || 0;
    if (g.id === pago.id) break;
  }
  return totalPedido(pedido) - acumulado;
}

export async function imprimirRecibo(pedido, pago) {
  const emp = estado.config.empresa || {};
  const numero = await numeroRecibo(pedido, pago);
  const monto = Number(pago.monto) || 0;
  const activo = rengloDelPago(pago);
  const nombre = (pedido.cliente?.nombre || '').toUpperCase();

  const renglones = RENGLONES.map((r, i) => {
    // El renglón de cheques, cuando no hay, queda con el signo solo. Así estaba.
    const importe = i === activo ? `$ ${conCentavos(monto)}` : (i === 3 ? '$' : '$ 0,00');
    return `<div>${esc(r.etiqueta)} ${importe}</div>`;
  }).join('');

  const html = `
    <div class="recibo__cab">
      <div>
        <div class="recibo__marca">${esc(emp.nombre || 'Zona Roller')}</div>
        ${emp.direccion ? `<div>Direcion: ${esc(emp.direccion)}</div>` : ''}
        ${emp.telefono ? `<div>Telefono: ${esc(emp.telefono)}</div>` : ''}
        ${emp.cuit ? `<div>Cuit: ${esc(emp.cuit)}</div>` : ''}
      </div>
      <div class="recibo__der">
        <div class="recibo__caja">
          <span class="recibo__caja-tit">Recibo de pago nro</span>
          <span class="recibo__caja-num">${esc(numero)}</span>
        </div>
        <div class="recibo__fecha">${esc(fechaLarga(pago.fecha))}</div>
      </div>
    </div>

    <div class="recibo__linea"></div>

    <p class="recibo__texto">Recibimos de ${esc(nombre)} la cantidad de pesos ${esc(enLetras(monto))}.</p>

    <div class="recibo__medios">${renglones}</div>

    <div class="recibo__saldo">Saldo $${conCentavos(saldoTrasPago(pedido, pago))}</div>
  `;

  // El título es el nombre del archivo que propone "Guardar como PDF".
  montarHoja(html, nombre || 'RECIBO ZR', 'hoja--recibo');
}
