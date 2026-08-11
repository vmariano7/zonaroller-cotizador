// Pedidos confirmados: listado, alta desde cero o desde presupuesto, y detalle con pagos.

import { estado, guardar, borrar, obtener, proximoNumero } from '../store.js';
import { calcularTotales, descripcionItem } from '../calc.js';
import {
  plata, num, fecha, esc, aviso, confirmar, chip, vacio, modal, hoyISO, leerNumero, ESTADOS_PEDIDO,
} from '../ui.js';
import { navegar } from '../router.js';
import { imprimirOrdenTrabajo } from '../pdf.js';
import { montarEditor, docVacio } from './editor.js';
import { totalPedido, cobrado, saldo } from '../dinero.js';

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
    total: t.total,
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
      contenedor.querySelector('#c-nombre')?.focus();
      return;
    }
    const t = editor.totales();
    const registro = {
      ...(existente || {}),
      ...d,
      numero: existente?.numero || proximoNumero('pedidos', 'OT'),
      estado: existente?.estado || 'pendiente',
      total: t.total,
      cantidadCortinas: t.cantidadCortinas,
      costoInstalacion: t.costoInstalacion,
      pagos: existente?.pagos || [],
      fechaInstalacion: existente?.fechaInstalacion || '',
      instalacionPagada: existente?.instalacionPagada || false,
    };
    const g = await guardar('pedidos', registro);
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
  const pagado = cobrado(p);
  const debe = t.total - pagado;

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
      <div class="kpi"><div class="kpi__etiqueta">Total</div><div class="kpi__valor">${plata(t.total)}</div></div>
      <div class="kpi kpi--verde"><div class="kpi__etiqueta">Cobrado</div><div class="kpi__valor">${plata(pagado)}</div></div>
      <div class="kpi ${debe > 0 ? 'kpi--rojo' : 'kpi--verde'}"><div class="kpi__etiqueta">Saldo</div><div class="kpi__valor">${plata(debe)}</div></div>
      <div class="kpi"><div class="kpi__etiqueta">Instalación a pagar</div><div class="kpi__valor">${plata(p.instalacionPagada ? 0 : t.costoInstalacion)}</div><div class="kpi__pie">${p.instalacionPagada ? 'ya pagada' : `${t.cantidadCortinas} cortinas`}</div></div>
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
          ${p.presupuestoId ? `<a class="btn btn--chico" href="#/presupuesto/${p.presupuestoId}">Ver presupuesto</a>` : ''}
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
      <div class="tarjeta__cab"><h2>Cortinas</h2></div>
      <div class="tabla-scroll">
        <table>
          <thead><tr><th>Ambiente</th><th>Tipo y tela</th><th class="num">Medidas</th><th class="num">Sistema</th><th class="num">Cant.</th><th class="num">Total</th></tr></thead>
          <tbody>
            ${t.lineas.map(({ item, calc }) => `
              <tr>
                <td>${esc(item.ambiente || '—')}${item.detalle ? `<div class="mini">${esc(item.detalle)}</div>` : ''}</td>
                <td>${esc({ roller: 'Roller', vertical: 'Bandas verticales', zebra: 'Zebra', tela_tradicional: 'Cortina Tela Tradicional' }[item.tipo] || item.tipo)}<div class="mini">${esc(descripcionItem(item) || item.tela)}</div></td>
                <td class="num">${num(calc.anchoM)} × ${num(calc.altoM)} m</td>
                <td class="num mini">${esc(calc.sistemaNombre)}</td>
                <td class="num">${calc.cantidad}</td>
                <td class="num"><strong>${plata(calc.total)}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
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
      <div class="campos campos--2 mt-16">
        <div><label>Medio</label>
          <select id="pg-medio">
            <option>Transferencia</option><option>Efectivo</option><option>Débito</option><option>Crédito</option><option>Mercado Pago</option><option>Cheque</option><option>Otro</option>
          </select>
        </div>
        <div><label>Nota</label><input id="pg-nota" placeholder="Ej. seña"></div>
      </div>
      <div class="fila-botones fila-botones--fin mt-16">
        <button class="btn btn--fantasma" data-cerrar>Cancelar</button>
        <button class="btn btn--primario" id="pg-ok">Registrar</button>
      </div>`, { ancho: '520px' });

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
        medio: m.cuerpo.querySelector('#pg-medio').value,
        nota: m.cuerpo.querySelector('#pg-nota').value,
      };
      await guardar('pedidos', { ...p, pagos: [...(p.pagos || []), pago] });
      m.cerrar();
      aviso(`Pago de ${plata(monto)} registrado.`);
      renderDetalle(contenedor, params);
    };
  });
}
