// Editor compartido por presupuestos y pedidos.
// El orden importa: primero las cortinas (que es lo que se cotiza a diario) y
// los datos del cliente arriba, plegados, para que no tapen lo principal.

import { TIPOS, SISTEMAS, ARMADO, ARMADO_POR_TIPO, itemVacio, calcularItem, calcularTotales, sistemaAuto, hayPreciosCargados, descripcionItem, detallesTecnicos } from '../calc.js';
import { estado } from '../store.js';
import { el, esc, plata, num, leerNumero, hoyISO, ajuste, aviso } from '../ui.js';
import { armarMensaje, datosContado, copiar } from '../mensaje.js';
import { sugerencias } from './clientes.js';

export function docVacio() {
  return {
    fecha: hoyISO(),
    cliente: { nombre: '', telefono: '', email: '', direccion: '', ciudad: 'Mendoza', notas: '' },
    items: [itemVacio()],
    descuentoPct: 0,
    notas: '',
  };
}

/* ---------- Íconos de cada tipo de cortina ---------- */

const ICONOS = {
  roller: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
    <rect x="3.5" y="3" width="17" height="2.5" rx="1" fill="currentColor" stroke="none"/>
    <rect x="4.5" y="5.5" width="15" height="12.5" rx=".5"/>
    <path d="M4.5 9h15M4.5 12h15M4.5 15h15" opacity=".45"/>
    <path d="M7.5 18v2.5M16.5 18v2.5" opacity=".45"/></svg>`,
  vertical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
    <rect x="3.5" y="3" width="17" height="2.5" rx="1" fill="currentColor" stroke="none"/>
    <rect x="4.5" y="5.5" width="15" height="15" rx=".5"/>
    <path d="M8.25 5.5v15M12 5.5v15M15.75 5.5v15"/></svg>`,
  zebra: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
    <rect x="3.5" y="3" width="17" height="2.5" rx="1" fill="currentColor" stroke="none"/>
    <rect x="4.5" y="5.5" width="15" height="15" rx=".5"/>
    <path d="M4.5 8h15M4.5 13h15M4.5 18h15" stroke-width="2.6" opacity=".3"/></svg>`,
  tela_tradicional: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.5 4h19" stroke-width="1.8"/>
    <path d="M4.5 4v14.5c.9 0 .9 2 1.8 2s.9-2 1.8-2 .9 2 1.8 2V4"/>
    <path d="M19.5 4v14.5c-.9 0-.9 2-1.8 2s-.9-2-1.8-2-.9 2-1.8 2V4"/></svg>`,
};

