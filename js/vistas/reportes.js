// Reportes: cómo vienen las ventas, qué se vende y cuánto se convierte.

import { estado } from '../store.js';
import { calcularTotales, NOMBRE_TIPO, CATEGORIA, categoriaItem, materialItem, contarItems, frasearUnidades } from '../calc.js';
import { plata, num, esc, hoyISO, capitalizar } from '../ui.js';
import { navegar } from '../router.js';
import { columnasApiladas, barrasHorizontales, tablaDeSeries, SERIES } from '../graficos.js';
import { totalPedido, cobrado, costos, margen } from '../dinero.js';
import { claveCliente } from './clientes.js';

// Las columnas del gráfico de meses se dividen en cortinas, placas y
// adicionales: tres tandas que se distinguen bien de un vistazo. El detalle
// de qué tipo de cortina se vendió va aparte, en el ranking de abajo, donde
// cada barra lleva su nombre escrito y no hay que adivinar por color.
const ORDEN_CATEGORIAS = Object.keys(CATEGORIA);

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

  // Tres cortes de lo mismo: por categoría (para el gráfico de meses), por
  // tipo y por tela o producto (para los rankings). Nada queda afuera: todo
  // renglón cae en alguna categoría, sea cortina, placa o adicional.
  const porCategoria = {};
  const unidades = {};
  const porTipo = {};
  const unidadesTipo = {};
  const porMaterial = {};

  t.lineas.forEach(({ item, calc }) => {
    const monto = calc.total * factor;
    const cat = categoriaItem(item);
    porCategoria[cat] = (porCategoria[cat] || 0) + monto;
    unidades[cat] = (unidades[cat] || 0) + calc.cantidad;
    porTipo[item.tipo] = (porTipo[item.tipo] || 0) + monto;
    unidadesTipo[item.tipo] = (unidadesTipo[item.tipo] || 0) + calc.cantidad;
    const clave = `${NOMBRE_TIPO[item.tipo] || item.tipo} · ${materialItem(item)}`;
    porMaterial[clave] = (porMaterial[clave] || 0) + monto;
  });

  // La ganancia sale del total realmente cobrado menos el costo real, que es
  // lo mismo que muestra la ficha del pedido. No se recalcula desde los
  // renglones: un pedido cobrado de contado vale menos que su precio de lista,
  // y esa diferencia no es ganancia.
  return { total, porCategoria, unidades, porTipo, unidadesTipo, porMaterial, ganancia: margen(pedido) };
}

/**
 * Saca los meses vacíos del principio. Sin esto, si arrancaste hace poco, el
 * gráfico son diez columnas en blanco y dos con datos. Dejamos un mes de
 * contexto antes de la primera venta y nunca menos de tres columnas.
 */
