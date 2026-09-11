// Flujo de caja: qué falta cobrar, qué falta pagar y cómo viene el mes.

import { estado, guardar, borrar, guardarConfig } from '../store.js';
import { plata, num, fecha, esc, aviso, confirmar, modal, hoyISO, leerNumero, chip, capitalizar, ESTADOS_PEDIDO } from '../ui.js';
import { navegar } from '../router.js';
import { totalPedido, cobrado, saldo, costoInstalacion, costos, saldosCaja, CAJAS, cajaDeMedio } from '../dinero.js';

const MEDIOS = ['Transferencia', 'Efectivo', 'Débito', 'Crédito', 'Mercado Pago', 'Cheque', 'Otro'];
const RUBROS_EGRESO = ['Telas y materiales', 'Instalación', 'Sueldos', 'Alquiler', 'Impuestos', 'Publicidad', 'Herramientas', 'Otro'];
const RUBROS_INGRESO = ['Cobro de pedido', 'Venta de mostrador', 'Reparación', 'Otro'];

function mesDe(iso) {
  return String(iso || '').slice(0, 7);
}

/**
 * El día del calendario de acá para un instante guardado en UTC. Sin esto, un
 * corte hecho a las nueve de la noche se muestra con la fecha del día siguiente.
 */
function diaLocal(instante) {
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function mesActual() {
  return hoyISO().slice(0, 7);
}

function nombreMes(ym) {
  const [a, m] = ym.split('-');
  const d = new Date(Number(a), Number(m) - 1, 1);
  return capitalizar(d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }));
}

