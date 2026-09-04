// Pantalla de cotización: crea o edita un presupuesto.
//
// Al entrar sin nada más (sin id de presupuesto ni categoría elegida) se
// muestra primero un selector de categoría: Cortinas, Placas o Adicionales.
// Cortinas habilita el editor de siempre, sin ningún cambio: roller, vertical,
// zebra y tela tradicional siguen viviendo adentro, tal cual estaban.
// Las tres categorías pasan por el mismo editor, así que las tres se guardan,
// se convierten en pedido y salen en PDF igual. Lo único que cambia es el
// renglón: placas y adicionales usan producto del catálogo en vez de
// tipo/tela/sistema — ver nodoItemProducto en editor.js.

import { montarEditor, docVacio, CLIENTE_POR_DEFECTO } from './editor.js';
import { guardar, obtener, proximoNumero } from '../store.js';
import { CATEGORIA, categoriaDoc, contarItems } from '../calc.js';
import { plata, aviso, confirmar, esc } from '../ui.js';
import { navegar } from '../router.js';
import { crearPedidoDesdePresupuesto } from './pedidos.js';

const CATEGORIAS = [
  {
    clave: 'cortinas',
    nombre: 'Cortinas',
    desc: 'Roller, bandas verticales, zebra y tela tradicional',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
      <rect x="3.5" y="3" width="17" height="2.5" rx="1" fill="currentColor" stroke="none"/>
      <rect x="4.5" y="5.5" width="15" height="12.5" rx=".5"/>
      <path d="M4.5 9h15M4.5 12h15M4.5 15h15" opacity=".45"/>
      <path d="M7.5 18v2.5M16.5 18v2.5" opacity=".45"/></svg>`,
  },
  {
    clave: 'placas',
    nombre: 'Placas',
    desc: 'Por m², con colocación y envío',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/>
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/>
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/>
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/></svg>`,
  },
  {
    clave: 'adicionales',
    nombre: 'Adicionales',
    desc: 'Productos sueltos, por unidad',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3.6 12.6 12 4.2h7.8V12l-8.4 8.4a2 2 0 0 1-2.8 0l-5-5a2 2 0 0 1 0-2.8Z"/>
      <circle cx="15.9" cy="8.1" r="1.3"/></svg>`,
  },
];

/** De la categoría que viene en la URL a la clave que usa el resto de la app. */
const CLAVE_CATEGORIA = { cortinas: 'cortina', placas: 'placa', adicionales: 'adicional' };

export function render(contenedor, params = {}) {
  if (!params.id && !params.categoria) return renderElegirCategoria(contenedor);
  return renderPresupuesto(contenedor, params);
}

function renderElegirCategoria(contenedor) {
  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div><h1>Cotizar</h1><div class="sub">¿Qué querés cotizar?</div></div>
    </div>
    <div class="categorias">
      ${CATEGORIAS.map((c) => `
        <a class="categoria" href="#/cotizar/nuevo/${c.clave}">
          <span class="categoria__chip">${c.icono}</span>
          <span class="categoria__texto">
            <span class="categoria__nombre">${esc(c.nombre)}</span>
            <span class="categoria__desc">${esc(c.desc)}</span>
          </span>
          <svg class="categoria__flecha" viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 1l5 5-5 5"/></svg>
        </a>`).join('')}
    </div>
  `;
}

function renderPresupuesto(contenedor, params) {
  const existente = params.id ? obtener('presupuestos', params.id) : null;
  if (params.id && !existente) {
    contenedor.innerHTML = '<div class="vacio"><p>No encontré ese presupuesto.</p></div>';
    return;
  }

  // Un presupuesto es de una sola categoría: se elige al crearlo. Al editar
  // uno ya guardado, la deducimos de sus renglones en vez de pedirla de nuevo.
  const categoria = existente ? categoriaDoc(existente) : (CLAVE_CATEGORIA[params.categoria] || 'cortina');
  const cat = CATEGORIA[categoria];

  const doc = existente ? { ...existente } : docVacio(cat.tipoItem);

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div>
        <h1>${existente ? `Presupuesto ${existente.numero}` : 'Nuevo presupuesto'}</h1>
        <div class="sub">${existente ? 'Editando un presupuesto guardado' : `Cargá ${cat.conArticulo} y mirá el total en vivo. El cliente es opcional.`}</div>
      </div>
    </div>
    <div data-editor></div>
    <div class="resumen-fijo"></div>
  `;

  const barra = contenedor.querySelector('.resumen-fijo');
  const editor = montarEditor(contenedor.querySelector('[data-editor]'), doc, {
    alCambiar: () => pintarBarra(),
    clienteOpcional: true,
    tipoInicial: cat.tipoItem,
    tituloSeccion: cat.titulo,
    etiquetaAgregar: cat.agregar,
  });

  function pintarBarra() {
    const t = editor.totales();
    barra.innerHTML = `
      <div class="resumen-fijo__fila"><span>${contarItems(t.cantidadCortinas, categoria)}</span><span>${t.montoDescuento ? `descuento ${plata(t.montoDescuento)}` : ''}</span></div>
      <div class="resumen-fijo__total"><span>Total</span><span>${plata(t.total)}</span></div>
      <div class="fila-botones mt-16">
        <button class="btn btn--primario" data-guardar style="flex:1">${existente ? 'Guardar cambios' : 'Guardar presupuesto'}</button>
        ${existente ? '<button class="btn" data-pedido>Convertir en pedido</button>' : ''}
      </div>
    `;
    barra.querySelector('[data-guardar]').onclick = guardarDoc;
    barra.querySelector('[data-pedido]')?.addEventListener('click', convertir);
  }

  async function guardarDoc() {
    const d = editor.leer();
    // El nombre no frena el guardado: muchas cotizaciones se arman sin datos de
    // la persona y lo que hace falta es el PDF ya. Si va en blanco entra como
    // consumidor final y se completa después si la venta avanza.
    if (!d.cliente.nombre?.trim()) d.cliente.nombre = CLIENTE_POR_DEFECTO;
    const t = editor.totales();
    const registro = {
      ...(existente || {}),
      ...d,
      numero: existente?.numero || proximoNumero('presupuestos', 'P'),
      estado: existente?.estado || 'borrador',
      total: t.total,
      cantidadCortinas: t.cantidadCortinas,
    };
    const guardado = await guardar('presupuestos', registro);
    aviso(`Presupuesto ${guardado.numero} guardado.`);
    navegar(`/presupuesto/${guardado.id}`);
  }

  async function convertir() {
    if (!(await confirmar('¿Convertir este presupuesto en un pedido confirmado?', { textoOk: 'Convertir' }))) return;
    const d = editor.leer();
    const pedido = await crearPedidoDesdePresupuesto({ ...existente, ...d });
    aviso(`Pedido ${pedido.numero} creado.`);
    navegar(`/pedido/${pedido.id}`);
  }

  pintarBarra();
}
