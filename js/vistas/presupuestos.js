// Listado y detalle de presupuestos.

import { estado, guardar, borrar, obtener, proximoNumero } from '../store.js';
import { calcularTotales, descripcionItem } from '../calc.js';
import { plata, num, fecha, esc, aviso, confirmar, chip, vacio, ajuste, ESTADOS_PRESUPUESTO, sumarDias } from '../ui.js';
import { navegar } from '../router.js';
import { imprimirPresupuesto } from '../pdf.js';
import { armarMensaje, datosContado, copiar } from '../mensaje.js';
import { crearPedidoDesdePresupuesto } from './pedidos.js';

export function render(contenedor) {
  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div><h1>Presupuestos</h1><div class="sub">${estado.presupuestos.length} en total</div></div>
      <div class="der"><a class="btn btn--primario" href="#/cotizar">+ Nuevo presupuesto</a></div>
    </div>
    <div class="campos campos--2 mb-16">
      <input data-buscar placeholder="Buscar por cliente, número o dirección…">
      <select data-filtro>
        <option value="">Todos los estados</option>
        ${Object.entries(ESTADOS_PRESUPUESTO).map(([k, v]) => `<option value="${k}">${v.texto}</option>`).join('')}
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
    const items = estado.presupuestos
      .filter((p) => !f || p.estado === f)
      .filter((p) => {
        if (!q) return true;
        const texto = `${p.numero} ${p.cliente?.nombre} ${p.cliente?.direccion} ${p.cliente?.telefono}`.toLowerCase();
        return texto.includes(q);
      })
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

    if (!items.length) {
      lista.innerHTML = vacio(
        estado.presupuestos.length ? 'Ningún presupuesto coincide con la búsqueda.' : 'Todavía no cargaste presupuestos.',
        '<a class="btn btn--primario" href="#/cotizar">Crear el primero</a>'
      );
      return;
    }

    lista.innerHTML = items
      .map(
        (p) => `
      <div class="item-lista" data-id="${p.id}">
        <div class="item-lista__cuerpo">
          <div class="item-lista__titulo">${esc(p.cliente?.nombre || 'Sin nombre')} ${chip(ESTADOS_PRESUPUESTO, p.estado)}</div>
          <div class="mini">${esc(p.numero)} · ${fecha(p.fecha)} · ${p.cantidadCortinas || 0} cortina${p.cantidadCortinas === 1 ? '' : 's'}${p.cliente?.direccion ? ` · ${esc(p.cliente.direccion)}` : ''}</div>
        </div>
        <div class="item-lista__monto">${plata(p.total)}</div>
      </div>`
      )
      .join('');

    lista.querySelectorAll('[data-id]').forEach((n) =>
      n.addEventListener('click', () => navegar(`/presupuesto/${n.dataset.id}`))
    );
  }

  inputBuscar.addEventListener('input', pintar);
  selFiltro.addEventListener('change', pintar);
  pintar();
}

