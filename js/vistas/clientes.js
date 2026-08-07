// Clientes: se arman solos a partir de los presupuestos y pedidos.
// No hay una tabla aparte que mantener sincronizada — si cargaste el nombre
// una vez, el cliente ya existe.

import { estado } from '../store.js';
import { calcularTotales } from '../calc.js';
import { plata, num, fecha, esc, chip, vacio, ESTADOS_PRESUPUESTO, ESTADOS_PEDIDO } from '../ui.js';
import { navegar } from '../router.js';
import { totalPedido, cobrado, saldo } from '../dinero.js';

const soloDigitos = (s) => String(s || '').replace(/\D/g, '');

/**
 * Clave con la que se agrupan los documentos de un mismo cliente.
 * Preferimos el teléfono porque los nombres se escriben de mil formas.
 */
export function claveCliente(cliente) {
  const tel = soloDigitos(cliente?.telefono);
  if (tel.length >= 8) return `t:${tel.slice(-8)}`;
  const nombre = String(cliente?.nombre || '').trim().toLowerCase();
  return nombre ? `n:${nombre}` : '';
}

/** Devuelve todos los clientes con su historial y sus números. */
export function listarClientes() {
  const mapa = new Map();

  const sumar = (doc, tipo) => {
    const clave = claveCliente(doc.cliente);
    if (!clave) return;
    if (!mapa.has(clave)) {
      mapa.set(clave, {
        clave,
        nombre: doc.cliente?.nombre || 'Sin nombre',
        telefono: doc.cliente?.telefono || '',
        direccion: doc.cliente?.direccion || '',
        ciudad: doc.cliente?.ciudad || '',
        email: doc.cliente?.email || '',
        presupuestos: [],
        pedidos: [],
        comprado: 0,
        debe: 0,
        cortinas: 0,
        ultima: '',
      });
    }
    const c = mapa.get(clave);
    // Los datos de contacto más recientes ganan.
    if (String(doc.fecha || '') >= String(c.ultima || '')) {
      c.ultima = doc.fecha || c.ultima;
      c.nombre = doc.cliente?.nombre || c.nombre;
      if (doc.cliente?.telefono) c.telefono = doc.cliente.telefono;
      if (doc.cliente?.direccion) c.direccion = doc.cliente.direccion;
      if (doc.cliente?.ciudad) c.ciudad = doc.cliente.ciudad;
      if (doc.cliente?.email) c.email = doc.cliente.email;
    }
    if (tipo === 'presupuesto') {
      c.presupuestos.push(doc);
    } else {
      c.pedidos.push(doc);
      if (doc.estado !== 'cancelado') {
        c.comprado += totalPedido(doc);
        c.debe += Math.max(0, saldo(doc));
        c.cortinas += doc.cantidadCortinas || 0;
      }
    }
  };

  estado.presupuestos.forEach((p) => sumar(p, 'presupuesto'));
  estado.pedidos.forEach((p) => sumar(p, 'pedido'));

  return [...mapa.values()].sort((a, b) => String(b.ultima).localeCompare(String(a.ultima)));
}

export function buscarCliente(clave) {
  return listarClientes().find((c) => c.clave === clave) || null;
}

/** Para el autocompletado del cotizador. */
export function sugerencias() {
  return listarClientes().map((c) => ({
    nombre: c.nombre,
    telefono: c.telefono,
    direccion: c.direccion,
    ciudad: c.ciudad,
    email: c.email,
  }));
}

/* ---------- Listado ---------- */

