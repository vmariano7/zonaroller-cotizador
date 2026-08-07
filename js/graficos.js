// Gráficos en SVG puro, sin librerías.
//
// La paleta está validada contra el fondo blanco de las tarjetas:
// separación bajo daltonismo ΔE 9,2 en el peor par y ΔE 24 a visión normal.
// El verde agua queda por debajo de 3:1 de contraste, así que estos gráficos
// siempre llevan leyenda y una vista de tabla — la identidad nunca depende
// solo del color.

import { plata, num, esc } from './ui.js';

export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];
const TINTA = '#0b0b0b';
const TINTA_2 = '#52514e';
const MUTE = '#898781';
const GRILLA = '#e1e0d9';
const EJE = '#c3c2b7';

/** Elige una escala redonda para el eje: 4 pasos que cubran el máximo. */
function escala(maximo) {
  if (maximo <= 0) return { tope: 1000, pasos: [0, 250, 500, 750, 1000] };
  const crudo = maximo / 4;
  const magnitud = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((p) => p >= crudo) || magnitud * 10;
  const tope = paso * 4;
  return { tope, pasos: [0, paso, paso * 2, paso * 3, tope] };
}

function abreviar(n) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${num(n / 1_000_000, 1)}M`;
  if (a >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

/* ---------- Tooltip compartido ---------- */

let globo;
function mostrarGlobo(host, x, y, html) {
  if (!globo) {
    globo = document.createElement('div');
    globo.className = 'globo';
    document.body.appendChild(globo);
  }
  globo.innerHTML = html;
  globo.style.display = 'block';
  const caja = host.getBoundingClientRect();
  const g = globo.getBoundingClientRect();
  let izq = caja.left + x - g.width / 2;
  izq = Math.max(8, Math.min(izq, window.innerWidth - g.width - 8));
  let arriba = caja.top + y - g.height - 12;
  if (arriba < 8) arriba = caja.top + y + 16;
  globo.style.left = `${izq}px`;
  globo.style.top = `${arriba + window.scrollY}px`;
}

function ocultarGlobo() {
  if (globo) globo.style.display = 'none';
}

/* ---------- Columnas apiladas ---------- */

/**
 * @param {HTMLElement} contenedor
 * @param {{etiquetas: string[], series: {nombre: string, valores: number[]}[], formato?: Function}} datos
 */
export function columnasApiladas(contenedor, { etiquetas, series, formato = plata, titulo = '' }) {
  const W = 720;
  const H = 260;
  const M = { arriba: 12, derecha: 8, abajo: 28, izquierda: 46 };
  const anchoUtil = W - M.izquierda - M.derecha;
  const altoUtil = H - M.arriba - M.abajo;

  const totales = etiquetas.map((_, i) => series.reduce((a, s) => a + (s.valores[i] || 0), 0));
  const { tope, pasos } = escala(Math.max(...totales, 0));
  const aY = (v) => M.arriba + altoUtil - (v / tope) * altoUtil;

  const paso = anchoUtil / etiquetas.length;
  const anchoBarra = Math.min(38, paso * 0.62);

  const grilla = pasos
    .map(
      (p) => `
      <line x1="${M.izquierda}" y1="${aY(p)}" x2="${W - M.derecha}" y2="${aY(p)}"
            stroke="${p === 0 ? EJE : GRILLA}" stroke-width="1" shape-rendering="crispEdges"/>
      <text x="${M.izquierda - 8}" y="${aY(p) + 4}" text-anchor="end" font-size="10" fill="${MUTE}">${abreviar(p)}</text>`
    )
    .join('');

  const columnas = etiquetas
    .map((etq, i) => {
      const cx = M.izquierda + paso * i + paso / 2;
      const x = cx - anchoBarra / 2;
      let acumulado = 0;
      const segmentos = series
        .map((s, si) => {
          const v = s.valores[i] || 0;
          if (v <= 0) return '';
          const y0 = aY(acumulado);
          acumulado += v;
          const y1 = aY(acumulado);
          // 2px de aire entre segmentos apilados; el de más arriba lleva punta redondeada.
          const esUltimo = series.slice(si + 1).every((o) => (o.valores[i] || 0) <= 0);
          const alto = Math.max(1, y0 - y1 - (esUltimo ? 0 : 2));
          const r = esUltimo ? Math.min(4, alto / 2, anchoBarra / 2) : 0;
          return `<path d="M${x},${y1 + alto} L${x},${y1 + r} Q${x},${y1} ${x + r},${y1} L${x + anchoBarra - r},${y1} Q${x + anchoBarra},${y1} ${x + anchoBarra},${y1 + r} L${x + anchoBarra},${y1 + alto} Z" fill="${SERIES[si % SERIES.length]}"/>`;
        })
        .join('');

      return `
        <g>${segmentos}</g>
        <rect class="zona" data-i="${i}" x="${M.izquierda + paso * i}" y="${M.arriba}" width="${paso}" height="${altoUtil}" fill="transparent"/>
        <text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10" fill="${MUTE}">${esc(etq)}</text>`;
    })
    .join('');

  contenedor.innerHTML = `
    <div class="grafico">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo || 'Gráfico de columnas')}" preserveAspectRatio="xMidYMid meet">
        <rect class="resalte" x="0" y="0" width="0" height="0" fill="#0b0b0b" opacity="0.04"/>
        ${grilla}
        ${columnas}
      </svg>
    </div>
    <div class="leyenda">
      ${series.map((s, i) => `<span class="leyenda__item"><span class="leyenda__punto" style="background:${SERIES[i % SERIES.length]}"></span>${esc(s.nombre)}</span>`).join('')}
    </div>`;

  const svg = contenedor.querySelector('svg');
  const resalte = svg.querySelector('.resalte');

  svg.querySelectorAll('.zona').forEach((zona) => {
    const activar = (ev) => {
      const i = Number(zona.dataset.i);
      resalte.setAttribute('x', M.izquierda + paso * i);
      resalte.setAttribute('y', M.arriba);
      resalte.setAttribute('width', paso);
      resalte.setAttribute('height', altoUtil);

      const filas = series
        .map((s, si) => ({ nombre: s.nombre, valor: s.valores[i] || 0, color: SERIES[si % SERIES.length] }))
        .filter((f) => f.valor > 0);

      const caja = svg.getBoundingClientRect();
      const px = ((M.izquierda + paso * i + paso / 2) / W) * caja.width;
      const py = (aY(totales[i]) / H) * caja.height;

      mostrarGlobo(
        svg,
        px,
        py,
        `<div class="globo__titulo">${esc(etiquetas[i])}</div>
         ${filas.map((f) => `<div class="globo__fila"><span class="globo__punto" style="background:${f.color}"></span>${esc(f.nombre)}<strong>${formato(f.valor)}</strong></div>`).join('')}
         ${filas.length > 1 ? `<div class="globo__total">Total<strong>${formato(totales[i])}</strong></div>` : ''}`
      );
      ev.stopPropagation();
    };
    zona.addEventListener('mouseenter', activar);
    zona.addEventListener('mousemove', activar);
    zona.addEventListener('touchstart', activar, { passive: true });
  });

  const apagar = () => {
    resalte.setAttribute('width', 0);
    ocultarGlobo();
  };
  svg.addEventListener('mouseleave', apagar);
  document.addEventListener('touchstart', apagar, { passive: true });
}

