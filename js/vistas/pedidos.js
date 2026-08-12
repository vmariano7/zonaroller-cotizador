// Pedidos confirmados: listado, alta desde cero o desde presupuesto, y detalle con pagos.

import { estado, guardar, borrar, obtener, proximoNumero } from '../store.js';
import { calcularTotales, descripcionItem, detallesTecnicos } from '../calc.js';
import {
  plata, num, fecha, esc, aviso, confirmar, chip, vacio, modal, hoyISO, leerNumero, ESTADOS_PEDIDO,
} from '../ui.js';
import { navegar } from '../router.js';
import { imprimirOrdenTrabajo } from '../pdf.js';
import { montarEditor, docVacio } from './editor.js';
import { totalPedido, cobrado, saldo, costos, margen, venta, CAJAS, cajaDeMedio } from '../dinero.js';

/** Cómo va armada la cortina, en una línea. Vacío si no hay nada que decir. */
const armado = (item) => [...detallesTecnicos(item), item.detalle].filter(Boolean).join(' · ');

/** Un día como ISO, sin que el huso horario lo corra al día anterior. */
function iso(d) {
  const c = new Date(d);
  c.setMinutes(c.getMinutes() - c.getTimezoneOffset());
  return c.toISOString().slice(0, 10);
}

/** Atajos de período para el resumen de venta. */
const RANGOS = [
  {
    clave: 'mes',
    texto: 'Este mes',
    fechas: () => {
      const h = new Date(`${hoyISO()}T12:00:00`);
      return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), hoyISO()];
    },
  },
  {
    clave: '3m',
    texto: '3 meses',
    fechas: () => {
      const h = new Date(`${hoyISO()}T12:00:00`);
      return [iso(new Date(h.getFullYear(), h.getMonth() - 2, 1)), hoyISO()];
    },
  },
  {
    clave: 'anio',
    texto: 'Este año',
    fechas: () => {
      const h = new Date(`${hoyISO()}T12:00:00`);
      return [iso(new Date(h.getFullYear(), 0, 1)), hoyISO()];
    },
  },
  { clave: 'todo', texto: 'Todo', fechas: () => ['', ''] },
];

function etiquetaMes(iso) {
  const ym = String(iso || '').slice(0, 7);
  if (!ym) return 'Sin fecha';
  const [a, m] = ym.split('-');
  const nombre = new Date(Number(a), Number(m) - 1, 1).toLocaleDateString('es-AR', { month: 'long' });
  return `${nombre.toUpperCase()} ${a}`;
}

export async function crearPedidoDesdePresupuesto(p) {
  const t = calcularTotales(p.items, estado.config, { descuentoPct: p.descuentoPct });
  return guardar('pedidos', {
    numero: proximoNumero('pedidos', 'OT'),
    presupuestoId: p.id,
    fecha: hoyISO(),
    cliente: { ...p.cliente },
    items: JSON.parse(JSON.stringify(p.items)),
    descuentoPct: p.descuentoPct || 0,
    notas: p.notas || '',
    estado: 'pendiente',
    // Arranca al precio de lista. En la ficha del pedido se elige si en
    // realidad se cobró de contado. Ver venta() en dinero.js.
    totalLista: t.total,
    modoVenta: 'lista',
    totalAcordado: null,
    total: t.total,
    contadoPct: p.contadoPct ?? null,
    contadoManual: p.contadoManual ?? null,
    cantidadCortinas: t.cantidadCortinas,
    costoInstalacion: t.costoInstalacion,
    fechaInstalacion: '',
    instalacionPagada: false,
    pagos: [],
  });
}

/* ---------- Listado ---------- */

