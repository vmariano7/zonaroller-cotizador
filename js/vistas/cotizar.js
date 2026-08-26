// Pantalla de cotización: crea o edita un presupuesto.

import { montarEditor, docVacio, CLIENTE_POR_DEFECTO } from './editor.js';
import { guardar, obtener, proximoNumero } from '../store.js';
import { plata, aviso, confirmar } from '../ui.js';
import { navegar } from '../router.js';
import { crearPedidoDesdePresupuesto } from './pedidos.js';

export function render(contenedor, params = {}) {
  const existente = params.id ? obtener('presupuestos', params.id) : null;
  if (params.id && !existente) {
    contenedor.innerHTML = '<div class="vacio"><p>No encontré ese presupuesto.</p></div>';
    return;
  }

  const doc = existente ? { ...existente } : docVacio();

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div>
        <h1>${existente ? `Presupuesto ${existente.numero}` : 'Nuevo presupuesto'}</h1>
        <div class="sub">${existente ? 'Editando un presupuesto guardado' : 'Cargá las cortinas y mirá el total en vivo. El cliente es opcional.'}</div>
      </div>
    </div>
    <div data-editor></div>
    <div class="resumen-fijo"></div>
  `;

  const barra = contenedor.querySelector('.resumen-fijo');
  const editor = montarEditor(contenedor.querySelector('[data-editor]'), doc, {
    alCambiar: () => pintarBarra(),
    clienteOpcional: true,
  });

  function pintarBarra() {
    const t = editor.totales();
    barra.innerHTML = `
      <div class="resumen-fijo__fila"><span>${t.cantidadCortinas} cortina${t.cantidadCortinas === 1 ? '' : 's'}</span><span>${t.montoDescuento ? `descuento ${plata(t.montoDescuento)}` : ''}</span></div>
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