/**
 * Monta el editor dentro de `contenedor`.
 * Devuelve { leer(), totales(), enfocarCliente() }.
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
    <div class="plegable" data-cliente>
      <button type="button" class="plegable__cab" data-abrir-cliente aria-expanded="false">
        <svg class="plegable__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"/>
        </svg>
        <span class="plegable__texto">
          <strong>Datos del cliente</strong>
          <span class="mini" data-resumen-cliente></span>
        </span>
        <svg class="plegable__flecha" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l5 5 5-5"/></svg>
      </button>
      <div class="plegable__cuerpo" hidden>
        <div class="campos campos--2">
          <div>
            <label for="c-nombre">Nombre y apellido</label>
            <input id="c-nombre" data-cli="nombre" autocomplete="off" list="zr-clientes" placeholder="Ej. María González">
            <datalist id="zr-clientes">${sugerencias().map((s) => `<option value="${esc(s.nombre)}">`).join('')}</datalist>
          </div>
          <div><label for="c-tel">Teléfono</label><input id="c-tel" data-cli="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="261 555 0000"></div>
          <div><label for="c-dir">Dirección</label><input id="c-dir" data-cli="direccion" autocomplete="street-address" placeholder="Calle 123, barrio"></div>
          <div><label for="c-ciu">Ciudad / zona</label><input id="c-ciu" data-cli="ciudad" placeholder="Mendoza"></div>
          <div><label for="c-mail">Email <span class="mini">(opcional)</span></label><input id="c-mail" data-cli="email" type="email" inputmode="email" autocomplete="email"></div>
          <div><label for="c-fecha">Fecha</label><input id="c-fecha" type="date" data-doc="fecha"></div>
        </div>
        <div class="campo mt-16"><label for="c-notas">Notas internas <span class="mini">(no salen en el PDF)</span></label><textarea id="c-notas" data-cli="notas" placeholder="Cómo llegó, referencias, detalles de la visita…"></textarea></div>
      </div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">1</span><h2>Cortinas</h2>
      </div>
      <div data-items></div>
      <button class="btn btn--chico" data-agregar style="width:100%">+ Agregar otra cortina</button>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab"><span class="seccion-num">2</span><h2>Cierre</h2></div>
      <div class="campos campos--2">
        <div>
          <label for="c-desc">Descuento general</label>
          <div class="con-sufijo"><input id="c-desc" type="number" min="0" max="100" step="1" data-doc="descuentoPct" placeholder="0"><span>%</span></div>
        </div>
      </div>
      <div class="campo mt-16"><label for="c-obs">Observaciones para el cliente <span class="mini">(salen en el PDF)</span></label><textarea id="c-obs" data-doc="notas" placeholder="Ej. Plazo de entrega 15 días hábiles."></textarea></div>
      <div class="totales mt-16" data-totales></div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">3</span>
        <div><h2>Mensaje para el cliente</h2><div class="mini">Se arma solo con los precios de acá abajo.</div></div>
      </div>
      <div class="precios">
        <div class="precio">
          <div class="precio__etiqueta">Precio de lista</div>
          <div class="precio__valor" data-precio-lista>—</div>
          <div class="mini">3 y 6 cuotas sin interés</div>
        </div>
        <div class="precio precio--contado">
          <div class="precio__etiqueta">Precio de contado</div>
          <div class="precio__valor" data-precio-contado>—</div>
          <div class="mini" data-pie-contado></div>
        </div>
      </div>
      <div class="campos campos--3 mt-16">
        <div>
          <label for="c-ctd-pct">Descuento de contado</label>
          <div class="con-sufijo"><input id="c-ctd-pct" type="number" min="0" max="100" step="1" data-doc="contadoPct"><span>%</span></div>
        </div>
        <div>
          <label for="c-ctd-plazo">Plazo de producción</label>
          <div class="con-sufijo"><input id="c-ctd-plazo" type="number" min="0" step="1" data-doc="contadoPlazoDias"><span>días</span></div>
        </div>
        <div>
          <label for="c-ctd-man">Contado a mano <span class="mini">(vacío = automático)</span></label>
          <div class="con-prefijo"><span>$</span><input id="c-ctd-man" type="number" min="0" step="1" data-doc="contadoManual" placeholder="automático"></div>
        </div>
      </div>
      <div class="campo mt-16">
        <label for="c-msj">Texto listo para mandar</label>
        <textarea id="c-msj" data-mensaje rows="9" readonly style="min-height:190px"></textarea>
      </div>
      <div class="fila-botones">
        <button class="btn btn--primario" data-copiar>Copiar mensaje</button>
        <a class="btn" data-wsp target="_blank" rel="noopener">Mandar por WhatsApp</a>
      </div>
    </div>
  `;

  const cajaItems = contenedor.querySelector('[data-items]');
  const cajaTotales = contenedor.querySelector('[data-totales]');
  const panelCliente = contenedor.querySelector('[data-cliente]');
  const botonCliente = contenedor.querySelector('[data-abrir-cliente]');
  const cuerpoCliente = panelCliente.querySelector('.plegable__cuerpo');
  const resumenCliente = contenedor.querySelector('[data-resumen-cliente]');

  /* ---------- Panel del cliente ---------- */

  function abrirCliente(abierto) {
    cuerpoCliente.hidden = !abierto;
    botonCliente.setAttribute('aria-expanded', String(abierto));
    panelCliente.classList.toggle('plegable--abierto', abierto);
  }
  botonCliente.addEventListener('click', () => abrirCliente(cuerpoCliente.hidden));

  function pintarResumenCliente() {
    const c = modelo.cliente || {};
    const partes = [c.telefono, c.direccion].filter(Boolean);
    resumenCliente.textContent = c.nombre?.trim()
      ? `${c.nombre}${partes.length ? ` · ${partes.join(' · ')}` : ''}`
      : 'Sin cargar — tocá para completar';
  }

  // Si ya viene un cliente cargado (editando), lo dejamos plegado igual: el
  // resumen de la cabecera ya dice quién es.
  abrirCliente(false);

  /* ---------- Cliente y documento ---------- */

  contenedor.querySelectorAll('[data-cli]').forEach((inp) => {
    inp.value = modelo.cliente?.[inp.dataset.cli] ?? '';
    inp.addEventListener('input', () => {
      modelo.cliente[inp.dataset.cli] = inp.value;
      pintarResumenCliente();
      pintarMensaje();
      avisar();
    });
  });

  // Si elegís un cliente conocido, completamos lo que esté vacío.
  const campoNombre = contenedor.querySelector('#c-nombre');
  const completarCliente = () => {
    const buscado = campoNombre.value.trim().toLowerCase();
    if (!buscado) return;
    const s = sugerencias().find((x) => x.nombre.trim().toLowerCase() === buscado);
    if (!s) return;
    [['telefono', '#c-tel'], ['direccion', '#c-dir'], ['ciudad', '#c-ciu'], ['email', '#c-mail']].forEach(([campo, sel]) => {
      const inp = contenedor.querySelector(sel);
      if (inp && !inp.value.trim() && s[campo]) {
        inp.value = s[campo];
        modelo.cliente[campo] = s[campo];
      }
    });
    pintarResumenCliente();
    avisar();
  };
  campoNombre.addEventListener('change', completarCliente);
  campoNombre.addEventListener('blur', completarCliente);

  // Los valores de contado arrancan de Configuración, pero quedan guardados en
  // el documento: si mañana cambiás el descuento general, el presupuesto de hoy
  // sigue diciendo lo que le dijiste al cliente.
  const cfgContado = estado.config.contado || {};
  if (modelo.contadoPct == null) modelo.contadoPct = Number(cfgContado.descuentoPct ?? 35);
  if (modelo.contadoPlazoDias == null) modelo.contadoPlazoDias = Number(cfgContado.plazoDias ?? 5);

  contenedor.querySelectorAll('[data-doc]').forEach((inp) => {
    const clave = inp.dataset.doc;
    inp.value = modelo[clave] ?? '';
    inp.addEventListener('input', () => {
      if (inp.type === 'number') modelo[clave] = inp.value === '' ? null : Number(inp.value);
      else modelo[clave] = inp.value;
      if (clave === 'descuentoPct') pintarTotales();
      pintarMensaje();
      avisar();
    });
  });

  contenedor.querySelectorAll('[data-agregar]').forEach((b) =>
    b.addEventListener('click', () => {
      const ultimo = modelo.items[modelo.items.length - 1];
      const nuevo = itemVacio(ultimo?.tipo || 'roller');
      if (ultimo) {
        nuevo.tela = ultimo.tela;
        // El armado se repite entre cortinas de la misma casa casi siempre.
        (ARMADO_POR_TIPO[nuevo.tipo] || []).forEach((k) => { if (ultimo[k]) nuevo[k] = ultimo[k]; });
      }
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
    const esTelaTradicional = item.tipo === 'tela_tradicional';
    const telas = TIPOS[item.tipo]?.telas || [];
    if (!telas.includes(item.tela)) item.tela = telas[0] || '';

    if (esTelaTradicional) {
      const t = TIPOS.tela_tradicional;
      if (!t.colores.includes(item.color)) item.color = t.colores[0];
      if (!t.recogimientos.includes(item.recogimiento)) item.recogimiento = t.recogimientos[0];
      if (!t.pliegues.includes(item.pliegue)) item.pliegue = t.pliegues[0];
      if (!t.rieles.includes(item.riel)) item.riel = t.rieles[0];
      if (!item.rielColor) item.rielColor = 'BLANCO';
      if (![1, 2].includes(Number(item.cantPaños))) item.cantPaños = 1;
    }

    const tarjetasTipo = `
        <div class="tipos">
          ${Object.entries(TIPOS).map(([clave, def]) => `
            <button type="button" class="tipo" data-tipo="${clave}" aria-pressed="${item.tipo === clave}">
              <span class="tipo__icono">${ICONOS[clave] || ''}</span>
              <span class="tipo__nombre">${esc(def.nombre)}</span>
            </button>`).join('')}
        </div>`;

    // Lo principal, igual para todos los tipos: tela y medidas, cuatro casilleros.
    // Lo único que cambia es la unidad — la tela tradicional se mide en metros.
    const enMetros = esTelaTradicional;
    const campoAncho = enMetros
      ? `<input data-campo="anchoM" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" value="${item.anchoM ?? ''}"><span>m</span>`
      : `<input data-campo="anchoCm" type="number" inputmode="decimal" min="0" step="1" placeholder="0" value="${item.anchoCm ?? ''}"><span>cm</span>`;
    const campoAlto = enMetros
      ? `<input data-campo="altoM" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" value="${item.altoM ?? ''}"><span>m</span>`
      : `<input data-campo="altoCm" type="number" inputmode="decimal" min="0" step="1" placeholder="0" value="${item.altoCm ?? ''}"><span>cm</span>`;

    const camposMedidas = `
        <div class="campos campos--4 mt-16">
          <div>
            <label>Tipo de tela</label>
            <select data-campo="tela">
              ${telas.map((t) => `<option value="${esc(t)}"${item.tela === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Ancho</label>
            <div class="con-sufijo">${campoAncho}</div>
          </div>
          <div>
            <label>Alto</label>
            <div class="con-sufijo">${campoAlto}</div>
          </div>
          <div>
            <label>Cantidad</label>
            <input data-campo="cantidad" type="number" inputmode="numeric" min="1" step="1" value="${item.cantidad || 1}">
          </div>
        </div>
    `;

    const selectArmado = (campo) => {
      const def = ARMADO[campo];
      return `
            <div>
              <label>${esc(def.etiqueta)}</label>
              <select data-campo="${campo}">
                <option value="">Sin especificar</option>
                ${def.valores.map((v) => `<option value="${esc(v)}"${item[campo] === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}
              </select>
            </div>`;
    };

    const selectLista = (campo, etiqueta, valores, actual) => `
            <div>
              <label>${esc(etiqueta)}</label>
              <select data-campo="${campo}">
                ${valores.map((v) => `<option value="${esc(v)}"${String(actual) === String(v) ? ' selected' : ''}>${esc(v)}</option>`).join('')}
              </select>
            </div>`;

    // Lo específico de cada tipo va acá adentro: afuera quedan siempre los
    // mismos cuatro casilleros.
    const tt = TIPOS.tela_tradicional;
    const especificas = esTelaTradicional ? `
          <div class="campos campos--4 mt-16">
            ${selectLista('color', 'Color', tt.colores, item.color)}
            ${selectLista('cantPaños', 'Cant. paños', tt.paños, item.cantPaños)}
            ${selectLista('recogimiento', 'Recogimiento', tt.recogimientos, item.recogimiento)}
            ${selectLista('pliegue', 'Tipo de pliegue', tt.pliegues, item.pliegue)}
          </div>
          <div class="campos campos--2 mt-16">
            ${selectLista('riel', 'Riel', tt.rieles, item.riel)}
            <div>
              <label>Riel color</label>
              <input data-campo="rielColor" placeholder="BLANCO" value="${esc(item.rielColor || '')}">
            </div>
          </div>
    ` : `
          <div class="campos campos--4 mt-16">
            ${(ARMADO_POR_TIPO[item.tipo] || []).map(selectArmado).join('')}
          </div>
          <div class="campos campos--2 mt-16">
            <div>
              <label>Sistema para el costo <span class="mini">(no es el caño)</span></label>
              <select data-campo="sistemaKey">
                <option value="">Automático</option>
                ${Object.entries(SISTEMAS).map(([k, v]) => `<option value="${k}"${item.sistemaKey === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Detalle</label>
              <input data-campo="detalle" placeholder="Cualquier otra aclaración…" value="${esc(item.detalle || '')}">
            </div>
          </div>
    `;

    const opcionesAvanzadas = `
        <details class="avanzadas mt-16">
          <summary>Opciones avanzadas <span class="mini" data-armado></span></summary>
          ${especificas}
          ${esTelaTradicional ? `
          <div class="campo mt-16">
            <label>Detalle</label>
            <input data-campo="detalle" placeholder="Observaciones adicionales…" value="${esc(item.detalle || '')}">
          </div>` : ''}
          <div class="check mt-16">
            <label class="switch">
              <input type="checkbox" data-campo="instalacion"${item.instalacion ? ' checked' : ''}>
              <span class="switch__pista"></span>
            </label>
            <span>Incluye instalación (${plata(config.instalacion)})</span>
          </div>
        </details>
    `;

    const nodo = el(`
      <div class="cortina" data-id="${item.id}">
        <div class="cortina__cab">
          <span class="cortina__n">${String(indice + 1).padStart(2, '0')}</span>
          <input data-campo="ambiente" class="cortina__ambiente" placeholder="Ambiente (ej. Living, Dormitorio)" value="${esc(item.ambiente)}">
          <button class="btn-icono" data-quitar title="Quitar cortina">&#10005;</button>
        </div>

        ${tarjetasTipo}
        ${camposMedidas}
        ${opcionesAvanzadas}

        <div class="cortina__resumen" data-resumen></div>
      </div>
    `);

    nodo.querySelector('[data-quitar]').addEventListener('click', () => {
      if (modelo.items.length === 1) modelo.items = [itemVacio(item.tipo)];
      else modelo.items = modelo.items.filter((x) => x.id !== item.id);
      pintarItems();
    });

    nodo.querySelectorAll('[data-tipo]').forEach((b) =>
      b.addEventListener('click', () => {
        if (item.tipo === b.dataset.tipo) return;
        // Cambiar de tipo cambia los campos: rearmamos el renglón desde cero
        // conservando lo que sí sigue teniendo sentido.
        const base = itemVacio(b.dataset.tipo);
        modelo.items[indice] = {
          ...base,
          id: item.id,
          ambiente: item.ambiente,
          cantidad: item.cantidad,
          instalacion: item.instalacion,
          detalle: item.detalle,
        };
        pintarItems();
      })
    );

    nodo.querySelectorAll('[data-campo]').forEach((inp) => {
      const campo = inp.dataset.campo;
      const evento = inp.tagName === 'SELECT' || inp.type === 'checkbox' ? 'change' : 'input';
      inp.addEventListener(evento, () => {
        if (inp.type === 'checkbox') item[campo] = inp.checked;
        // Los <input type="number"> del navegador siempre usan punto decimal,
        // nunca separador de miles: leerNumero (pensado para texto con formato
        // argentino) los rompería, ej. "1.2" → 12.
        else if (inp.type === 'number') item[campo] = inp.value === '' ? null : Number(inp.value);
        else if (campo === 'cantPaños') item[campo] = leerNumero(inp.value) || 1;
        else item[campo] = inp.value;

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
    const partes = [];
    let sinPrecio = false;

    if (item.tipo === 'tela_tradicional') {
      partes.push(`${num(c.anchoM)} × ${num(c.altoM)} m`);
      if (item.riel) partes.push(esc(item.riel));
      if (item.recogimiento) partes.push(esc(item.recogimiento));
      if (c.instalacionUnit) partes.push('instalación incluida');
      const descripcion = descripcionItem(item);
      if (descripcion) partes.unshift(`<span class="mini">${esc(descripcion)}</span>`);
    } else {
      const auto = sistemaAuto(item.tipo, item.tela, estado.config);
      partes.push(`${num(c.m2)} m²${c.aplicaMinimo ? ' <span class="mini">(mínimo)</span>' : ''}`);
      partes.push(`sistema ${esc(SISTEMAS[c.sistemaKey] || '—')}${item.sistemaKey && item.sistemaKey !== auto ? ' <span class="mini">(manual)</span>' : ''}`);
      if (c.incrementoPct) partes.push(`+${num(c.incrementoPct, 0)}%`);
      if (c.instalacionUnit) partes.push('instalación incluida');
      sinPrecio = c.precioTela === 0 || c.precioSistema === 0;
    }

    // Con el bloque plegado igual se ve cómo va armada la cortina.
    const armado = nodo.querySelector('[data-armado]');
    if (armado) armado.textContent = detallesTecnicos(item).join(' · ');

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
    const aj = ajuste(t);
    if (aj) filas.push(`<div><span>${esc(aj.etiqueta)}</span><strong>${esc(aj.monto)}</strong></div>`);
    if (t.montoIva) filas.push(`<div><span>IVA ${num(t.ivaPct, 0)}%</span><strong>${plata(t.montoIva)}</strong></div>`);
    filas.push(`<div class="total"><span>Total</span><span>${plata(t.total)}</span></div>`);
    filas.push(`<div class="mini" style="margin-top:.5rem"><span>Ganancia estimada</span><span>${plata(t.ganancia)}</span></div>`);
    cajaTotales.innerHTML = filas.join('');
    pintarMensaje(t);
    return t;
  }

  /* ---------- Mensaje al cliente ---------- */

  const cajaMensaje = contenedor.querySelector('[data-mensaje]');
  const enlaceWsp = contenedor.querySelector('[data-wsp]');

  function pintarMensaje(totales) {
    const t = totales || calcularTotales(modelo.items, estado.config, { descuentoPct: modelo.descuentoPct });
    const d = datosContado(modelo, estado.config, t.total);
    contenedor.querySelector('[data-precio-lista]').textContent = plata(d.lista);
    contenedor.querySelector('[data-precio-contado]').textContent = plata(d.contado);
    contenedor.querySelector('[data-pie-contado]').textContent =
      d.manual != null ? 'puesto a mano' : `${num(d.pct, 1)}% de descuento`;

    const texto = armarMensaje(modelo, estado.config, t.total);
    cajaMensaje.value = texto;

    // El teléfono puede venir con espacios, guiones o paréntesis. Los celulares
    // argentinos van con 549 adelante; si ya trae el país, lo dejamos como está.
    const tel = String(modelo.cliente?.telefono || '').replace(/\D/g, '');
    if (tel.length >= 8) {
      enlaceWsp.href = `https://wa.me/${tel.length > 10 ? tel : `549${tel}`}?text=${encodeURIComponent(texto)}`;
      enlaceWsp.removeAttribute('aria-disabled');
      enlaceWsp.classList.remove('btn--inactivo');
      enlaceWsp.title = '';
    } else {
      enlaceWsp.removeAttribute('href');
      enlaceWsp.setAttribute('aria-disabled', 'true');
      enlaceWsp.classList.add('btn--inactivo');
      enlaceWsp.title = 'Cargá el teléfono del cliente para habilitarlo';
    }
  }

  contenedor.querySelector('[data-copiar]').addEventListener('click', async (e) => {
    // Ojo: currentTarget queda en null apenas termina el despacho del evento,
    // así que hay que guardarlo antes del primer await.
    const btn = e.currentTarget;
    const previo = btn.textContent;
    if (!(await copiar(cajaMensaje.value))) {
      aviso('No pude copiar. Seleccioná el texto y copialo a mano.', 'error');
      return;
    }
    btn.textContent = '✓ Copiado';
    setTimeout(() => { btn.textContent = previo; }, 1600);
  });

  pintarItems();
  pintarResumenCliente();

  if (!hayPreciosCargados(estado.config)) {
    contenedor.prepend(
      el('<div class="banner banner--aviso"><div>Todavía no cargaste tus costos, así que todo va a dar $0. Andá a <strong>Ajustes</strong> para cargarlos.</div></div>')
    );
  }

  montado = true;

  return {
    leer: () => JSON.parse(JSON.stringify(modelo)),
    totales: () => calcularTotales(modelo.items, estado.config, { descuentoPct: modelo.descuentoPct }),
    /** Abre el panel plegado y pone el cursor en el nombre. */
    enfocarCliente: () => {
      abrirCliente(true);
      panelCliente.scrollIntoView({ behavior: 'smooth', block: 'center' });
      campoNombre.focus();
    },
  };
}