/* ---------- Barras horizontales ---------- */

/**
 * @param {{etiqueta: string, valor: number, detalle?: string}[]} items ya ordenados
 */
export function barrasHorizontales(contenedor, { items, formato = plata, color = SERIES[0] }) {
  if (!items.length) {
    contenedor.innerHTML = '<div class="mini">Sin datos en este período.</div>';
    return;
  }
  const maximo = Math.max(...items.map((i) => i.valor), 1);

  contenedor.innerHTML = `
    <div class="barras">
      ${items
        .map(
          (it) => `
        <div class="barra" data-detalle="${esc(it.detalle || '')}">
          <div class="barra__etq">${esc(it.etiqueta)}</div>
          <div class="barra__pista">
            <div class="barra__relleno" style="width:${Math.max(1.5, (it.valor / maximo) * 100)}%;background:${color}"></div>
          </div>
          <div class="barra__valor">${formato(it.valor)}</div>
        </div>`
        )
        .join('')}
    </div>`;

  contenedor.querySelectorAll('.barra[data-detalle]:not([data-detalle=""])').forEach((n) => {
    n.addEventListener('mouseenter', () => {
      const caja = n.getBoundingClientRect();
      mostrarGlobo(n, caja.width / 2, 0, `<div class="globo__titulo">${esc(n.querySelector('.barra__etq').textContent)}</div><div class="globo__fila">${esc(n.dataset.detalle)}</div>`);
    });
    n.addEventListener('mouseleave', ocultarGlobo);
  });
}

/* ---------- Vista de tabla (obligatoria por contraste) ---------- */

export function tablaDeSeries({ etiquetas, series, formato = plata }) {
  const totales = etiquetas.map((_, i) => series.reduce((a, s) => a + (s.valores[i] || 0), 0));
  return `
    <div class="tabla-scroll">
      <table>
        <thead><tr><th>Mes</th>${series.map((s) => `<th class="num">${esc(s.nombre)}</th>`).join('')}<th class="num">Total</th></tr></thead>
        <tbody>
          ${etiquetas
            .map(
              (e, i) => `<tr><td>${esc(e)}</td>${series.map((s) => `<td class="num">${formato(s.valores[i] || 0)}</td>`).join('')}<td class="num"><strong>${formato(totales[i])}</strong></td></tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}
