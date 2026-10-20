// Certificado de garantía: la hoja que se entrega con el trabajo terminado.
//
// Es la misma para todos los pedidos, a propósito. Lo único que sale del
// pedido es el nombre del cliente; no lleva el detalle de las cortinas ni
// fechas, así que una copia firmada sirve igual aunque después se agreguen o
// cambien paños. La fecha de inicio la fija el comprobante de compra.

import { estado } from './store.js';
import { esc } from './ui.js';
import { montarHoja, encabezado } from './pdf.js';

// Lo que dura la garantía. Si algún día cambia, se cambia acá y listo: el
// número aparece en el sello y en el texto desde esta constante.
const ANIOS = 2;

const CUBRE = [
  'Defectos de fabricación en el mecanismo: cadena, embrague, freno, caño, soportes y contrapeso.',
  'Fallas de confección de la tela: costuras, termosellado, corte fuera de escuadra o enrollado desparejo.',
  'Defectos de la tela de origen, como manchas o fallas de fábrica no advertidas al momento de la entrega.',
  'Errores de armado o de instalación realizados por Zona Roller.',
  'Mano de obra y repuestos necesarios para la reparación, sin cargo.',
  'Motores y automatismos: cubiertos por la garantía del fabricante, según el plazo de cada marca.',
];

const NO_CUBRE = [
  'Golpes, caídas, cortes, rayaduras, tirones o cualquier daño por uso brusco o accidental.',
  'Roturas por forzar la cadena o el mando, o por accionar la cortina más allá de su tope.',
  'Daños por viento: cortina baja con la ventana abierta, ráfagas o viento Zonda.',
  'Manchas, hongos o deterioro por humedad, filtraciones, condensación o lavado de la tela.',
  'Limpieza con agua, solventes, lavandina, alcohol o cepillado.',
  'Daños causados por mascotas o niños.',
  'Reparaciones, modificaciones, desinstalación o traslado hechos por terceros.',
  'Desgaste natural por el uso y variaciones de tono por exposición prolongada al sol.',
];

const BUEN_USO = [
  'Accionar la cadena o el mando con suavidad, sin tirones y sin pasar el tope de apertura o cierre.',
  'Subir la cortina cuando haya viento o la ventana quede abierta.',
  'No colgar objetos de la barra ni del contrapeso, ni apoyarse sobre la cortina.',
  'Limpiar con plumero, paño seco o aspiradora con cepillo suave. Las manchas puntuales, con un paño apenas húmedo y sin productos.',
  'No desinstalar ni trasladar la cortina sin consultar antes a Zona Roller.',
];

const RECLAMO = [
  'Avisar a Zona Roller apenas se detecte la falla, por WhatsApp o Instagram, con fotos o un video del problema.',
  'Presentar este certificado junto con el comprobante de compra.',
  'Zona Roller revisa el caso y, si corresponde, repara o reemplaza la pieza sin cargo. Si hace falta retirar la cortina del domicilio, el retiro y la reinstalación están incluidos dentro del Gran Mendoza.',
];

// Los textos son nuestros y fijos: no pasan por esc() porque no vienen de
// ningún formulario.
const lista = (items) => `<ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;

export function imprimirGarantia(p) {
  const emp = estado.config.empresa || {};
  const cliente = p?.cliente?.nombre || '';

  const html = `
    ${encabezado(emp)}

    <div class="hoja__titulo">
      <h1>Certificado de garantía</h1>
      <div class="garantia__plazo">${ANIOS} AÑOS</div>
    </div>

    <p class="garantia__intro">
      ${esc(emp.nombre || 'Zona Roller')} garantiza las cortinas provistas al cliente por el término de
      <strong>${ANIOS} años</strong> contados desde la fecha de entrega o instalación, contra defectos de
      fabricación, de materiales y de confección. La garantía es válida
      <strong>siempre que la cortina haya tenido un uso normal y adecuado</strong>, según las condiciones
      que se detallan más abajo.
    </p>

    <div class="garantia__cliente">
      <span>Cliente</span>
      ${cliente ? `<strong>${esc(cliente)}</strong>` : '<i></i>'}
    </div>

    <div class="garantia__cols">
      <div class="garantia__col">
        <h3 class="garantia__si">Qué cubre</h3>
        ${lista(CUBRE)}
      </div>
      <div class="garantia__col">
        <h3 class="garantia__no">Qué no cubre</h3>
        ${lista(NO_CUBRE)}
      </div>
    </div>

    <div class="garantia__bloque">
      <h3>Condiciones de buen uso</h3>
      ${lista(BUEN_USO)}
    </div>

    <div class="garantia__bloque">
      <h3>Cómo hacerla válida</h3>
      ${lista(RECLAMO)}
    </div>

    <div class="hoja__pie">
      <div class="garantia__firmas">
        <div><i></i><span>Firma y aclaración — ${esc(emp.nombre || 'Zona Roller')}</span></div>
        <div><i></i><span>Firma y aclaración — Cliente</span></div>
      </div>
      Esta garantía no sustituye ni limita los derechos que la Ley 24.240 de Defensa del Consumidor le
      reconoce al comprador. Conservá este certificado junto con el comprobante de compra, que es el que
      acredita la fecha de inicio de la garantía.
    </div>
  `;

  montarHoja(html, `Garantia - ${cliente}`.trim().replace(/-$/, '').trim(), 'hoja--garantia');
}