export function render(contenedor, params = {}) {
  let mes = params.mes || mesActual();

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div><h1>Caja</h1><div class="sub">Lo que tenés, lo que te deben y lo que tenés que pagar</div></div>
      <div class="der"><button class="btn btn--primario" data-mov>+ Movimiento</button></div>
    </div>
    <div data-cuerpo></div>
  `;

  contenedor.querySelector('[data-mov]').addEventListener('click', () => dialogoMovimiento(() => pintar()));

  const cuerpo = contenedor.querySelector('[data-cuerpo]');

  function pintar() {
    const activos = estado.pedidos.filter((p) => p.estado !== 'cancelado');

    // Deudores
    const deudores = activos
      .map((p) => ({ pedido: p, debe: saldo(p) }))
      .filter((d) => d.debe > 0.5)
      .sort((a, b) => b.debe - a.debe);
    const porCobrar = deudores.reduce((a, d) => a + d.debe, 0);

    // Instalaciones pendientes de pago al instalador
    const instalaciones = activos
      .filter((p) => !p.instalacionPagada)
      .map((p) => ({ pedido: p, monto: costoInstalacion(p) }))
      .filter((i) => i.monto > 0)
      .sort((a, b) => String(a.pedido.fechaInstalacion || '9999').localeCompare(String(b.pedido.fechaInstalacion || '9999')));
    const aPagarInstal = instalaciones.reduce((a, i) => a + i.monto, 0);

    // Pedidos pendientes: todavía no se mandaron a producción, así que tampoco
    // se le pagó nada a la fábrica por ellos. Apenas el pedido pasa de estado
    // (a "En producción" o el que sea), sale solo de esta cuenta.
    const pendientesProduccion = activos
      .filter((p) => p.estado === 'pendiente')
      .map((p) => ({ pedido: p, monto: costos(p).materiales }))
      .filter((i) => i.monto > 0)
      .sort((a, b) => String(b.pedido.fecha || '').localeCompare(String(a.pedido.fecha || '')));
    const aPagarFabrica = pendientesProduccion.reduce((a, i) => a + i.monto, 0);

    // Lo que le debés a cada proveedor. Es un saldo que se carga a mano: cuando
    // pagás, lo bajás acá y la salida de plata se registra con "+ Movimiento",
    // igual que cualquier otro gasto.
    const proveedores = (estado.config.proveedores || [])
      .map((pr) => ({ ...pr, saldo: Number(pr.saldo) || 0 }))
      .sort((a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre));
    const deudaProveedores = proveedores.reduce((a, pr) => a + pr.saldo, 0);
    const proveedoresConSaldo = proveedores.filter((pr) => pr.saldo > 0).length;

    // Movimientos del mes
    const pagosMes = activos.flatMap((p) =>
      (p.pagos || []).filter((g) => mesDe(g.fecha) === mes).map((g) => ({ ...g, pedido: p }))
    );
    const movsMes = estado.movimientos.filter((m) => mesDe(m.fecha) === mes);

    // Presupuestos abiertos (todavía no confirmados)
    const enJuego = estado.presupuestos
      .filter((p) => ['borrador', 'enviado'].includes(p.estado))
      .reduce((a, p) => a + (Number(p.total) || 0), 0);

    const meses = [...new Set([
      mesActual(),
      ...estado.pedidos.flatMap((p) => (p.pagos || []).map((g) => mesDe(g.fecha))),
      ...estado.movimientos.map((m) => mesDe(m.fecha)),
    ])].filter(Boolean).sort().reverse();

    const sc = saldosCaja();
    // Con lo que hay hoy, más lo que los clientes deben, menos lo que hay que
    // pagarle al instalador por lo que todavía no se instaló, menos lo que
    // va a salir a producción (pedidos "pendiente") en cuanto se le pague a la
    // fábrica, y menos lo que se les debe a los proveedores.
    const capital = sc.total + porCobrar - aPagarInstal - aPagarFabrica - deudaProveedores;

    cuerpo.innerHTML = `
      <div class="tarjeta mb-16">
        <div class="tarjeta__cab">
          <div><h2>Lo que tenés ahora</h2><div class="mini">${sc.configurado
            ? `Desde el punto de partida del ${fecha(diaLocal(sc.desde))} suman solos los cobros de clientes.`
            : 'Cargá cuánto tenés hoy en cada lado y de ahí en más se actualiza solo.'}</div></div>
          <div class="der"><button class="btn btn--chico" data-saldos>${sc.configurado ? 'Ajustar saldos' : 'Cargar saldos'}</button></div>
        </div>
        ${sc.configurado ? `
        <div class="kpis">
          <div class="kpi kpi--verde">
            <div class="kpi__etiqueta">${esc(CAJAS.efectivo.nombre)}</div>
            <div class="kpi__valor">${plata(sc.efectivo)}</div>
          </div>
          <div class="kpi kpi--verde">
            <div class="kpi__etiqueta">${esc(CAJAS.cuenta.nombre)}</div>
            <div class="kpi__valor">${plata(sc.cuenta)}</div>
          </div>
          <div class="kpi">
            <div class="kpi__etiqueta">Total disponible</div>
            <div class="kpi__valor">${plata(sc.total)}</div>
          </div>
        </div>
        <div class="banner banner--info mt-16">
          <div>Los cobros que registrás en cada pedido entran solos, en efectivo o en la cuenta
          según el medio de pago. <strong>Los gastos no se descuentan solos</strong>: lo que le
          pagás al instalador y todo lo demás se carga con <em>+ Movimiento</em>.</div>
        </div>` : `
        <div class="mini">Todavía no cargaste el punto de partida, así que no puedo decirte cuánto tenés.</div>`}
      </div>

      <div class="kpis kpis--5 mb-16">
        <div class="kpi kpi--rojo">
          <div class="kpi__etiqueta">Por cobrar</div>
          <div class="kpi__valor">${plata(porCobrar)}</div>
          <div class="kpi__pie">${deudores.length} cliente${deudores.length === 1 ? '' : 's'} con saldo</div>
        </div>
        <div class="kpi">
          <div class="kpi__etiqueta">Instalaciones a pagar</div>
          <div class="kpi__valor">${plata(aPagarInstal)}</div>
          <div class="kpi__pie">${instalaciones.length} pedido${instalaciones.length === 1 ? '' : 's'}</div>
        </div>
        <div class="kpi">
          <div class="kpi__etiqueta">Producción pendiente</div>
          <div class="kpi__valor">${plata(aPagarFabrica)}</div>
          <div class="kpi__pie">${pendientesProduccion.length} pedido${pendientesProduccion.length === 1 ? '' : 's'} sin mandar a fábrica</div>
        </div>
        <div class="kpi">
          <div class="kpi__etiqueta">Proveedores</div>
          <div class="kpi__valor">${plata(deudaProveedores)}</div>
          <div class="kpi__pie">${proveedoresConSaldo} proveedor${proveedoresConSaldo === 1 ? '' : 'es'} con saldo</div>
        </div>
        <div class="kpi ${capital >= 0 ? 'kpi--verde' : 'kpi--rojo'}">
          <div class="kpi__etiqueta">Capital proyectado</div>
          <div class="kpi__valor">${plata(capital)}</div>
          <div class="kpi__pie">disponible + por cobrar − instalaciones − producción − proveedores</div>
        </div>
      </div>

      <div class="banner banner--info">
        <div>Tenés <strong>${plata(enJuego)}</strong> en presupuestos que todavía no se confirmaron ni se rechazaron.</div>
        <a class="btn btn--chico" href="#/presupuestos">Revisar</a>
      </div>

      <div class="grid grid--2">
        <div class="tarjeta">
          <div class="tarjeta__cab"><span class="seccion-num">1</span><h2>Clientes que deben</h2></div>
          ${deudores.length ? `
          <div class="tabla-scroll">
            <table>
              <thead><tr><th>Cliente</th><th class="num">Total</th><th class="num">Pagó</th><th class="num">Debe</th></tr></thead>
              <tbody>
                ${deudores.map(({ pedido, debe }) => `
                  <tr data-pedido="${pedido.id}" style="cursor:pointer">
                    <td>${esc(pedido.cliente?.nombre || 'Sin nombre')}<div class="mini">${esc(pedido.numero)} · ${fecha(pedido.fecha)} ${chip(ESTADOS_PEDIDO, pedido.estado)}</div></td>
                    <td class="num">${plata(totalPedido(pedido))}</td>
                    <td class="num">${plata(cobrado(pedido))}</td>
                    <td class="num" style="color:var(--rojo)"><strong>${plata(debe)}</strong></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<div class="mini">Nadie te debe plata. Buen momento.</div>'}
        </div>

        <div class="tarjeta">
          <div class="tarjeta__cab"><span class="seccion-num">2</span><h2>Instalaciones a pagar</h2></div>
          ${instalaciones.length ? `
          <div class="tabla-scroll">
            <table>
              <thead><tr><th>Pedido</th><th>Instala</th><th class="num">Monto</th><th></th></tr></thead>
              <tbody>
                ${instalaciones.map(({ pedido, monto }) => `
                  <tr>
                    <td><a href="#/pedido/${pedido.id}">${esc(pedido.numero)}</a><div class="mini">${esc(pedido.cliente?.nombre || '')}</div></td>
                    <td>${pedido.fechaInstalacion ? fecha(pedido.fechaInstalacion) : '<span class="mini">sin fecha</span>'}</td>
                    <td class="num">${plata(monto)}</td>
                    <td><button class="btn btn--chico" data-pagar-instal="${pedido.id}">Marcar pagada</button></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<div class="mini">No tenés instalaciones pendientes de pago.</div>'}
        </div>

        <div class="tarjeta">
          <div class="tarjeta__cab"><span class="seccion-num">3</span><h2>Producción pendiente</h2></div>
          ${pendientesProduccion.length ? `
          <div class="tabla-scroll">
            <table>
              <thead><tr><th>Pedido</th><th class="num">Monto</th></tr></thead>
              <tbody>
                ${pendientesProduccion.map(({ pedido, monto }) => `
                  <tr data-pedido="${pedido.id}" style="cursor:pointer">
                    <td>${esc(pedido.numero)}<div class="mini">${esc(pedido.cliente?.nombre || '')} · ${fecha(pedido.fecha)}</div></td>
                    <td class="num">${plata(monto)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="mini mt-16">Cuando le pagués a la fábrica, cambiá el estado del pedido a
          "En producción" y sale solo de esta lista.</div>` : '<div class="mini">No tenés pedidos pendientes de mandar a producción.</div>'}
        </div>

        <div class="tarjeta">
          <div class="tarjeta__cab">
            <span class="seccion-num">4</span><h2>Proveedores</h2>
            <div class="der"><button class="btn btn--chico" data-proveedores>${proveedores.length ? 'Agregar / editar' : 'Agregar proveedor'}</button></div>
          </div>
          ${proveedores.length ? `
          <div class="tabla-scroll">
            <table>
              <thead><tr><th>Proveedor</th><th class="num">Le debés</th></tr></thead>
              <tbody>
                ${proveedores.map((pr) => `
                  <tr>
                    <td>${esc(pr.nombre)}</td>
                    <td class="num"${pr.saldo > 0 ? ' style="color:var(--rojo)"' : ''}><strong>${plata(pr.saldo)}</strong></td>
                  </tr>`).join('')}
                ${proveedores.length > 1 ? `<tr><td><strong>Total</strong></td><td class="num"><strong>${plata(deudaProveedores)}</strong></td></tr>` : ''}
              </tbody>
            </table>
          </div>
          <div class="mini mt-16">Cuando le pagues a un proveedor, bajá su saldo acá y cargá la salida
          de plata con <em>+ Movimiento</em>.</div>` : '<div class="mini">Cargá tus proveedores y cuánto le debés a cada uno: se descuenta del capital proyectado.</div>'}
        </div>
      </div>

      <div class="tarjeta">
        <div class="tarjeta__cab">
          <span class="seccion-num">5</span><h2>Movimientos</h2>
          <div class="der">
            <select data-mes style="width:auto">
              ${meses.map((m) => `<option value="${m}"${m === mes ? ' selected' : ''}>${nombreMes(m)}</option>`).join('')}
            </select>
          </div>
        </div>
        ${pagosMes.length || movsMes.length ? `
        <div class="tabla-scroll">
          <table>
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Rubro</th><th class="num">Monto</th><th></th></tr></thead>
            <tbody>
              ${[
                ...pagosMes.map((g) => ({
                  fecha: g.fecha,
                  concepto: `Cobro de ${g.pedido.cliente?.nombre || 'cliente'}`,
                  sub: `${g.pedido.numero}${g.nota ? ` · ${g.nota}` : ''}`,
                  rubro: g.medio || 'Cobro',
                  caja: g.caja || cajaDeMedio(g.medio),
                  monto: Number(g.monto) || 0,
                  tipo: 'ingreso',
                  id: null,
                })),
                ...movsMes.map((m) => ({
                  fecha: m.fecha,
                  concepto: m.concepto,
                  sub: m.nota || '',
                  rubro: m.rubro || '',
                  caja: m.caja || '',
                  monto: Number(m.monto) || 0,
                  tipo: m.tipo,
                  id: m.id,
                })),
              ]
                .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
                .map((r) => `
                  <tr>
                    <td>${fecha(r.fecha)}</td>
                    <td>${esc(r.concepto)}${r.sub ? `<div class="mini">${esc(r.sub)}</div>` : ''}</td>
                    <td class="mini">${esc(r.rubro)}${r.caja ? `<div class="mini">${esc(CAJAS[r.caja]?.corto || '')}</div>` : ''}</td>
                    <td class="num" style="color:${r.tipo === 'ingreso' ? 'var(--verde)' : 'var(--rojo)'}"><strong>${r.tipo === 'ingreso' ? '+' : '−'} ${plata(r.monto)}</strong></td>
                    <td style="width:32px">${r.id ? `<button class="btn-icono" data-borrar-mov="${r.id}" title="Borrar">✕</button>` : ''}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="mini">Sin movimientos en ${nombreMes(mes)}.</div>`}
      </div>
    `;

    cuerpo.querySelectorAll('[data-pedido]').forEach((n) =>
      n.addEventListener('click', () => navegar(`/pedido/${n.dataset.pedido}`))
    );

    cuerpo.querySelector('[data-mes]')?.addEventListener('change', (e) => {
      mes = e.target.value;
      pintar();
    });

    cuerpo.querySelector('[data-saldos]').addEventListener('click', () => dialogoSaldos(() => pintar()));
    cuerpo.querySelector('[data-proveedores]').addEventListener('click', () => dialogoProveedores(() => pintar()));

    cuerpo.querySelectorAll('[data-pagar-instal]').forEach((b) =>
      b.addEventListener('click', async () => {
        const pedido = estado.pedidos.find((p) => p.id === b.dataset.pagarInstal);
        if (!pedido) return;
        const monto = costoInstalacion(pedido);
        // Solo marca la instalación como saldada. La salida de plata no se
        // descuenta sola: se carga a mano con "+ Movimiento".
        if (!(await confirmar(
          `¿Marcar como pagada la instalación de ${plata(monto)} del pedido ${pedido.numero}? El movimiento en la caja lo cargás vos aparte.`,
          { textoOk: 'Marcar pagada' }
        ))) return;
        await guardar('pedidos', { ...pedido, instalacionPagada: true });
        aviso('Instalación marcada como pagada. Acordate de cargar el movimiento.');
        pintar();
      })
    );

    cuerpo.querySelectorAll('[data-borrar-mov]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!(await confirmar('¿Borrar este movimiento?', { textoOk: 'Borrar', peligro: true }))) return;
        await borrar('movimientos', b.dataset.borrarMov);
        pintar();
      })
    );
  }

  pintar();
}

/**
 * Punto de partida de las dos cajas. Es un corte: lo que se cargó antes de
 * apretar Guardar queda adentro de estos importes y deja de sumarse.
 */
function dialogoSaldos(alGuardar) {
  const s = estado.config.saldos || {};
  const m = modal('Punto de partida de la caja', `
    <div class="mini mb-16">Poné lo que tenés <strong>ahora mismo</strong> en cada lado. Desde este
    momento se van sumando solos los cobros que registres en los pedidos; todo lo cargado
    hasta acá se considera parte de estos números.</div>
    <div class="campos campos--2">
      <div><label>${esc(CAJAS.efectivo.nombre)}</label>
        <div class="con-prefijo"><span>$</span><input id="sd-efectivo" type="number" inputmode="decimal" step="1" value="${Number(s.efectivo) || 0}"></div>
      </div>
      <div><label>${esc(CAJAS.cuenta.nombre)}</label>
        <div class="con-prefijo"><span>$</span><input id="sd-cuenta" type="number" inputmode="decimal" step="1" value="${Number(s.cuenta) || 0}"></div>
      </div>
    </div>
    ${s.desde ? `<div class="mini mt-16">El corte actual es del ${fecha(diaLocal(s.desde))}. Al guardar se corre a hoy y se vuelve a arrancar de cero.</div>` : ''}
    <div class="fila-botones fila-botones--fin mt-16">
      <button class="btn btn--fantasma" data-cerrar>Cancelar</button>
      <button class="btn btn--primario" id="sd-ok">Guardar saldos</button>
    </div>`, { ancho: '520px' });

  m.cuerpo.querySelector('#sd-ok').onclick = async () => {
    const leer = (id) => Number(m.cuerpo.querySelector(id).value) || 0;
    await guardarConfig({
      saldos: { desde: new Date().toISOString(), efectivo: leer('#sd-efectivo'), cuenta: leer('#sd-cuenta') },
    });
    m.cerrar();
    aviso('Saldos actualizados.');
    alGuardar?.();
  };
}

/**
 * Agregar, renombrar o borrar proveedores, y cargar cuánto se le debe a cada
 * uno. Es un saldo, no un historial: cuando pagás, lo bajás a mano. La lista
 * vive en config.proveedores.
 */
function dialogoProveedores(alGuardar) {
  let lista = (estado.config.proveedores || []).map((pr) => ({ ...pr, saldo: Number(pr.saldo) || 0 }));
  const vacio = () => ({ id: crypto.randomUUID(), nombre: '', saldo: 0 });
  if (!lista.length) lista.push(vacio());

  const m = modal('Proveedores', `
    <div class="mini mb-16">Cuánto le debés <strong>hoy</strong> a cada proveedor. Se descuenta del capital
    proyectado. Cuando pagues, actualizá el saldo acá y cargá la salida de plata con <em>+ Movimiento</em>.</div>
    <div data-filas></div>
    <button class="btn btn--chico mt-16" data-agregar style="width:100%">+ Agregar proveedor</button>
    <div class="fila-botones fila-botones--fin mt-16">
      <button class="btn btn--fantasma" data-cerrar>Cancelar</button>
      <button class="btn btn--primario" id="pv-ok">Guardar</button>
    </div>`, { ancho: '560px' });

  const cajaFilas = m.cuerpo.querySelector('[data-filas]');

  function pintarFilas() {
    cajaFilas.innerHTML = lista.map((pr, i) => `
      <div class="campo" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
        <input data-nombre="${i}" placeholder="Ej. Fábrica de telas" value="${esc(pr.nombre)}" style="flex:1">
        <div class="con-prefijo" style="width:150px"><span>$</span>
          <input type="number" inputmode="decimal" min="0" step="1" data-saldo="${i}" value="${pr.saldo}">
        </div>
        <button class="btn-icono" data-quitar="${i}" title="Quitar">&#10005;</button>
      </div>`).join('');

    cajaFilas.querySelectorAll('[data-nombre]').forEach((inp) =>
      inp.addEventListener('input', () => { lista[Number(inp.dataset.nombre)].nombre = inp.value; })
    );
    cajaFilas.querySelectorAll('[data-saldo]').forEach((inp) =>
      inp.addEventListener('input', () => { lista[Number(inp.dataset.saldo)].saldo = Number(inp.value) || 0; })
    );
    cajaFilas.querySelectorAll('[data-quitar]').forEach((b) =>
      b.addEventListener('click', () => {
        lista.splice(Number(b.dataset.quitar), 1);
        if (!lista.length) lista.push(vacio());
        pintarFilas();
      })
    );
  }
  pintarFilas();

  m.cuerpo.querySelector('[data-agregar]').addEventListener('click', () => {
    lista.push(vacio());
    pintarFilas();
    cajaFilas.querySelector(`[data-nombre="${lista.length - 1}"]`)?.focus();
  });

  m.cuerpo.querySelector('#pv-ok').onclick = async () => {
    const limpia = lista
      .filter((pr) => pr.nombre.trim())
      .map((pr) => ({ id: pr.id || crypto.randomUUID(), nombre: pr.nombre.trim(), saldo: Math.max(0, Number(pr.saldo) || 0) }));
    await guardarConfig({ proveedores: limpia });
    m.cerrar();
    aviso('Proveedores actualizados.');
    alGuardar?.();
  };
}

function dialogoMovimiento(alGuardar) {
  const m = modal('Nuevo movimiento', `
    <div class="campos campos--2">
      <div><label>Tipo</label><select id="mv-tipo"><option value="egreso">Gasto</option><option value="ingreso">Ingreso</option></select></div>
      <div><label>Fecha</label><input id="mv-fecha" type="date" value="${hoyISO()}"></div>
    </div>
    <div class="campo mt-16"><label>Concepto</label><input id="mv-concepto" placeholder="Ej. Compra de tela blackout"></div>
    <div class="campos campos--3">
      <div><label>Rubro</label><select id="mv-rubro"></select></div>
      <div><label>Sale de / entra en</label>
        <select id="mv-caja">
          ${Object.entries(CAJAS).map(([k, v]) => `<option value="${k}"${k === 'cuenta' ? ' selected' : ''}>${esc(v.nombre)}</option>`).join('')}
        </select>
      </div>
      <div><label>Monto</label><div class="con-prefijo"><span>$</span><input id="mv-monto" type="number" inputmode="decimal" min="0" step="1"></div></div>
    </div>
    <div class="campo mt-16"><label>Nota</label><input id="mv-nota" placeholder="Opcional"></div>
    <div class="fila-botones fila-botones--fin mt-16">
      <button class="btn btn--fantasma" data-cerrar>Cancelar</button>
      <button class="btn btn--primario" id="mv-ok">Guardar</button>
    </div>`, { ancho: '520px' });

  const selTipo = m.cuerpo.querySelector('#mv-tipo');
  const selRubro = m.cuerpo.querySelector('#mv-rubro');
  const pintarRubros = () => {
    const lista = selTipo.value === 'ingreso' ? RUBROS_INGRESO : RUBROS_EGRESO;
    selRubro.innerHTML = lista.map((r) => `<option>${r}</option>`).join('');
  };
  selTipo.addEventListener('change', pintarRubros);
  pintarRubros();

  m.cuerpo.querySelector('#mv-ok').onclick = async () => {
    const monto = leerNumero(m.cuerpo.querySelector('#mv-monto').value);
    const concepto = m.cuerpo.querySelector('#mv-concepto').value.trim();
    if (!monto || monto <= 0) return aviso('Poné un monto válido.', 'error');
    if (!concepto) return aviso('Escribí un concepto.', 'error');
    await guardar('movimientos', {
      tipo: selTipo.value,
      fecha: m.cuerpo.querySelector('#mv-fecha').value || hoyISO(),
      concepto,
      rubro: selRubro.value,
      caja: m.cuerpo.querySelector('#mv-caja').value,
      monto,
      nota: m.cuerpo.querySelector('#mv-nota').value,
    });
    m.cerrar();
    aviso('Movimiento guardado.');
    alGuardar?.();
  };
}

export { MEDIOS };