function recortarVacios(meses, mesesConVentas) {
  if (!mesesConVentas.length) return meses.slice(-3);
  const primero = mesesConVentas.reduce((a, b) => (a < b ? a : b));
  const i = meses.indexOf(primero);
  if (i <= 0) return meses;
  const recortado = meses.slice(Math.max(0, i - 1));
  return recortado.length >= 3 ? recortado : meses.slice(-3);
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
    const ventana = mesesDelPeriodo(periodo);
    const conVentas = estado.pedidos
      .filter((p) => p.estado !== 'cancelado')
      .map((p) => mesDe(p.fecha))
      .filter((m) => ventana.includes(m));
    const meses = recortarVacios(ventana, conVentas);
    const desde = meses[0];
    const hasta = meses[meses.length - 1];
    const enRango = (iso) => {
      const m = mesDe(iso);
      return m >= desde && m <= hasta;
    };

    const pedidos = estado.pedidos.filter((p) => p.estado !== 'cancelado' && enRango(p.fecha));
    const desgloses = pedidos.map((p) => ({ pedido: p, d: desglose(p) }));

    const vendido = desgloses.reduce((a, x) => a + x.d.total, 0);
    const unidades = {};
    desgloses.forEach((x) => ORDEN_CATEGORIAS.forEach((cat) => {
      unidades[cat] = (unidades[cat] || 0) + (x.d.unidades[cat] || 0);
    }));
    const ganancia = desgloses.reduce((a, x) => a + x.d.ganancia, 0);
    const ticket = pedidos.length ? vendido / pedidos.length : 0;
    const margenPct = vendido ? (ganancia / vendido) * 100 : 0;

    const presupuestos = estado.presupuestos.filter((p) => enRango(p.fecha));

    // Serie mensual apilada por categoría. El color va pegado a la categoría y
    // no a la posición, así que esconder una tanda vacía no repinta a las otras.
    const series = ORDEN_CATEGORIAS
      .map((cat, i) => ({
        nombre: CATEGORIA[cat].titulo,
        color: SERIES[i % SERIES.length],
        valores: meses.map((m) =>
          desgloses
            .filter((x) => mesDe(x.pedido.fecha) === m)
            .reduce((a, x) => a + (metrica === 'plata' ? x.d.porCategoria[cat] || 0 : x.d.unidades[cat] || 0), 0)
        ),
      }))
      .filter((s) => s.valores.some((v) => v));

    // Ranking por tipo: acá aparece el detalle de las cortinas (roller,
    // verticales, paneles…) y también las placas y los adicionales.
    const tipos = {};
    const tiposUnidades = {};
    desgloses.forEach((x) => {
      Object.entries(x.d.porTipo).forEach(([k, v]) => { tipos[k] = (tipos[k] || 0) + v; });
      Object.entries(x.d.unidadesTipo).forEach(([k, v]) => { tiposUnidades[k] = (tiposUnidades[k] || 0) + v; });
    });
    const rankingTipos = Object.entries(tipos)
      .map(([tipo, valor]) => ({
        // Placas y adicionales van en plural: acá son el rubro entero, no un renglón suelto.
        etiqueta: CATEGORIA[tipo]?.titulo || NOMBRE_TIPO[tipo] || tipo,
        valor,
        detalle: contarItems(tiposUnidades[tipo] || 0, categoriaItem({ tipo })),
      }))
      .sort((a, b) => b.valor - a.valor);

    // Ranking de telas y productos
    const materiales = {};
    desgloses.forEach((x) => {
      Object.entries(x.d.porMaterial).forEach(([k, v]) => {
        materiales[k] = (materiales[k] || 0) + v;
      });
    });
    const rankingMateriales = Object.entries(materiales)
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
        <div class="sub">${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} · ${frasearUnidades(unidades)} · ticket promedio ${plata(ticket)}</div>
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
          <div class="kpi__etiqueta">Costo abonado</div>
          <div class="kpi__valor">${plata(vendido - ganancia)}</div>
          <div class="kpi__pie">materiales e instalador</div>
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
          <div><h2>Ventas por mes</h2><div class="mini">Cada columna se divide en cortinas, placas y adicionales.</div></div>
          <div class="der" style="display:flex;gap:.5rem;align-items:center">
            <div class="segmentado" data-metrica>
              <button data-v="plata" aria-pressed="${metrica === 'plata'}">$</button>
              <button data-v="cantidad" aria-pressed="${metrica === 'cantidad'}">Unidades</button>
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
            <div><h2>Ventas por tipo</h2><div class="mini">Cada tipo de cortina, más placas y adicionales.</div></div>
          </div>
          <div data-gr-tipos></div>
        </div>

        <div class="tarjeta">
          <div class="tarjeta__cab">
            <span class="seccion-num">03</span>
            <div><h2>Lo más vendido</h2><div class="mini">Telas y productos, por facturación.</div></div>
          </div>
          <div data-gr-materiales></div>
        </div>
      </div>

      <div class="grid grid--2">
        <div class="tarjeta">
          <div class="tarjeta__cab">
            <span class="seccion-num">04</span>
            <div><h2>Mejores clientes</h2><div class="mini">Los que más te compraron.</div></div>
          </div>
          <div data-gr-clientes></div>
        </div>

        <div class="tarjeta">
          <div class="tarjeta__cab">
            <span class="seccion-num">05</span>
            <div><h2>Presupuestos</h2><div class="mini">En qué terminaron los del período.</div></div>
          </div>
          <div data-gr-estados></div>
        </div>
      </div>
    `;

    const cajaMeses = cuerpo.querySelector('[data-gr-meses]');
    const formato = metrica === 'plata' ? plata : (v) => `${num(v, 0)} ${v === 1 ? 'unidad' : 'unidades'}`;

    if (!series.length) {
      cajaMeses.innerHTML = '<div class="mini">Todavía no hay pedidos en este período.</div>';
    } else if (verTabla) {
      cajaMeses.innerHTML = tablaDeSeries({ etiquetas: meses.map(etiquetaMes), series, formato });
    } else {
      columnasApiladas(cajaMeses, { etiquetas: meses.map(etiquetaMes), series, formato, titulo: 'Ventas por mes' });
    }

    barrasHorizontales(cuerpo.querySelector('[data-gr-tipos]'), { items: rankingTipos });
    barrasHorizontales(cuerpo.querySelector('[data-gr-materiales]'), { items: rankingMateriales });
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
    const cajaEstados = cuerpo.querySelector('[data-gr-estados]');
    if (!presupuestos.length) {
      cajaEstados.innerHTML = '<div class="mini">Todavía no hay presupuestos en este período.</div>';
    } else {
      barrasHorizontales(cajaEstados, { items: estados, color: SERIES[2] });
    }

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

  pintar();
}