export function renderDetalle(contenedor, params) {
  const p = obtener('presupuestos', params.id);
  if (!p) {
    contenedor.innerHTML = vacio('No encontré ese presupuesto.', '<a class="btn" href="#/presupuestos">Volver al listado</a>');
    return;
  }

  const t = calcularTotales(p.items, estado.config, { descuentoPct: p.descuentoPct });
  const validez = sumarDias(p.fecha, p.validezDias ?? estado.config.empresa?.validezDias ?? 15);
  const pedidoLigado = estado.pedidos.find((o) => o.presupuestoId === p.id);
  const ctd = datosContado(p, estado.config, t.total);
  const mensajeCliente = armarMensaje(p, estado.config, t.total);

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div>
        <h1>${esc(p.numero)} ${chip(ESTADOS_PRESUPUESTO, p.estado)}</h1>
        <div class="sub">${esc(p.cliente?.nombre || 'Sin nombre')} · ${fecha(p.fecha)} · válido hasta ${fecha(validez)}</div>
      </div>
      <div class="der">
        <a class="btn" href="#/cotizar/${p.id}">Editar</a>
        <button class="btn" data-pdf>Descargar PDF</button>
      </div>
    </div>

    ${pedidoLigado ? `<div class="banner banner--info"><div>Este presupuesto ya se convirtió en el pedido <strong>${esc(pedidoLigado.numero)}</strong>.</div><a class="btn btn--chico" href="#/pedido/${pedidoLigado.id}">Ver pedido</a></div>` : ''}

    <div class="grid grid--2">
      <div class="tarjeta">
        <div class="tarjeta__cab"><h2>Cliente</h2></div>
        <table>
          <tbody>
            <tr><td class="mini">Nombre</td><td>${esc(p.cliente?.nombre || '—')}</td></tr>
            <tr><td class="mini">Teléfono</td><td>${p.cliente?.telefono ? `<a href="tel:${esc(p.cliente.telefono)}">${esc(p.cliente.telefono)}</a>` : '—'}</td></tr>
            <tr><td class="mini">Dirección</td><td>${esc(p.cliente?.direccion || '—')}${p.cliente?.ciudad ? `, ${esc(p.cliente.ciudad)}` : ''}</td></tr>
            <tr><td class="mini">Email</td><td>${esc(p.cliente?.email || '—')}</td></tr>
          </tbody>
        </table>
        ${p.cliente?.notas ? `<div class="mini mt-16"><strong>Notas internas:</strong> ${esc(p.cliente.notas)}</div>` : ''}
      </div>

      <div class="tarjeta">
        <div class="tarjeta__cab"><h2>Estado y acciones</h2></div>
        <div class="campo">
          <label>Estado del presupuesto</label>
          <select data-estado>
            ${Object.entries(ESTADOS_PRESUPUESTO).map(([k, v]) => `<option value="${k}"${p.estado === k ? ' selected' : ''}>${v.texto}</option>`).join('')}
          </select>
        </div>
        <div class="fila-botones mt-16">
          ${!pedidoLigado ? '<button class="btn btn--primario" data-convertir>Convertir en pedido</button>' : ''}
          ${p.cliente?.telefono ? '<button class="btn" data-whatsapp>Enviar por WhatsApp</button>' : ''}
          <button class="btn" data-duplicar>Duplicar</button>
          <button class="btn btn--peligro btn--chico" data-eliminar>Eliminar</button>
        </div>
      </div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <h2>Mensaje para el cliente</h2>
        <div class="der mini">contado: ${num(ctd.pct, 1)}% · producción ${num(ctd.plazo, 0)} días</div>
      </div>
      <div class="precios">
        <div class="precio">
          <div class="precio__etiqueta">Precio de lista</div>
          <div class="precio__valor">${plata(ctd.lista)}</div>
          <div class="mini">3 y 6 cuotas sin interés</div>
        </div>
        <div class="precio precio--contado">
          <div class="precio__etiqueta">Precio de contado</div>
          <div class="precio__valor">${plata(ctd.contado)}</div>
          <div class="mini">${ctd.manual != null ? 'puesto a mano' : `${num(ctd.pct, 1)}% de descuento`}</div>
        </div>
      </div>
      <div class="campo mt-16">
        <textarea data-msj rows="9" readonly style="min-height:190px">${esc(mensajeCliente)}</textarea>
      </div>
      <div class="fila-botones">
        <button class="btn btn--primario" data-copiar-msj>Copiar mensaje</button>
      </div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab"><h2>Detalle</h2></div>
      <div class="tabla-scroll">
        <table>
          <thead><tr><th>Ambiente</th><th>Tipo y tela</th><th class="num">Medidas</th><th class="num">m²</th><th class="num">Cant.</th><th class="num">Unitario</th><th class="num">Total</th></tr></thead>
          <tbody>
            ${t.lineas.map(({ item, calc }) => `
              <tr>
                <td>${esc(item.ambiente || '—')}${item.detalle ? `<div class="mini">${esc(item.detalle)}</div>` : ''}</td>
                <td>${esc({ roller: 'Roller', vertical: 'Bandas verticales', zebra: 'Zebra', tela_tradicional: 'Cortina Tela Tradicional' }[item.tipo] || item.tipo)}<div class="mini">${esc(descripcionItem(item) || item.tela)}</div></td>
                <td class="num">${num(calc.anchoM)} × ${num(calc.altoM)} m</td>
                <td class="num">${num(calc.m2)}</td>
                <td class="num">${calc.cantidad}</td>
                <td class="num">${plata(calc.precioUnitario)}</td>
                <td class="num"><strong>${plata(calc.total)}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="totales mt-16" style="max-width:320px;margin-left:auto">
        <div><span>Subtotal</span><strong>${plata(t.subtotal)}</strong></div>
        ${ajuste(t) ? `<div><span>${esc(ajuste(t).etiqueta)}</span><strong>${esc(ajuste(t).monto)}</strong></div>` : ''}
        ${t.montoIva ? `<div><span>IVA ${num(t.ivaPct, 0)}%</span><strong>${plata(t.montoIva)}</strong></div>` : ''}
        <div class="total"><span>Total</span><span>${plata(t.total)}</span></div>
        <div class="mini" style="margin-top:.5rem"><span>Ganancia estimada</span><span>${plata(t.ganancia)}</span></div>
      </div>
      ${p.notas ? `<div class="mt-16 mini"><strong>Observaciones:</strong> ${esc(p.notas)}</div>` : ''}
    </div>
  `;

  contenedor.querySelector('[data-estado]').addEventListener('change', async (e) => {
    await guardar('presupuestos', { ...p, estado: e.target.value });
    aviso('Estado actualizado.');
  });

  contenedor.querySelector('[data-pdf]').addEventListener('click', () => imprimirPresupuesto(p));

  contenedor.querySelector('[data-copiar-msj]').addEventListener('click', async (e) => {
    // Ojo: currentTarget queda en null apenas termina el despacho del evento,
    // así que hay que guardarlo antes del primer await.
    const btn = e.currentTarget;
    if (!(await copiar(contenedor.querySelector('[data-msj]').value))) {
      aviso('No pude copiar. Seleccioná el texto y copialo a mano.', 'error');
      return;
    }
    btn.textContent = '✓ Copiado';
    setTimeout(() => { btn.textContent = 'Copiar mensaje'; }, 1600);
  });

  contenedor.querySelector('[data-convertir]')?.addEventListener('click', async () => {
    if (!(await confirmar('¿Convertir este presupuesto en un pedido confirmado?', { textoOk: 'Convertir' }))) return;
    const pedido = await crearPedidoDesdePresupuesto(p);
    await guardar('presupuestos', { ...p, estado: 'confirmado' });
    aviso(`Pedido ${pedido.numero} creado.`);
    navegar(`/pedido/${pedido.id}`);
  });

  contenedor.querySelector('[data-whatsapp]')?.addEventListener('click', () => {
    const tel = String(p.cliente.telefono).replace(/\D/g, '');
    const emp = estado.config.empresa || {};
    const lineas = t.lineas.map(({ item, calc }) =>
      `• ${item.ambiente || 'Cortina'} — ${item.tela}, ${num(calc.anchoM)} × ${num(calc.altoM)} m${calc.cantidad > 1 ? ` (x${calc.cantidad})` : ''}: ${plata(calc.total)}`
    );
    const texto = [
      `Hola ${p.cliente.nombre}, te paso el presupuesto de ${emp.nombre || 'Zona Roller'} (${p.numero}):`,
      '',
      ...lineas,
      '',
      `Total: ${plata(t.total)}`,
      `Válido hasta el ${fecha(validez)}.`,
      emp.formaPago ? `\n${emp.formaPago}` : '',
    ].join('\n');
    window.open(`https://wa.me/${tel.length > 10 ? tel : `549${tel}`}?text=${encodeURIComponent(texto)}`, '_blank');
  });

  contenedor.querySelector('[data-duplicar]').addEventListener('click', async () => {
    const copia = {
      ...p,
      id: crypto.randomUUID(),
      numero: proximoNumero('presupuestos', 'P'),
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'borrador',
      creado: undefined,
    };
    copia.items = copia.items.map((it) => ({ ...it, id: crypto.randomUUID() }));
    const nuevo = await guardar('presupuestos', copia);
    aviso(`Copia creada: ${nuevo.numero}`);
    navegar(`/presupuesto/${nuevo.id}`);
  });

  contenedor.querySelector('[data-eliminar]').addEventListener('click', async () => {
    if (!(await confirmar(`¿Eliminar el presupuesto ${p.numero}? No se puede deshacer.`, { textoOk: 'Eliminar', peligro: true }))) return;
    await borrar('presupuestos', p.id);
    aviso('Presupuesto eliminado.');
    navegar('/presupuestos');
  });
}
