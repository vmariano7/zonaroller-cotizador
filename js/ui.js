// Utilidades compartidas de interfaz.

const fmtMoneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const fmtNumero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

export const plata = (n) => fmtMoneda.format(Math.round(Number(n) || 0));
export const num = (n, d = 2) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: d }).format(Number(n) || 0);
export const numero = (n) => fmtNumero.format(Number(n) || 0);

export function hoyISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function fecha(iso, { conHora = false } = {}) {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  const base = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (!conHora) return base;
  return `${base} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Mayúscula solo en la primera letra: "agosto de 2026" → "Agosto de 2026". */
export const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export function fechaLarga(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return capitalizar(d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));
}

export function sumarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + Number(dias || 0));
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Crea un elemento a partir de HTML. */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function $(sel, raiz = document) {
  return raiz.querySelector(sel);
}
export function $$(sel, raiz = document) {
  return [...raiz.querySelectorAll(sel)];
}

/* ---------- Avisos ---------- */

let contenedorAvisos;
export function aviso(mensaje, tipo = 'ok') {
  if (!contenedorAvisos) {
    contenedorAvisos = el('<div class="avisos"></div>');
    document.body.appendChild(contenedorAvisos);
  }
  const nodo = el(`<div class="aviso aviso--${tipo}">${esc(mensaje)}</div>`);
  contenedorAvisos.appendChild(nodo);
  setTimeout(() => {
    nodo.classList.add('aviso--saliendo');
    setTimeout(() => nodo.remove(), 300);
  }, tipo === 'error' ? 6000 : 3000);
}

/* ---------- Diálogos ---------- */

export function modal(titulo, contenidoHtml, { ancho = '640px' } = {}) {
  const fondo = el(`
    <div class="modal-fondo">
      <div class="modal" style="max-width:${ancho}">
        <header class="modal__cab">
          <h2>${esc(titulo)}</h2>
          <button class="btn-icono" data-cerrar aria-label="Cerrar">✕</button>
        </header>
        <div class="modal__cuerpo"></div>
      </div>
    </div>`);
  fondo.querySelector('.modal__cuerpo').innerHTML = contenidoHtml;
  document.body.appendChild(fondo);
  document.body.classList.add('sin-scroll');

  const cerrar = () => {
    fondo.remove();
    document.body.classList.remove('sin-scroll');
  };
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target.closest('[data-cerrar]')) cerrar();
  });
  document.addEventListener('keydown', function esc2(e) {
    if (e.key === 'Escape') {
      cerrar();
      document.removeEventListener('keydown', esc2);
    }
  });
  return { nodo: fondo, cuerpo: fondo.querySelector('.modal__cuerpo'), cerrar };
}

export function confirmar(mensaje, { textoOk = 'Confirmar', peligro = false } = {}) {
  return new Promise((resolve) => {
    const m = modal('Confirmar', `
      <p class="mb-16">${esc(mensaje)}</p>
      <div class="fila-botones">
        <button class="btn btn--fantasma" data-no>Cancelar</button>
        <button class="btn ${peligro ? 'btn--peligro' : 'btn--primario'}" data-si>${esc(textoOk)}</button>
      </div>`, { ancho: '420px' });
    m.cuerpo.querySelector('[data-no]').onclick = () => { m.cerrar(); resolve(false); };
    m.cuerpo.querySelector('[data-si]').onclick = () => { m.cerrar(); resolve(true); };
  });
}

/* ---------- Formularios ---------- */

/** Lee un valor numérico de un input aceptando coma decimal. */
export function leerNumero(valor) {
  if (valor === '' || valor === null || valor === undefined) return null;
  const n = Number(String(valor).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Lee plata escrita como se escribe acá: "23.829,75", "23829,75" o "23829.75".
 * Devuelve null cuando no hay nada escrito.
 *
 * El punto es ambiguo —puede ser de miles o decimal—, así que se decide por la
 * pinta: si hay coma, la coma es el decimal y los puntos son de miles; si no
 * hay coma, un solo punto con exactamente tres dígitos atrás también es de
 * miles ("23.829"), y en cualquier otro caso es decimal ("23.5").
 *
 * Esto está en vez de los <input type="number">: en castellano son una trampa,
 * porque el navegador descarta la coma y entrega el casillero vacío. Quien
 * escribía un precio bien puesto terminaba guardando un 0 sin enterarse.
 */
export function leerPrecio(texto) {
  const limpio = String(texto ?? '').trim().replace(/\s/g, '');
  if (limpio === '') return null;
  const puntos = (limpio.match(/\./g) || []).length;
  let normal;
  if (limpio.includes(',')) normal = limpio.replace(/\./g, '').replace(',', '.');
  else if (puntos > 1) normal = limpio.replace(/\./g, '');
  else normal = /\.\d{3}$/.test(limpio) ? limpio.replace('.', '') : limpio;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/**
 * Cómo se escribe un importe adentro de un casillero: "23.829,75". Lo que sale
 * de acá lo vuelve a leer leerPrecio tal cual.
 */
export function montoCampo(n) {
  const v = Number(n);
  return Number.isFinite(v) ? num(v, 2) : '';
}

export function descargarArchivo(nombre, contenido, tipo = 'application/json') {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ESTADOS_PRESUPUESTO = {
  borrador: { texto: 'Borrador', clase: 'gris' },
  enviado: { texto: 'Enviado', clase: 'azul' },
  confirmado: { texto: 'Confirmado', clase: 'verde' },
  rechazado: { texto: 'Rechazado', clase: 'rojo' },
};

export const ESTADOS_PEDIDO = {
  pendiente: { texto: 'Pendiente', clase: 'gris' },
  produccion: { texto: 'En producción', clase: 'amarillo' },
  listo: { texto: 'Listo para instalar', clase: 'azul' },
  instalado: { texto: 'Instalado', clase: 'verde' },
  cancelado: { texto: 'Cancelado', clase: 'rojo' },
};

/**
 * La medida de un renglón, en texto: los adicionales no tienen medida
 * (un solo casillero de m²) y las cortinas por ancho × alto.
 */
export function medidaTexto(item, calc) {
  if (item?.tipo === 'adicional') return '—';
  return `${num(calc.anchoM)} × ${num(calc.altoM)} m`;
}

export function chip(mapa, clave) {
  const e = mapa[clave] || { texto: clave || '—', clase: 'gris' };
  return `<span class="chip chip--${e.clase}">${esc(e.texto)}</span>`;
}

/**
 * Cómo mostrar el ajuste sobre el subtotal. Positivo es descuento; negativo
 * pasa cuando el precio acordado quedó por encima del calculado (redondeo
 * hacia arriba), y ahí decir "descuento" sería mentira.
 */
export function ajuste(totales) {
  if (!totales.montoDescuento) return null;
  const esDescuento = totales.montoDescuento > 0;
  return {
    etiqueta: `${esDescuento ? 'Descuento' : 'Ajuste'} ${num(Math.abs(totales.descuentoPct), 1)}%`,
    monto: `${esDescuento ? '−' : '+'} ${plata(Math.abs(totales.montoDescuento))}`,
  };
}

export function vacio(mensaje, accionHtml = '') {
  return `<div class="vacio"><p>${esc(mensaje)}</p>${accionHtml}</div>`;
}
