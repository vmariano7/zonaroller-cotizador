// Reportes: cómo vienen las ventas, qué se vende y cuánto se convierte.

import { estado } from '../store.js';
import { calcularTotales, TIPOS } from '../calc.js';
import { plata, num, esc, hoyISO, capitalizar } from '../ui.js';
import { navegar } from '../router.js';
import { columnasApiladas, barrasHorizontales, tablaDeSeries, SERIES } from '../graficos.js';
import { totalPedido, cobrado } from '../dinero.js';
import { claveCliente } from './clientes.js';

const NOMBRE_TIPO = { roller: 'Roller', vertical: 'Bandas verticales', zebra: 'Zebra' };
const ORDEN_TIPOS = ['roller', 'vertical', 'zebra'];

const mesDe = (iso) => String(iso || '').slice(0, 7);

function etiquetaMes(ym) {
  const [a, m] = ym.split('-');
  const d = new Date(Number(a), Number(m) - 1, 1);
  // Recortamos a tres letras: "septiembre" abrevia "sept." y rompe la prolijidad del eje.
  const corto = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').slice(0, 3);
  return capitalizar(corto);
}

/** Meses del período, del más viejo al más nuevo. */
function mesesDelPeriodo(periodo) {
  const hoy = new Date(`${hoyISO()}T12:00:00`);
  const meses = [];
  if (periodo === 'anio') {
    for (let m = 0; m <= hoy.getMonth(); m++) meses.push(`${hoy.getFullYear()}-${String(m + 1).padStart(2, '0')}`);
    return meses;
  }
  const cantidad = periodo === '6m' ? 6 : 12;
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return meses;
}

/**
 * Reparte el total guardado del pedido entre sus renglones.
 * Usamos el total guardado (no lo recalculamos) para que un cambio de precios
 * de hoy no reescriba la historia; las proporciones salen de los renglones.
 */
function desglose(pedido) {
  const total = totalPedido(pedido);
  const t = calcularTotales(pedido.items, estado.config, { descuentoPct: pedido.descuentoPct });
  const base = t.subtotal || 1;
  const factor = total / base;

  const porTipo = { roller: 0, vertical: 0, zebra: 0 };
  const porTela = {};
  let cortinas = 0;

  t.lineas.forEach(({ item, calc }) => {
    const monto = calc.total * factor;
    if (porTipo[item.tipo] !== undefined) porTipo[item.tipo] += monto;
    const clave = `${NOMBRE_TIPO[item.tipo] || item.tipo} · ${item.tela}`;
    porTela[clave] = (porTela[clave] || 0) + monto;
    cortinas += calc.cantidad;
  });

  return { total, porTipo, porTela, cortinas, ganancia: t.ganancia * factor };
}

