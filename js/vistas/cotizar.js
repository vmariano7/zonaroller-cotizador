// Pantalla de cotización: crea o edita un presupuesto.
//
// Al entrar sin nada más (sin id de presupuesto ni categoría elegida) se
// muestra primero un selector de categoría: Cortinas, Placas o Adicionales.
// Cortinas habilita el editor de siempre, sin ningún cambio: roller, vertical,
// zebra y tela tradicional siguen viviendo adentro, tal cual estaban.
// Placas pasa por el mismo editor (mismo guardado, PDF, conversión a pedido),
// pero con renglones de producto + m² en vez de tipo/tela/sistema — ver
// nodoItemPlaca en editor.js. Adicionales sigue siendo la calculadora simple
// de unidades, en `calculadora.js`.

import { montarEditor, docVacio, CLIENTE_POR_DEFECTO } from './editor.js';
import { render as renderCalculadora } from './calculadora.js';
import { guardar, obtener, proximoNumero } from '../store.js';
import { plata, aviso, confirmar, esc } from '../ui.js';
import { navegar } from '../router.js';
import { crearPedidoDesdePresupuesto } from './pedidos.js';

const CATEGORIAS = [
  {
    clave: 'cortinas',
    nombre: 'Cortinas',
    desc: 'Roller, bandas verticales, zebra y tela tradicional',
    icono: '<path d="M4 3h16v18H4z"/><path d="M8 7h8M8 11h3M8 15h3M15 11v5"/>',
  },
  {
    clave: 'placas',
    nombre: 'Placas',
    desc: 'Presupuesto por producto y m²',
    icono: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 10h16M10 4v16"/>',
  },
  {
    clave: 'adicionales',
    nombre: 'Adicionales',
    desc: 'Calculadora por unidades',
    icono: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M7.5 12h9"/>',
  },
];

export function render(contenedor, params = {}) {
  if (!params.id && !params.categoria) return renderElegirCategoria(contenedor);
  if (!params.id && params.categoria === 'adicionales') {
    return renderCalculadora(contenedor, { categoria: 'adicionales' });
  }
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
          <svg class="categoria__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${c.icono}</svg>
          <span class="categoria__nombre">${esc(c.nombre)}</span>
          <span class="categoria__desc">${esc(c.desc)}</span>
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
  const esPlacas = existente ? existente.items?.some((it) => it.tipo === 'placa') : params.categoria === 'placas';

  const doc = existente ? { ...existente } : docVacio(esPlacas ? 'placa' : 'roller');

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div>
        <h1>${existente ? `Presupuesto ${existente.numero}` : 'Nuevo presupuesto'}</h1>
        <div class="sub">${existente ? 'Editando un presupuesto guardado' : esPlacas ? 'Cargá las placas y mirá el total en vivo. El cliente es opcional.' : 'Cargá las cortinas y mirá el total en vivo. El cliente es opcional.'}</div>
      </div>
    </div>
    <div data-editor></div>
    <div class="resumen-fijo"></div>
  `;

  const barra = contenedor.querySelector('.resumen-fijo');
  const editor = montarEditor(contenedor.querySelector('[data-editor]'), doc, {
    alCambiar: () => pintarBarra(),
    clienteOpcional: true,
    tipoInicial: esPlacas ? 'placa' : 'roller',
    tituloSeccion: esPlacas ? 'Placas' : 'Cortinas',
    etiquetaAgregar: esPlacas ? '+ Agregar otra placa' : '+ Agregar otra cortina',
  });

  function pintarBarra() {
    const t = editor.totales();
    const unidad = esPlacas ? 'placa' : 'cortina';
    barra.innerHTML = `
      <div class="resumen-fijo__fila"><span>${t.cantidadCortinas} ${unidad}${t.cantidadCortinas === 1 ? '' : 's'}</span><span>${t.montoDescuento ? `descuento ${plata(t.montoDescuento)}` : ''}</span></div>
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
