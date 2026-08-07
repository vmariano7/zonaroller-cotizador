// Editor compartido por presupuestos y pedidos: datos del cliente + lista de cortinas.

import { TIPOS, SISTEMAS, itemVacio, calcularItem, calcularTotales, sistemaAuto, hayPreciosCargados } from '../calc.js';
import { estado } from '../store.js';
import { el, esc, plata, num, leerNumero, hoyISO } from '../ui.js';

export function docVacio() {
  return {
    fecha: hoyISO(),
    cliente: { nombre: '', telefono: '', email: '', direccion: '', ciudad: 'Mendoza', notas: '' },
    items: [itemVacio()],
    descuentoPct: 0,
    notas: '',
  };
}

/**
 * Monta el editor dentro de `contenedor`.
 * Devuelve { leer(), totales() } para consultar el documento actualizado.
 */
export function montarEditor(contenedor, doc, { alCambiar } = {}) {
  // Durante el armado inicial no avisamos hacia afuera: quien nos llama todavía
  // no terminó de construir su propio estado.
  let montado = false;
  const avisar = () => { if (montado) alCambiar?.(modelo); };

  const modelo = JSON.parse(JSON.stringify(doc));
  if (!modelo.items?.length) modelo.items = [itemVacio()];
  modelo.items.forEach((it) => {
    if (!it.id) it.id = crypto.randomUUID();
  });

  contenedor.innerHTML = `
    <div class="tarjeta">
      <div class="tarjeta__cab"><span class="seccion-num">1</span><h2>Cliente</h2></div>
      <div class="campos campos--2">
        <div><label for="c-nombre">Nombre y apellido</label><input id="c-nombre" data-cli="nombre" autocomplete="name" placeholder="Ej. María González"></div>
        <div><label for="c-tel">Teléfono</label><input id="c-tel" data-cli="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="261 555 0000"></div>
        <div><label for="c-dir">Dirección</label><input id="c-dir" data-cli="direccion" autocomplete="street-address" placeholder="Calle 123, barrio"></div>
        <div><label for="c-ciu">Ciudad / zona</label><input id="c-ciu" data-cli="ciudad" placeholder="Mendoza"></div>
        <div><label for="c-mail">Email <span class="mini">(opcional)</span></label><input id="c-mail" data-cli="email" type="email" inputmode="email" autocomplete="email"></div>
        <div><label for="c-fecha">Fecha</label><input id="c-fecha" type="date" data-doc="fecha"></div>
      </div>
      <div class="campo mt-16"><label for="c-notas">Notas internas <span class="mini">(no salen en el PDF)</span></label><textarea id="c-notas" data-cli="notas" placeholder="Cómo llegó, referencias, detalles de la visita…"></textarea></div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">2</span><h2>Cortinas</h2>
      </div>
      <div data-items></div>
      <button class="btn btn--chico" data-agregar style="width:100%">+ Agregar otra cortina</button>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab"><span class="seccion-num">3</span><h2>Cierre</h2></div>
      <div class="campos campos--2">
        <div>
          <label for="c-desc">Descuento general</label>
          <div class="con-sufijo"><input id="c-desc" type="number" min="0" max="100" step="1" data-doc="descuentoPct" placeholder="0"><span>%</span></div>
        </div>
      </div>
      <div class="campo mt-16"><label for="c-obs">Observaciones para el cliente <span class="mini">(salen en el PDF)</span></label><textarea id="c-obs" data-doc="notas" placeholder="Ej. Plazo de entrega 15 días hábiles."></textarea></div>
      <div class="totales mt-16" data-totales></div>
    </div>
  `;

  const cajaItems = contenedor.querySelector('[data-items]');
  const cajaTotales = contenedor.querySelector('[data-totales]');

  // Cargar valores del cliente y del documento
  contenedor.querySelectorAll('[data-cli]').forEach((inp) => {
    inp.value = modelo.cliente?.[inp.dataset.cli] ?? '';
    inp.addEventListener('input', () => {
      modelo.cliente[inp.dataset.cli] = inp.value;
      avisar();
    });
  });
  contenedor.querySelectorAll('[data-doc]').forEach((inp) => {
    inp.value = modelo[inp.dataset.doc] ?? '';
    inp.addEventListener('input', () => {
      const clave = inp.dataset.doc;
      modelo[clave] = inp.type === 'number' ? leerNumero(inp.value) ?? 0 : inp.value;
      if (clave === 'descuentoPct') pintarTotales();
      avisar();
    });
  });

  contenedor.querySelectorAll('[data-agregar]').forEach((b) =>
    b.addEventListener('click', () => {
      const ultimo = modelo.items[modelo.items.length - 1];
      const nuevo = itemVacio(ultimo?.tipo || 'roller');
      if (ultimo) nuevo.tela = ultimo.tela;
      modelo.items.push(nuevo);
      pintarItems();
      const ultimoNodo = cajaItems.lastElementChild;
      ultimoNodo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ultimoNodo?.querySelector('[data-campo="ambiente"]')?.focus();
    })
  );

  function pintarItems() {
    cajaItems.innerHTML = '';
    modelo.items.forEach((item, i) => cajaItems.appendChild(nodoItem(item, i)));
    pintarTotales();
    avisar();
  }

  function nodoItem(item, indice) {
    const config = estado.config;
    const telas = TIPOS[item.tipo]?.telas || [];
    if (!telas.includes(item.tela)) item.tela = telas[0] || '';

    const nodo = el(`
      <div class="cortina" data-id="${item.id}">
        <div class="cortina__cab">
          <span class="cortina__n">${indice + 1}</span>
          <input data-campo="ambiente" placeholder="Ambiente (ej. Living, Dormitorio)" style="border:0;padding:.2rem 0;font-weight:600" value="${esc(item.ambiente)}">
          <button class="btn-icono" data-quitar title="Quitar cortina">&#10005;</button>
        </div>

        <div class="campos campos--2">
          <div>
            <label>Tipo de cortina</label>
            <select data-campo="tipo">
              ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}"${item.tipo === k ? ' selected' : ''}>${esc(v.nombre)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Tela</label>
            <select data-campo="tela">
              ${telas.map((t) => `<option value="${esc(t)}"${item.tela === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="campos campos--3 mt-16">
          <div>
            <label>Ancho</label>
            <div class="con-sufijo"><input data-campo="anchoCm" type="number" inputmode="decimal" min="0" step="1" placeholder="0" value="${item.anchoCm ?? ''}"><span>cm</span></div>
          </div>
          <div>
            <label>Alto</label>
            <div class="con-sufijo"><input data-campo="altoCm" type="number" inputmode="decimal" min="0" step="1" placeholder="0" value="${item.altoCm ?? ''}"><span>cm</span></div>
          </div>
          <div>
            <label>Cantidad</label>
            <input data-campo="cantidad" type="number" inputmode="numeric" min="1" step="1" value="${item.cantidad || 1}">
          </div>
        </div>

        <details class="mt-16">
          <summary class="mini" style="cursor:pointer">Opciones avanzadas</summary>
          <div class="campos campos--2 mt-16">
            <div>
              <label>Sistema</label>
              <select data-campo="sistemaKey">
                <option value="">Automático</option>
                ${Object.entries(SISTEMAS).map(([k, v]) => `<option value="${k}"${item.sistemaKey === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Detalle</label>
              <input data-campo="detalle" placeholder="Lado de cadena, comando, color…" value="${esc(item.detalle || '')}">
            </div>
          </div>
          <div class="check mt-16">
            <label class="switch">
              <input type="checkbox" data-campo="instalacion"${item.instalacion ? ' checked' : ''}>
              <span class="switch__pista"></span>
            </label>
            <span>Incluye instalación (${plata(config.instalacion)})</span>
          </div>
        </details>

        <div class="cortina__resumen" data-resumen></div>
      </div>
    `);

    nodo.querySelector('[data-quitar]').addEventListener('click', () => {
      if (modelo.items.length === 1) modelo.items = [itemVacio(item.tipo)];
      else modelo.items = modelo.items.filter((x) => x.id !== item.id);
      pintarItems();
    });

    nodo.querySelectorAll('[data-campo]').forEach((inp) => {
      const campo = inp.dataset.campo;
      const evento = inp.tagName === 'SELECT' || inp.type === 'checkbox' ? 'change' : 'input';
      inp.addEventListener(evento, () => {
        if (inp.type === 'checkbox') item[campo] = inp.checked;
        else if (inp.type === 'number') item[campo] = leerNumero(inp.value);
        else item[campo] = inp.value;

        if (campo === 'tipo') {
          item.tela = TIPOS[item.tipo].telas[0];
          item.sistemaKey = null;
          pintarItems();
          return;
        }
        pintarResumen(nodo, item);
        pintarTotales();
        avisar();
      });
    });

    pintarResumen(nodo, item);
    return nodo;
  }

  function pintarResumen(nodo, item) {
    const c = calcularItem(item, estado.config);
    const auto = sistemaAuto(item.tipo, item.tela, estado.config);
    const partes = [];
    partes.push(`${num(c.m2)} m²${c.aplicaMinimo ? ' <span class="mini">(mínimo)</span>' : ''}`);
    partes.push(`sistema ${esc(SISTEMAS[c.sistemaKey] || '—')}${item.sistemaKey && item.sistemaKey !== auto ? ' <span class="mini">(manual)</span>' : ''}`);
    if (c.incrementoPct) partes.push(`+${num(c.incrementoPct, 0)}%`);
    if (c.instalacionUnit) partes.push('instalación incluida');

    const sinPrecio = c.precioTela === 0 || c.precioSistema === 0;
    nodo.querySelector('[data-resumen]').innerHTML = `
      <span>${partes.join(' · ')}</span>
      <span class="cortina__precio">${plata(c.total)}${c.cantidad > 1 ? ` <span class="mini">(${c.cantidad} × ${plata(c.precioUnitario)})</span>` : ''}</span>
      ${sinPrecio ? '<div class="mini" style="color:var(--rojo);width:100%">Falta cargar el precio de esta tela o sistema en Configuración.</div>' : ''}
    `;
  }

  function pintarTotales() {
    const t = calcularTotales(modelo.items, estado.config, { descuentoPct: modelo.descuentoPct });
    const filas = [];
    filas.push(`<div><span>Subtotal (${t.cantidadCortinas} cortina${t.cantidadCortinas === 1 ? '' : 's'})</span><strong>${plata(t.subtotal)}</strong></div>`);
    if (t.montoDescuento) filas.push(`<div><span>Descuento ${num(t.descuentoPct, 0)}%</span><strong>&minus; ${plata(t.montoDescuento)}</strong></div>`);
    if (t.montoIva) filas.push(`<div><span>IVA ${num(t.ivaPct, 0)}%</span><strong>${plata(t.montoIva)}</strong></div>`);
    filas.push(`<div class="total"><span>Total</span><span>${plata(t.total)}</span></div>`);
    filas.push(`<div class="mini" style="margin-top:.5rem"><span>Ganancia estimada</span><span>${plata(t.ganancia)}</span></div>`);
    cajaTotales.innerHTML = filas.join('');
    return t;
  }

  pintarItems();

  if (!hayPreciosCargados(estado.config)) {
    contenedor.prepend(
      el('<div class="banner banner--aviso"><div>Todavía no cargaste tus costos, así que todo va a dar $0. Andá a <strong>Ajustes</strong> para cargarlos.</div></div>')
    );
  }

  montado = true;

  return {
    leer: () => JSON.parse(JSON.stringify(modelo)),
    totales: () => calcularTotales(modelo.items, estado.config, { descuentoPct: modelo.descuentoPct }),
  };
}