export function render(contenedor) {
  let periodo = '12m';
  let metrica = 'plata';
  let verTabla = false;

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div><h1>Reportes</h1><div class="sub">Cómo vienen tus ventas</div></div>
      <div class="der">
        <div class="segmentado" data-periodo>
          <button data-v="6m">6 meses</button>
          <button data-v="12m" aria-pressed="true">12 meses</button>
          <button data-v="anio">Este año</button>
        </div>
      </div>
    </div>
    <div data-cuerpo></div>
  `;

  const cuerpo = contenedor.querySelector('[data-cuerpo]');

  contenedor.querySelectorAll('[data-periodo] button').forEach((b) =>
    b.addEventListener('click', () => {
      periodo = b.dataset.v;
      contenedor.querySelectorAll('[data-periodo] button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      pintar();
    })
  );

  function pintar() {
    const meses = mesesDelPeriodo(periodo);
    const desde = meses[0];
    const hasta = meses[meses.length - 1];
    const enRango = (iso) => {
      const m = mesDe(iso);
      return m >= desde && m <= hasta;
    };

    const pedidos = estado.pedidos.filter((p) => p.estado !== 'cancelado' && enRango(p.fecha));
    const desgloses = pedidos.map((p) => ({ pedido: p, d: desglose(p) }));

    const vendido = desgloses.reduce((a, x) => a + x.d.total, 0);
    const cortinas = desgloses.reduce((a, x) => a + x.d.cortinas, 0);
    const ganancia = desgloses.reduce((a, x) => a + x.d.ganancia, 0);
    const ticket = pedidos.length ? vendido / pedidos.length : 0;
    const margenPct = vendido ? (ganancia / vendido) * 100 : 0;

    const presupuestos = estado.presupuestos.filter((p) => enRango(p.fecha));
    const confirmados = presupuestos.filter((p) => p.estado === 'confirmado').length;
    const conversion = presupuestos.length ? (confirmados / presupuestos.length) * 100 : 0;

    // Serie mensual apilada por tipo
    const series = ORDEN_TIPOS.map((tipo) => ({
      nombre: NOMBRE_TIPO[tipo],
      valores: meses.map((m) =>
        desgloses
          .filter((x) => mesDe(x.pedido.fecha) === m)
          .reduce((a, x) => a + (metrica === 'plata' ? x.d.porTipo[tipo] : contarCortinas(x, tipo)), 0)
      ),
    }));

    // Ranking de telas
    const telas = {};
    desgloses.forEach((x) => {
      Object.entries(x.d.porTela).forEach(([k, v]) => {
        telas[k] = (telas[k] || 0) + v;
      });
    });
    const rankingTelas = Object.entries(telas)
      .map(([etiqueta, valor]) => ({ etiqueta, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    // Mejores clientes
    const porCliente = {};
    desgloses.forEach((x) => {
      const k = claveCliente(x.pedido.cliente);
      if (!k) return;
      if (!porCliente[k]) porCliente[k] = { etiqueta: x.pedido.cliente?.nombre || 'Sin nombre', valor: 0, pedidos: 0 };
      porCliente[k].valor += x.d.total;
      porCliente[k].pedidos += 1;
    });
    const rankingClientes = Object.values(porCliente)
      .map((c) => ({ ...c, detalle: `${c.pedidos} pedido${c.pedidos === 1 ? '' : 's'}` }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);

    const mesActual = meses[meses.length - 1];
    const mesPrevio = meses[meses.length - 2];
    const totalMes = series.reduce((a, s) => a + (s.valores[meses.length - 1] || 0), 0);
    const totalPrevio = mesPrevio ? series.reduce((a, s) => a + (s.valores[meses.length - 2] || 0), 0) : 0;
    const variacion = totalPrevio ? ((totalMes - totalPrevio) / totalPrevio) * 100 : null;

    cuerpo.innerHTML = `
      <div class="tarjeta">
        <div class="mini" style="font-weight:700;text-transform:uppercase;letter-spacing:.05em">Vendido en el período</div>
        <div class="hero">${plata(vendido)}</div>
        <div class="sub">${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} · ${num(cortinas, 0)} cortinas · ticket promedio ${plata(ticket)}</div>
      </div>

      <div class="kpis mb-16">
        <div class="kpi">
          <div class="kpi__etiqueta">${esc(capitalizar(new Date(`${mesActual}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long' })))}</div>
          <div class="kpi__valor">${plata(totalMes)}</div>
          <div class="kpi__pie">${variacion === null ? 'sin mes previo para comparar' : `${variacion >= 0 ? '▲' : '▼'} ${num(Math.abs(variacion), 0)}% vs. el mes anterior`}</div>
        </div>
        <div class="kpi kpi--verde">
          <div class="kpi__etiqueta">Ganancia estimada</div>
          <div class="kpi__valor">${plata(ganancia)}</div>
          <div class="kpi__pie">${num(margenPct, 0)}% del facturado</div>
        </div>
        <div class="kpi">
          <div class="kpi__etiqueta">Conversión</div>
          <div class="kpi__valor">${num(conversion, 0)}%</div>
          <div class="kpi__pie">${confirmados} de ${presupuestos.length} presupuestos</div>
        </div>
        <div class="kpi">
          <div class="kpi__etiqueta">Por cobrar</div>
          <div class="kpi__valor">${plata(desgloses.reduce((a, x) => a + Math.max(0, x.d.total - cobrado(x.pedido)), 0))}</div>
          <div class="kpi__pie">de estos pedidos</div>
        </div>
      </div>

      <div class="tarjeta">
        <div class="tarjeta__cab">
          <span class="seccion-num">01</span>
          <div><h2>Ventas por mes</h2><div class="mini">Cada columna se divide según el tipo de cortina.</div></div>
          <div class="der" style="display:flex;gap:.5rem;align-items:center">
            <div class="segmentado" data-metrica>
              <button data-v="plata" aria-pressed="${metrica === 'plata'}">$</button>
              <button data-v="cantidad" aria-pressed="${metrica === 'cantidad'}">Cortinas</button>
            </div>
            <button class="btn btn--chico" data-tabla>${verTabla ? 'Ver gráfico' : 'Ver tabla'}</button>
          </div>
        </div>
        <div data-gr-meses></div>
      </div>

      <div class="grid grid--2">
        <div class="tarjeta">
          <div class="tarjeta__cab">
            <span class="seccion-num">02</span>
            <div><h2>Telas más vendidas</h2><div class="mini">Por facturación en el período.</div></div>
          </div>
          <div data-gr-telas></div>
        </div>

        <div class="tarjeta">
          <div class="tarjeta__cab">
            <span class="seccion-num">03</span>
            <div><h2>Mejores clientes</h2><div class="mini">Los que más te compraron.</div></div>
          </div>
          <div data-gr-clientes></div>
        </div>
      </div>

      <div class="tarjeta">
        <div class="tarjeta__cab">
          <span class="seccion-num">04</span>
          <div><h2>Presupuestos</h2><div class="mini">En qué terminaron los del período.</div></div>
        </div>
        <div data-gr-estados></div>
      </div>
    `;

    const cajaMeses = cuerpo.querySelector('[data-gr-meses]');
    const formato = metrica === 'plata' ? plata : (v) => `${num(v, 0)} cortinas`;

    if (verTabla) {
      cajaMeses.innerHTML = tablaDeSeries({ etiquetas: meses.map(etiquetaMes), series, formato });
    } else if (series.every((s) => s.valores.every((v) => !v))) {
      cajaMeses.innerHTML = '<div class="mini">Todavía no hay pedidos en este período.</div>';
    } else {
      columnasApiladas(cajaMeses, { etiquetas: meses.map(etiquetaMes), series, formato, titulo: 'Ventas por mes' });
    }

    barrasHorizontales(cuerpo.querySelector('[data-gr-telas]'), { items: rankingTelas });
    barrasHorizontales(cuerpo.querySelector('[data-gr-clientes]'), { items: rankingClientes, color: SERIES[1] });

    // Estados de presupuestos
    const estados = [
      { clave: 'confirmado', etiqueta: 'Confirmados' },
      { clave: 'enviado', etiqueta: 'Enviados, sin respuesta' },
      { clave: 'borrador', etiqueta: 'Borradores' },
      { clave: 'rechazado', etiqueta: 'Rechazados' },
    ].map((e) => {
      const lista = presupuestos.filter((p) => p.estado === e.clave);
      return {
        etiqueta: e.etiqueta,
        valor: lista.reduce((a, p) => a + (Number(p.total) || 0), 0),
        detalle: `${lista.length} presupuesto${lista.length === 1 ? '' : 's'}`,
      };
    });
    barrasHorizontales(cuerpo.querySelector('[data-gr-estados]'), { items: estados, color: SERIES[2] });

    cuerpo.querySelectorAll('[data-metrica] button').forEach((b) =>
      b.addEventListener('click', () => {
        metrica = b.dataset.v;
        pintar();
      })
    );
    cuerpo.querySelector('[data-tabla]').addEventListener('click', () => {
      verTabla = !verTabla;
      pintar();
    });
  }

  function contarCortinas(x, tipo) {
    const t = calcularTotales(x.pedido.items, estado.config, {});
    return t.lineas.filter(({ item }) => item.tipo === tipo).reduce((a, l) => a + l.calc.cantidad, 0);
  }

  pintar();
}
