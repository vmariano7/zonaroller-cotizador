// Flujo de caja: qué falta cobrar, qué falta pagar y cómo viene el mes.

import { estado, guardar, borrar, guardarConfig } from '../store.js';
import { plata, fecha, esc, aviso, confirmar, modal, hoyISO, leerNumero, chip, capitalizar, ESTADOS_PEDIDO } from '../ui.js';
import { navegar } from '../router.js';
import { totalPedido, cobrado, saldo, costoInstalacion, saldosCaja, CAJAS, cajaDeMedio } from '../dinero.js';

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
      <div><h1>Caja</h1><div class="sub">Cobranzas, pagos pendientes y resultado del mes</div></div>
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

    // Movimientos del mes
    const pagosMes = activos.flatMap((p) =>
      (p.pagos || []).filter((g) => mesDe(g.fecha) === mes).map((g) => ({ ...g, pedido: p }))
    );
    const cobradoMes = pagosMes.reduce((a, g) => a + (Number(g.monto) || 0), 0);

    const movsMes = estado.movimientos.filter((m) => mesDe(m.fecha) === mes);
    const ingresosExtra = movsMes.filter((m) => m.tipo === 'ingreso').reduce((a, m) => a + (Number(m.monto) || 0), 0);
    const egresosMes = movsMes.filter((m) => m.tipo === 'egreso').reduce((a, m) => a + (Number(m.monto) || 0), 0);

    const ingresosMes = cobradoMes + ingresosExtra;
    const resultado = ingresosMes - egresosMes;

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
            <div class="kpi__pie">${plata(sc.base.efectivo)} de partida ${sc.movio.efectivo >= 0 ? '+' : '−'} ${plata(Math.abs(sc.movio.efectivo))}</div>
          </div>
          <div class="kpi kpi--verde">
            <div class="kpi__etiqueta">${esc(CAJAS.cuenta.nombre)}</div>
            <div class="kpi__valor">${plata(sc.cuenta)}</div>
            <div class="kpi__pie">${plata(sc.base.cuenta)} de partida ${sc.movio.cuenta >= 0 ? '+' : '−'} ${plata(Math.abs(sc.movio.cuenta))}</div>
          </div>
          <div class="kpi">
            <div class="kpi__etiqueta">Total disponible</div>
            <div class="kpi__valor">${plata(sc.total)}</div>
            <div class="kpi__pie">local y banco juntos</div>
          </div>
        </div>
        <div class="banner banner--info mt-16">
          <div>Los cobros que registrás en cada pedido entran solos, en efectivo o en la cuenta
          según el medio de pago. <strong>Los gastos no se descuentan solos</strong>: lo que le
          pagás al instalador y todo lo demás se carga con <em>+ Movimiento</em>.</div>
        </div>` : `
        <div class="mini">Todavía no cargaste el punto de partida, así que no puedo decirte cuánto tenés.</div>`}
      </div>

      <div class="kpis mb-16">
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
        <div class="kpi kpi--verde">
          <div class="kpi__etiqueta">Cobrado en el mes</div>
          <div class="kpi__valor">${plata(ingresosMes)}</div>
          <div class="kpi__pie">${nombreMes(mes)}</div>
        </div>
        <div class="kpi ${resultado >= 0 ? 'kpi--verde' : 'kpi--rojo'}">
          <div class="kpi__etiqueta">Resultado del mes</div>
          <div class="kpi__valor">${plata(resultado)}</div>
          <div class="kpi__pie">${plata(egresosMes)} en gastos</div>
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
      </div>

      <div class="tarjeta">
        <div class="tarjeta__cab">
          <span class="seccion-num">3</span><h2>Movimientos</h2>
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
        </div>
        <div class="totales mt-16" style="max-width:300px;margin-left:auto">
          <div><span>Ingresos</span><strong style="color:var(--verde)">${plata(ingresosMes)}</strong></div>
          <div><span>Egresos</span><strong style="color:var(--rojo)">${plata(egresosMes)}</strong></div>
          <div class="total"><span>Resultado</span><span>${plata(resultado)}</span></div>
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
