// Calculadora de unidades para Placas y Adicionales.
//
// A diferencia de las cortinas, acá no hay medidas ni sistemas: cada producto
// se carga entero desde Ajustes (nombre + precio) y esta pantalla sólo
// multiplica precio × cantidad por cada línea que agregues. No genera
// presupuesto ni pedido: es una calculadora rápida para dar un número (y
// mandarlo por WhatsApp si hace falta).

import { estado } from '../store.js';
import { el, esc, plata, num, aviso } from '../ui.js';
import { copiar } from '../mensaje.js';

const TITULOS = {
  placas: { titulo: 'Placas', vacio: 'placas' },
  adicionales: { titulo: 'Adicionales', vacio: 'adicionales' },
};

export function render(contenedor, { categoria }) {
  const info = TITULOS[categoria] || { titulo: categoria, vacio: categoria };
  const catalogo = estado.config[categoria] || [];

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div>
        <h1>${esc(info.titulo)}</h1>
        <div class="sub">Calculadora por unidades: elegí el producto y la cantidad.</div>
      </div>
    </div>
  `;

  if (!catalogo.length) {
    contenedor.insertAdjacentHTML('beforeend', `
      <div class="banner banner--aviso">
        <div>Todavía no cargaste productos de ${esc(info.vacio)}. Andá a
        <a href="#/config"><strong>Ajustes</strong></a> para cargarlos.</div>
      </div>
    `);
    return;
  }

  contenedor.insertAdjacentHTML('beforeend', `
    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">1</span><h2>${esc(info.titulo)}</h2>
      </div>
      <div data-lineas></div>
      <button class="btn btn--chico" data-agregar style="width:100%">+ Agregar línea</button>
    </div>
    <div class="resumen-fijo"></div>
  `);

  const cajaLineas = contenedor.querySelector('[data-lineas]');
  const barra = contenedor.querySelector('.resumen-fijo');

  let lineas = [{ id: crypto.randomUUID(), productoId: catalogo[0].id, cantidad: 1 }];

  // El porcentaje de ganancia sale de Ajustes → Incrementos, igual que el de
  // las cortinas. La clave va en singular: "adicional", "placa".
  const reglaInc = estado.config.incrementos?.[categoria === 'placas' ? 'placa' : 'adicional'] || { activo: false, valor: 0 };
  const pctIncremento = reglaInc.activo ? Number(reglaInc.valor) || 0 : 0;
  const conIncremento = (precio) => (Number(precio) || 0) * (1 + pctIncremento / 100);

  function nodoLinea(linea, indice) {
    const nodo = el(`
      <div class="cortina" data-id="${linea.id}">
        <div class="cortina__cab">
          <span class="cortina__n">${String(indice + 1).padStart(2, '0')}</span>
          <select data-campo="productoId" style="flex:1">
            ${catalogo.map((p) => `<option value="${esc(p.id)}"${p.id === linea.productoId ? ' selected' : ''}>${esc(p.nombre)} — ${plata(conIncremento(p.precio))}</option>`).join('')}
          </select>
          <button class="btn-icono" data-quitar title="Quitar línea">&#10005;</button>
        </div>
        <div class="campos campos--2 mt-16">
          <div>
            <label>Cantidad</label>
            <input data-campo="cantidad" type="number" inputmode="numeric" min="1" step="1" value="${linea.cantidad}">
          </div>
        </div>
        <div class="cortina__resumen" data-resumen></div>
      </div>
    `);

    nodo.querySelector('[data-quitar]').addEventListener('click', () => {
      if (lineas.length === 1) lineas = [{ id: crypto.randomUUID(), productoId: catalogo[0].id, cantidad: 1 }];
      else lineas = lineas.filter((l) => l.id !== linea.id);
      pintarLineas();
    });

    nodo.querySelector('[data-campo="productoId"]').addEventListener('change', (e) => {
      linea.productoId = e.target.value;
      pintarResumenLinea(nodo, linea);
      pintarTotal();
    });

    nodo.querySelector('[data-campo="cantidad"]').addEventListener('input', (e) => {
      linea.cantidad = Math.max(1, Number(e.target.value) || 1);
      pintarResumenLinea(nodo, linea);
      pintarTotal();
    });

    pintarResumenLinea(nodo, linea);
    return nodo;
  }

  function subtotalLinea(linea) {
    const producto = catalogo.find((p) => p.id === linea.productoId);
    const precio = Number(producto?.precio) || 0;
    const cantidad = Math.max(1, Number(linea.cantidad) || 1);
    const unitario = conIncremento(precio);
    return { producto, precio, pct: pctIncremento, unitario, cantidad, subtotal: unitario * cantidad };
  }

  function pintarResumenLinea(nodo, linea) {
    const { pct, unitario, cantidad, subtotal } = subtotalLinea(linea);
    nodo.querySelector('[data-resumen]').innerHTML = `
      <span>${cantidad} × ${plata(unitario)}${pct ? ` <span class="mini">(+${num(pct, 0)}%)</span>` : ''}</span>
      <span class="cortina__precio">${plata(subtotal)}</span>
    `;
  }

  function pintarLineas() {
    cajaLineas.innerHTML = '';
    lineas.forEach((l, i) => cajaLineas.appendChild(nodoLinea(l, i)));
    pintarTotal();
  }

  function pintarTotal() {
    const total = lineas.reduce((a, l) => a + subtotalLinea(l).subtotal, 0);
    const cantidadTotal = lineas.reduce((a, l) => a + Math.max(1, Number(l.cantidad) || 1), 0);
    barra.innerHTML = `
      <div class="resumen-fijo__fila"><span>${cantidadTotal} unidad${cantidadTotal === 1 ? '' : 'es'}</span><span></span></div>
      <div class="resumen-fijo__total"><span>Total</span><span>${plata(total)}</span></div>
      <div class="fila-botones mt-16">
        <button class="btn btn--primario" data-copiar style="flex:1">Copiar resumen</button>
      </div>
    `;
    barra.querySelector('[data-copiar]').addEventListener('click', async () => {
      const texto = [
        ...lineas.map((l) => {
          const { producto, cantidad, subtotal } = subtotalLinea(l);
          return `${producto?.nombre || '—'} × ${cantidad} = ${plata(subtotal)}`;
        }),
        `Total: ${plata(total)}`,
      ].join('\n');
      if (await copiar(texto)) aviso('Resumen copiado.');
      else aviso('No pude copiar. Seleccioná el texto y copialo a mano.', 'error');
    });
  }

  contenedor.querySelector('[data-agregar]').addEventListener('click', () => {
    lineas.push({ id: crypto.randomUUID(), productoId: catalogo[0].id, cantidad: 1 });
    pintarLineas();
    cajaLineas.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  pintarLineas();
}