export function render(contenedor) {
  const abiertos = estado.pedidos.filter((p) => !['instalado', 'cancelado'].includes(p.estado));
  const porCobrar = abiertos.reduce((a, p) => a + Math.max(0, saldo(p)), 0);

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div><h1>Pedidos</h1><div class="sub">${abiertos.length} en curso · ${plata(porCobrar)} por cobrar</div></div>
      <div class="der">
        <a class="btn" href="#/presupuestos">Desde un presupuesto</a>
        <a class="btn btn--primario" href="#/pedido-nuevo">+ Pedido desde cero</a>
      </div>
    </div>
    <div class="tarjeta mb-16">
      <div class="tarjeta__cab">
        <h2>Resumen de venta</h2>
        <div class="der">
          <div class="segmentado" data-rango>
            ${RANGOS.map((r) => `<button data-v="${r.clave}"${r.clave === 'mes' ? ' aria-pressed="true"' : ''}>${r.texto}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="campos campos--2">
        <div><label for="rs-desde">Desde</label><input id="rs-desde" type="date" data-desde></div>
        <div><label for="rs-hasta">Hasta</label><input id="rs-hasta" type="date" data-hasta></div>
      </div>
      <div class="mt-16" data-resumen></div>
    </div>

    <div class="campos campos--2 mb-16">
      <input data-buscar placeholder="Buscar por cliente, número o dirección…">
      <select data-filtro>
        <option value="">Todos los estados</option>
        ${Object.entries(ESTADOS_PEDIDO).map(([k, v]) => `<option value="${k}">${v.texto}</option>`).join('')}
      </select>
    </div>
    <div class="lista" data-lista></div>
  `;

  const lista = contenedor.querySelector('[data-lista]');
  const inputBuscar = contenedor.querySelector('[data-buscar]');
  const selFiltro = contenedor.querySelector('[data-filtro]');
  const inputDesde = contenedor.querySelector('[data-desde]');
  const inputHasta = contenedor.querySelector('[data-hasta]');
  const cajaResumen = contenedor.querySelector('[data-resumen]');

  /* ---- Resumen de venta del período ---- */

  function pintarResumen() {
    const desde = inputDesde.value;
    const hasta = inputHasta.value;
    // Los cancelados no son venta.
    const enRango = estado.pedidos.filter((p) => {
      if (p.estado === 'cancelado') return false;
      const f = String(p.fecha || '');
      return (!desde || f >= desde) && (!hasta || f <= hasta);
    });

    const vendido = enRango.reduce((a, p) => a + totalPedido(p), 0);
    const costo = enRango.reduce((a, p) => a + costos(p).total, 0);
    const ganancia = vendido - costo;
    const pct = vendido ? (ganancia / vendido) * 100 : 0;
    const cortinas = enRango.reduce((a, p) => a + (Number(p.cantidadCortinas) || 0), 0);
    const pagado = enRango.reduce((a, p) => a + cobrado(p), 0);
    const pendiente = enRango.reduce((a, p) => a + Math.max(0, saldo(p)), 0);

    if (!enRango.length) {
      cajaResumen.innerHTML = '<div class="mini">No hay pedidos en este período.</div>';
      return;
    }

    cajaResumen.innerHTML = `
      <div class="kpis">
        <div class="kpi">
          <div class="kpi__etiqueta">Vendido</div>
          <div class="kpi__valor">${plata(vendido)}</div>
          <div class="kpi__pie">${enRango.length} pedido${enRango.length === 1 ? '' : 's'} · ${num(cortinas, 0)} cortinas</div>
        </div>
        <div class="kpi">
          <div class="kpi__etiqueta">Costo abonado</div>
          <div class="kpi__valor">${plata(costo)}</div>
          <div class="kpi__pie">materiales e instalador</div>
        </div>
        <div class="kpi ${ganancia >= 0 ? 'kpi--verde' : 'kpi--rojo'}">
          <div class="kpi__etiqueta">Ganancia</div>
          <div class="kpi__valor">${plata(ganancia)}</div>
          <div class="kpi__pie">${num(pct, 0)}% del vendido</div>
        </div>
        <div class="kpi ${pendiente > 0 ? 'kpi--rojo' : 'kpi--verde'}">
          <div class="kpi__etiqueta">Por cobrar</div>
          <div class="kpi__valor">${plata(pendiente)}</div>
          <div class="kpi__pie">cobrado ${plata(pagado)}</div>
        </div>
      </div>`;
  }

  function aplicarRango(clave) {
    const r = RANGOS.find((x) => x.clave === clave);
    if (!r) return;
    const [desde, hasta] = r.fechas();
    inputDesde.value = desde;
    inputHasta.value = hasta;
    pintarResumen();
  }

  contenedor.querySelectorAll('[data-rango] button').forEach((b) =>
    b.addEventListener('click', () => {
      contenedor.querySelectorAll('[data-rango] button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      aplicarRango(b.dataset.v);
    })
  );

  // Tocar las fechas a mano deselecciona los atajos: ya no es "este mes".
  [inputDesde, inputHasta].forEach((inp) =>
    inp.addEventListener('change', () => {
      contenedor.querySelectorAll('[data-rango] button').forEach((o) => o.setAttribute('aria-pressed', 'false'));
      pintarResumen();
    })
  );

  aplicarRango('mes');

  function pintar() {
    const q = inputBuscar.value.trim().toLowerCase();
    const f = selFiltro.value;
    const items = estado.pedidos
      .filter((p) => !f || p.estado === f)
      .filter((p) => {
        if (!q) return true;
        return `${p.numero} ${p.cliente?.nombre} ${p.cliente?.direccion} ${p.cliente?.telefono}`.toLowerCase().includes(q);
      })
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

    if (!items.length) {
      lista.innerHTML = vacio(
        estado.pedidos.length ? 'Ningún pedido coincide con la búsqueda.' : 'Todavía no tenés pedidos confirmados.',
        '<a class="btn btn--primario" href="#/pedido-nuevo">Cargar un pedido</a>'
      );
      return;
    }

    // Agrupamos con un header por mes: sirve para ver de un vistazo cuántos
    // pedidos hay por período sin tener que contar. Solo tiene sentido
    // cuando la lista está ordenada por fecha (sin buscar) y no hay más de
    // un mes distinto — si el usuario filtra por texto igual queda prolijo.
    const filas = [];
    let mesAnterior = null;
    items.forEach((p) => {
      const ym = String(p.fecha || '').slice(0, 7);
      if (ym !== mesAnterior) {
        mesAnterior = ym;
        filas.push(`<div class="lista__mes">${esc(etiquetaMes(p.fecha))}</div>`);
      }
      const s = saldo(p);
      filas.push(`
      <div class="item-lista" data-id="${p.id}">
        <div class="item-lista__cuerpo">
          <div class="item-lista__titulo">${esc(p.cliente?.nombre || 'Sin nombre')} ${chip(ESTADOS_PEDIDO, p.estado)}</div>
          <div class="mini">${esc(p.numero)} · ${fecha(p.fecha)}${p.fechaInstalacion ? ` · instala ${fecha(p.fechaInstalacion)}` : ''}${p.cliente?.direccion ? ` · ${esc(p.cliente.direccion)}` : ''}</div>
        </div>
        <div class="item-lista__monto">${plata(totalPedido(p))}
          <div class="mini" style="font-weight:600;color:${s > 0 ? 'var(--rojo)' : 'var(--verde)'}">${s > 0 ? `debe ${plata(s)}` : 'pagado'}</div>
        </div>
      </div>`);
    });
    lista.innerHTML = filas.join('');

    lista.querySelectorAll('[data-id]').forEach((n) =>
      n.addEventListener('click', () => navegar(`/pedido/${n.dataset.id}`))
    );
  }

  inputBuscar.addEventListener('input', pintar);
  selFiltro.addEventListener('change', pintar);
  pintar();
}

/* ---------- Alta / edición ---------- */

export function renderEditor(contenedor, params = {}) {
  const existente = params.id ? obtener('pedidos', params.id) : null;
  const doc = existente ? { ...existente } : docVacio();

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div>
        <h1>${existente ? `Editar pedido ${existente.numero}` : 'Nuevo pedido'}</h1>
        <div class="sub">${existente ? 'Modificá cliente o cortinas' : 'Cargá un pedido confirmado sin pasar por un presupuesto'}</div>
      </div>
    </div>
    <div data-editor></div>
    <div class="resumen-fijo"></div>
  `;

  const barra = contenedor.querySelector('.resumen-fijo');
  const editor = montarEditor(contenedor.querySelector('[data-editor]'), doc, { alCambiar: pintarBarra });

  function pintarBarra() {
    const t = editor.totales();
    barra.innerHTML = `
      <div class="resumen-fijo__fila"><span>${t.cantidadCortinas} cortina${t.cantidadCortinas === 1 ? '' : 's'}</span><span></span></div>
      <div class="resumen-fijo__total"><span>Total</span><span>${plata(t.total)}</span></div>
      <div class="fila-botones mt-16">
        <button class="btn btn--primario" data-guardar style="flex:1">${existente ? 'Guardar cambios' : 'Crear pedido'}</button>
      </div>`;
    barra.querySelector('[data-guardar]').onclick = guardarDoc;
  }

  async function guardarDoc() {
    const d = editor.leer();
    if (!d.cliente.nombre?.trim()) {
      aviso('Poné al menos el nombre del cliente.', 'error');
      editor.enfocarCliente();
      return;
    }
    const t = editor.totales();
    const base = {
      ...(existente || {}),
      ...d,
      numero: existente?.numero || proximoNumero('pedidos', 'OT'),
      estado: existente?.estado || 'pendiente',
      // Cambiar las cortinas mueve el precio de lista; cómo se cobró (lista o
      // contado, con o sin redondeo) se respeta y se recalcula sobre la base nueva.
      totalLista: t.total,
      modoVenta: existente?.modoVenta || 'lista',
      cantidadCortinas: t.cantidadCortinas,
      costoInstalacion: t.costoInstalacion,
      pagos: existente?.pagos || [],
      fechaInstalacion: existente?.fechaInstalacion || '',
      instalacionPagada: existente?.instalacionPagada || false,
    };
    const g = await guardar('pedidos', { ...base, total: venta(base).total });
    aviso(`Pedido ${g.numero} guardado.`);
    navegar(`/pedido/${g.id}`);
  }

  pintarBarra();
}

/* ---------- Detalle ---------- */

export function renderDetalle(contenedor, params) {
  const p = obtener('pedidos', params.id);
  if (!p) {
    contenedor.innerHTML = vacio('No encontré ese pedido.', '<a class="btn" href="#/pedidos">Volver al listado</a>');
    return;
  }

  const t = calcularTotales(p.items, estado.config, { descuentoPct: p.descuentoPct });
  const v = venta(p);
  const cobra = totalPedido(p);
  const pagado = cobrado(p);
  const debe = cobra - pagado;
  const cs = costos(p);
  const gana = margen(p);
  const ganaPct = cobra ? (gana / cobra) * 100 : 0;

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div>
        <h1>${esc(p.numero)} ${chip(ESTADOS_PEDIDO, p.estado)}</h1>
        <div class="sub">${esc(p.cliente?.nombre || 'Sin nombre')} · ${fecha(p.fecha)}${p.presupuestoId ? ' · desde presupuesto' : ''}</div>
      </div>
      <div class="der">
        <a class="btn" href="#/pedido-editar/${p.id}">Editar</a>
        <button class="btn" data-ot>Orden de trabajo</button>
      </div>
    </div>

    <div class="kpis mb-16">
      <div class="kpi"><div class="kpi__etiqueta">Total</div><div class="kpi__valor">${plata(cobra)}</div><div class="kpi__pie">${v.modo === 'contado' ? 'precio de contado' : 'precio de lista'}${v.redondeo ? ' · redondeado' : ''}</div></div>
      <div class="kpi kpi--verde"><div class="kpi__etiqueta">Cobrado</div><div class="kpi__valor">${plata(pagado)}</div></div>
      <div class="kpi ${debe > 0 ? 'kpi--rojo' : 'kpi--verde'}"><div class="kpi__etiqueta">Saldo</div><div class="kpi__valor">${plata(debe)}</div></div>
      <div class="kpi"><div class="kpi__etiqueta">Instalación a pagar</div><div class="kpi__valor">${plata(p.instalacionPagada ? 0 : t.costoInstalacion)}</div><div class="kpi__pie">${p.instalacionPagada ? 'ya pagada' : `${t.cantidadCortinas} cortinas`}</div></div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <h2>Cómo se vendió</h2>
        <div class="der">
          <div class="segmentado" data-modo>
            <button data-v="lista"${v.modo === 'lista' ? ' aria-pressed="true"' : ''}>Precio de lista</button>
            <button data-v="contado"${v.modo === 'contado' ? ' aria-pressed="true"' : ''}>Precio de contado</button>
          </div>
        </div>
      </div>
      <div class="campos campos--2">
        <div>
          <label for="p-acordado">Precio final acordado</label>
          <div class="con-prefijo"><span>$</span>
            <input id="p-acordado" type="number" inputmode="decimal" min="0" step="1" data-acordado
                   value="${v.acordado != null ? Math.round(v.acordado) : ''}" placeholder="${Math.round(v.segunModo)}">
          </div>
          <div class="mini" style="margin-top:.4rem">
            Vacío cobra el precio ${v.modo === 'contado' ? 'de contado' : 'de lista'}.
            Si lo redondeaste con el cliente, escribí acá lo que cerraron.
          </div>
          ${v.acordado != null ? `<div class="fila-botones mt-16"><button class="btn btn--chico btn--fantasma" data-acordado-auto>Volver a ${plata(v.segunModo)}</button></div>` : ''}
        </div>
        <div class="totales" style="align-self:end">
          <div><span>Precio de lista</span><strong>${plata(v.lista)}</strong></div>
          <div><span>Precio de contado <span class="mini">(−${num(v.pct, 1)}%)</span></span><strong>${plata(v.contado)}</strong></div>
          ${v.redondeo ? `<div><span>Redondeo</span><strong>${v.redondeo > 0 ? '+' : '−'}${plata(Math.abs(v.redondeo))}</strong></div>` : ''}
          <div class="total"><span>Se cobra</span><span>${plata(v.total)}</span></div>
        </div>
      </div>
    </div>

    <div class="grid grid--2">
      <div class="tarjeta">
        <div class="tarjeta__cab"><h2>Seguimiento</h2></div>
        <div class="campos campos--2">
          <div>
            <label>Estado</label>
            <select data-estado>
              ${Object.entries(ESTADOS_PEDIDO).map(([k, v]) => `<option value="${k}"${p.estado === k ? ' selected' : ''}>${v.texto}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Fecha de instalación</label>
            <input type="date" data-finstal value="${esc(p.fechaInstalacion || '')}">
          </div>
        </div>
        <div class="check mt-16">
          <label class="switch"><input type="checkbox" data-instalpag${p.instalacionPagada ? ' checked' : ''}><span class="switch__pista"></span></label>
          <span>Ya le pagué al instalador (${plata(t.costoInstalacion)})</span>
        </div>
        <div class="fila-botones mt-16">
          ${p.cliente?.telefono ? `<a class="btn btn--chico" href="tel:${esc(p.cliente.telefono)}">Llamar</a>` : ''}
          ${p.presupuestoId && obtener('presupuestos', p.presupuestoId) ? `<a class="btn btn--chico" href="#/presupuesto/${p.presupuestoId}">Ver presupuesto</a>` : ''}
          <button class="btn btn--peligro btn--chico" data-eliminar>Eliminar pedido</button>
        </div>
      </div>

      <div class="tarjeta">
        <div class="tarjeta__cab">
          <h2>Pagos</h2>
          <div class="der"><button class="btn btn--chico btn--primario" data-pago>+ Registrar pago</button></div>
        </div>
        <div data-pagos></div>
      </div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <h2>Qué te salió este pedido</h2>
        <div class="der mini">${cs.esManual ? 'costo puesto a mano' : 'costo deducido de tus precios'}</div>
      </div>
      <div class="campos campos--2">
        <div>
          <label for="p-costo">Costo de materiales</label>
          <div class="con-prefijo"><span>$</span>
            <input id="p-costo" type="number" inputmode="decimal" min="0" step="1" data-costo
                   value="${cs.esManual ? Math.round(cs.materiales) : ''}" placeholder="${Math.round(cs.calculado)}">
          </div>
          <div class="mini" style="margin-top:.4rem">
            Con tus costos cargados da ${plata(cs.calculado)}. Si lo compraste con descuento,
            escribí acá lo que pagaste de verdad.
          </div>
          ${cs.esManual ? '<div class="fila-botones mt-16"><button class="btn btn--chico btn--fantasma" data-costo-auto>Volver al calculado</button></div>' : ''}
        </div>
        <div class="totales" style="align-self:end">
          <div><span>Materiales</span><strong>${plata(cs.materiales)}</strong></div>
          <div><span>Instalador</span><strong>${plata(cs.instalacion)}</strong></div>
          <div class="total"><span>Costo total</span><span>${plata(cs.total)}</span></div>
          <div style="margin-top:.4rem">
            <span>Margen</span>
            <strong style="color:${gana >= 0 ? 'var(--verde)' : 'var(--rojo)'}">${plata(gana)} <span class="mini">(${num(ganaPct, 0)}%)</span></strong>
          </div>
        </div>
      </div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab"><h2>Cortinas</h2></div>
      <div class="tabla-scroll">
        <table>
          <thead><tr><th>Ambiente</th><th>Tipo y tela</th><th class="num">Medidas</th><th class="num">Sistema</th><th class="num">Cant.</th><th class="num">Total</th></tr></thead>
          <tbody>
            ${t.lineas.map(({ item, calc }) => `
              <tr>
                <td>${esc(item.ambiente || '—')}${armado(item) ? `<div class="mini">${esc(armado(item))}</div>` : ''}</td>
                <td>${esc({ roller: 'Roller', vertical: 'Bandas verticales', zebra: 'Zebra', tela_tradicional: 'Cortina Tela Tradicional' }[item.tipo] || item.tipo)}<div class="mini">${esc(descripcionItem(item) || item.tela)}</div></td>
                <td class="num">${num(calc.anchoM)} × ${num(calc.altoM)} m</td>
                <td class="num mini">${esc(calc.sistemaNombre)}</td>
                <td class="num">${calc.cantidad}</td>
                <td class="num"><strong>${plata(calc.total)}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${Math.abs(v.total - v.lista) > 0.5 ? `<div class="mt-16 mini">Los precios de esta tabla son los de lista. Este pedido se cobró <strong>${plata(v.total)}</strong> — ver <em>Cómo se vendió</em>.</div>` : ''}
      ${p.notas ? `<div class="mt-16 mini"><strong>Observaciones:</strong> ${esc(p.notas)}</div>` : ''}
      ${p.cliente?.notas ? `<div class="mini"><strong>Notas internas:</strong> ${esc(p.cliente.notas)}</div>` : ''}
    </div>
  `;

  pintarPagos();

  function pintarPagos() {
    const caja = contenedor.querySelector('[data-pagos]');
    const pagos = [...(p.pagos || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    if (!pagos.length) {
      caja.innerHTML = '<div class="mini">Todavía no registraste ningún pago de este pedido.</div>';
      return;
    }
    caja.innerHTML = `
      <table>
        <tbody>
          ${pagos.map((g) => `
            <tr>
              <td>${fecha(g.fecha)}<div class="mini">${esc(g.medio || '')}${g.nota ? ` · ${esc(g.nota)}` : ''}</div></td>
              <td class="num"><strong>${plata(g.monto)}</strong></td>
              <td style="width:32px"><button class="btn-icono" data-borrar-pago="${g.id}" title="Borrar pago">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    caja.querySelectorAll('[data-borrar-pago]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!(await confirmar('¿Borrar este pago?', { textoOk: 'Borrar', peligro: true }))) return;
        p.pagos = (p.pagos || []).filter((g) => g.id !== b.dataset.borrarPago);
        await guardar('pedidos', p);
        renderDetalle(contenedor, params);
      })
    );
  }

  /* ---- Cómo se vendió ---- */

  // El total guardado siempre tiene que coincidir con lo que dice esta tarjeta:
  // es el número que usan el listado, Caja y Reportes.
  async function guardarVenta(cambios, texto) {
    const base = { ...p, ...cambios };
    await guardar('pedidos', { ...base, total: venta(base).total });
    aviso(texto);
    renderDetalle(contenedor, params);
  }

  contenedor.querySelectorAll('[data-modo] button').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.v === v.modo) return;
      const otro = venta({ ...p, modoVenta: b.dataset.v });
      guardarVenta({ modoVenta: b.dataset.v }, `Se cobra el precio de ${b.dataset.v}: ${plata(otro.total)}.`);
    })
  );

  contenedor.querySelector('[data-acordado]').addEventListener('change', async (e) => {
    const crudo = e.target.value.trim();
    const valor = crudo === '' ? null : Number(crudo);
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
      aviso('Poné un precio válido.', 'error');
      return;
    }
    guardarVenta(
      { totalAcordado: valor },
      valor === null ? `Vuelve al precio de ${v.modo}.` : `Precio acordado en ${plata(valor)}.`
    );
  });

  contenedor.querySelector('[data-acordado-auto]')?.addEventListener('click', () =>
    guardarVenta({ totalAcordado: null }, `Vuelve al precio de ${v.modo}.`)
  );

  contenedor.querySelector('[data-estado]').addEventListener('change', async (e) => {
    await guardar('pedidos', { ...p, estado: e.target.value });
    aviso('Estado actualizado.');
    renderDetalle(contenedor, params);
  });

  contenedor.querySelector('[data-finstal]').addEventListener('change', async (e) => {
    await guardar('pedidos', { ...p, fechaInstalacion: e.target.value });
    aviso(e.target.value ? `Instalación agendada para el ${fecha(e.target.value)}.` : 'Fecha de instalación borrada.');
  });

  contenedor.querySelector('[data-instalpag]').addEventListener('change', async (e) => {
    await guardar('pedidos', { ...p, instalacionPagada: e.target.checked });
    renderDetalle(contenedor, params);
  });

  // El costo se guarda al salir del campo. Vacío = volver al calculado.
  contenedor.querySelector('[data-costo]').addEventListener('change', async (e) => {
    const crudo = e.target.value.trim();
    const valor = crudo === '' ? null : Number(crudo);
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
      aviso('Poné un costo válido.', 'error');
      return;
    }
    await guardar('pedidos', { ...p, costoMateriales: valor });
    aviso(valor === null ? 'Vuelve a usar el costo calculado.' : `Costo actualizado a ${plata(valor)}.`);
    renderDetalle(contenedor, params);
  });

  contenedor.querySelector('[data-costo-auto]')?.addEventListener('click', async () => {
    await guardar('pedidos', { ...p, costoMateriales: null });
    aviso('Vuelve a usar el costo calculado.');
    renderDetalle(contenedor, params);
  });

  contenedor.querySelector('[data-ot]').addEventListener('click', () => imprimirOrdenTrabajo(p));

  contenedor.querySelector('[data-eliminar]').addEventListener('click', async () => {
    if (!(await confirmar(`¿Eliminar el pedido ${p.numero}? No se puede deshacer.`, { textoOk: 'Eliminar', peligro: true }))) return;
    await borrar('pedidos', p.id);
    aviso('Pedido eliminado.');
    navegar('/pedidos');
  });

  contenedor.querySelector('[data-pago]').addEventListener('click', () => {
    const m = modal('Registrar pago', `
      <div class="campos campos--2">
        <div><label>Monto</label><div class="con-prefijo"><span>$</span><input id="pg-monto" type="number" inputmode="decimal" min="0" step="1" value="${Math.max(0, Math.round(debe))}"></div></div>
        <div><label>Fecha</label><input id="pg-fecha" type="date" value="${hoyISO()}"></div>
      </div>
      <div class="campos campos--3 mt-16">
        <div><label>Medio</label>
          <select id="pg-medio">
            <option>Transferencia</option><option>Efectivo</option><option>Débito</option><option>Crédito</option><option>Mercado Pago</option><option>Cheque</option><option>Otro</option>
          </select>
        </div>
        <div><label>Entra en</label>
          <select id="pg-caja">
            ${Object.entries(CAJAS).map(([k, v]) => `<option value="${k}">${esc(v.nombre)}</option>`).join('')}
          </select>
        </div>
        <div><label>Nota</label><input id="pg-nota" placeholder="Ej. seña"></div>
      </div>
      <div class="fila-botones fila-botones--fin mt-16">
        <button class="btn btn--fantasma" data-cerrar>Cancelar</button>
        <button class="btn btn--primario" id="pg-ok">Registrar</button>
      </div>`, { ancho: '520px' });

    // La caja sigue al medio de pago, pero se puede corregir a mano: un
    // "Otro" puede haber entrado en efectivo.
    const selMedio = m.cuerpo.querySelector('#pg-medio');
    const selCaja = m.cuerpo.querySelector('#pg-caja');
    const sincronizarCaja = () => { selCaja.value = cajaDeMedio(selMedio.value); };
    selMedio.addEventListener('change', sincronizarCaja);
    sincronizarCaja();

    m.cuerpo.querySelector('#pg-ok').onclick = async () => {
      const monto = leerNumero(m.cuerpo.querySelector('#pg-monto').value);
      if (!monto || monto <= 0) {
        aviso('Poné un monto válido.', 'error');
        return;
      }
      const pago = {
        id: crypto.randomUUID(),
        monto,
        fecha: m.cuerpo.querySelector('#pg-fecha').value || hoyISO(),
        medio: selMedio.value,
        caja: selCaja.value,
        // Cuándo se cargó, no cuándo dice el usuario que pasó: es lo que usa
        // Caja para saber si el cobro es posterior al punto de partida.
        creado: new Date().toISOString(),
        nota: m.cuerpo.querySelector('#pg-nota').value,
      };
      await guardar('pedidos', { ...p, pagos: [...(p.pagos || []), pago] });
      m.cerrar();
      aviso(`Pago de ${plata(monto)} registrado en ${CAJAS[pago.caja].corto.toLowerCase()}.`);
      renderDetalle(contenedor, params);
    };
  });
}