export function render(contenedor) {
  const todos = listarClientes();

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div><h1>Clientes</h1><div class="sub">${todos.length} en total · se arman solos con lo que cargás</div></div>
      <div class="der"><a class="btn btn--primario" href="#/cotizar">+ Cotizar a uno nuevo</a></div>
    </div>
    <div class="campos campos--2 mb-16">
      <input data-buscar placeholder="Buscar por nombre, teléfono o dirección…">
      <select data-orden>
        <option value="reciente">Más recientes primero</option>
        <option value="comprado">Los que más compraron</option>
        <option value="debe">Los que deben plata</option>
        <option value="nombre">Por nombre</option>
      </select>
    </div>
    <div class="lista" data-lista></div>
  `;

  const lista = contenedor.querySelector('[data-lista]');
  const inputBuscar = contenedor.querySelector('[data-buscar]');
  const selOrden = contenedor.querySelector('[data-orden]');

  function pintar() {
    const q = inputBuscar.value.trim().toLowerCase();
    let items = todos.filter((c) =>
      !q ? true : `${c.nombre} ${c.telefono} ${c.direccion} ${c.ciudad}`.toLowerCase().includes(q)
    );

    if (selOrden.value === 'comprado') items = [...items].sort((a, b) => b.comprado - a.comprado);
    else if (selOrden.value === 'debe') items = [...items].filter((c) => c.debe > 0).sort((a, b) => b.debe - a.debe);
    else if (selOrden.value === 'nombre') items = [...items].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    if (!items.length) {
      lista.innerHTML = vacio(
        todos.length ? 'Ningún cliente coincide.' : 'Todavía no cargaste ningún cliente. Aparecen solos cuando hacés un presupuesto.',
        '<a class="btn btn--primario" href="#/cotizar">Hacer el primero</a>'
      );
      return;
    }

    lista.innerHTML = items
      .map(
        (c) => `
      <div class="item-lista" data-clave="${esc(c.clave)}">
        <div class="item-lista__cuerpo">
          <div class="item-lista__titulo">${esc(c.nombre)} ${c.debe > 0 ? `<span class="chip chip--rojo">debe ${plata(c.debe)}</span>` : ''}</div>
          <div class="mini">${[
            c.telefono,
            c.direccion,
            `${c.pedidos.length} pedido${c.pedidos.length === 1 ? '' : 's'}`,
            `${c.presupuestos.length} presupuesto${c.presupuestos.length === 1 ? '' : 's'}`,
          ].filter(Boolean).map(esc).join(' · ')}</div>
        </div>
        <div class="item-lista__monto">${plata(c.comprado)}<div class="mini" style="font-weight:600">${c.ultima ? fecha(c.ultima) : ''}</div></div>
      </div>`
      )
      .join('');

    lista.querySelectorAll('[data-clave]').forEach((n) =>
      n.addEventListener('click', () => navegar(`/cliente/${encodeURIComponent(n.dataset.clave)}`))
    );
  }

  inputBuscar.addEventListener('input', pintar);
  selOrden.addEventListener('change', pintar);
  pintar();
}

/* ---------- Ficha ---------- */

export function renderDetalle(contenedor, params) {
  const c = buscarCliente(params.clave);
  if (!c) {
    contenedor.innerHTML = vacio('No encontré ese cliente.', '<a class="btn" href="#/clientes">Volver al listado</a>');
    return;
  }

  const activos = c.pedidos.filter((p) => p.estado !== 'cancelado');
  const pagado = activos.reduce((a, p) => a + cobrado(p), 0);
  const tel = soloDigitos(c.telefono);

  // Qué le gusta comprar
  const telas = {};
  activos.forEach((p) => {
    calcularTotales(p.items, estado.config, {}).lineas.forEach(({ item, calc }) => {
      const k = item.tela;
      telas[k] = (telas[k] || 0) + calc.cantidad;
    });
  });
  const favoritas = Object.entries(telas).sort((a, b) => b[1] - a[1]).slice(0, 3);

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div>
        <h1>${esc(c.nombre)}</h1>
        <div class="sub">${[c.direccion, c.ciudad].filter(Boolean).map(esc).join(', ') || 'Sin dirección cargada'}</div>
      </div>
      <div class="der">
        ${tel ? `<a class="btn" href="tel:${esc(c.telefono)}">Llamar</a>` : ''}
        ${tel ? `<a class="btn" href="https://wa.me/${tel.length > 10 ? tel : `549${tel}`}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        <a class="btn btn--primario" href="#/cotizar">Nuevo presupuesto</a>
      </div>
    </div>

    <div class="kpis mb-16">
      <div class="kpi"><div class="kpi__etiqueta">Te compró</div><div class="kpi__valor">${plata(c.comprado)}</div><div class="kpi__pie">${activos.length} pedido${activos.length === 1 ? '' : 's'} · ${num(c.cortinas, 0)} cortinas</div></div>
      <div class="kpi kpi--verde"><div class="kpi__etiqueta">Pagó</div><div class="kpi__valor">${plata(pagado)}</div></div>
      <div class="kpi ${c.debe > 0 ? 'kpi--rojo' : 'kpi--verde'}"><div class="kpi__etiqueta">Debe</div><div class="kpi__valor">${plata(c.debe)}</div></div>
      <div class="kpi"><div class="kpi__etiqueta">Última vez</div><div class="kpi__valor" style="font-size:1rem">${c.ultima ? fecha(c.ultima) : '—'}</div><div class="kpi__pie">${favoritas.length ? `prefiere ${esc(favoritas[0][0])}` : ''}</div></div>
    </div>

    <div class="grid grid--2">
      <div class="tarjeta">
        <div class="tarjeta__cab"><h2>Pedidos</h2></div>
        ${c.pedidos.length ? `<div class="lista">${c.pedidos
          .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
          .map((p) => `
            <div class="item-lista" data-ir="/pedido/${p.id}">
              <div class="item-lista__cuerpo">
                <div class="item-lista__titulo">${esc(p.numero)} ${chip(ESTADOS_PEDIDO, p.estado)}</div>
                <div class="mini">${fecha(p.fecha)} · ${p.cantidadCortinas || 0} cortinas${saldo(p) > 0 ? ` · debe ${plata(saldo(p))}` : ''}</div>
              </div>
              <div class="item-lista__monto">${plata(totalPedido(p))}</div>
            </div>`).join('')}</div>` : '<div class="mini">Todavía no te compró.</div>'}
      </div>

      <div class="tarjeta">
        <div class="tarjeta__cab"><h2>Presupuestos</h2></div>
        ${c.presupuestos.length ? `<div class="lista">${c.presupuestos
          .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
          .map((p) => `
            <div class="item-lista" data-ir="/presupuesto/${p.id}">
              <div class="item-lista__cuerpo">
                <div class="item-lista__titulo">${esc(p.numero)} ${chip(ESTADOS_PRESUPUESTO, p.estado)}</div>
                <div class="mini">${fecha(p.fecha)} · ${p.cantidadCortinas || 0} cortinas</div>
              </div>
              <div class="item-lista__monto">${plata(p.total)}</div>
            </div>`).join('')}</div>` : '<div class="mini">Sin presupuestos.</div>'}
      </div>
    </div>

    ${favoritas.length ? `
    <div class="tarjeta">
      <div class="tarjeta__cab"><h2>Qué le gusta</h2></div>
      <div class="fila-botones">
        ${favoritas.map(([tela, cant]) => `<span class="chip chip--gris" style="font-size:.78rem;padding:.3rem .6rem">${esc(tela)} · ${cant} cortina${cant === 1 ? '' : 's'}</span>`).join('')}
      </div>
    </div>` : ''}
  `;

  contenedor.querySelectorAll('[data-ir]').forEach((n) =>
    n.addEventListener('click', () => navegar(n.dataset.ir))
  );
}
