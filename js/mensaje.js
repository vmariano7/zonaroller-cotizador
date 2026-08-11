// El mensaje que se le manda al cliente con el precio de lista y el de contado.
// Vive aparte de las vistas porque lo usan el editor (para armarlo) y
// Configuración (para editar la plantilla y ver cómo queda).

import { plata, num } from './ui.js';

export const PLANTILLA_POR_DEFECTO =
  `Esta cotización te saldría {lista}, que podes hacer en 3 y 6 pagos sin interés con tarjeta de crédito! Sino de contado tenes un {descuento}% de descuento y te queda en {contado}, que puede ser en efectivo o transferencia. Nuestro plazo de producción es de aprox {plazo} días hábiles, y tenes varios tipos de telas y colores a elegir dentro de ese precio!
En caso que quieras avanzar, vamos a verificar las medidas al domicilio y luego las instalamos nosotros, asi que eso va sin cargo!
Cualquier duda que tengas no dudes en consultarme!!

¡Esperamos tu mensaje! 😊`;

export const CLAVES = [
  ['{lista}', 'precio de lista'],
  ['{contado}', 'precio de contado'],
  ['{descuento}', '% de descuento'],
  ['{plazo}', 'días de producción'],
  ['{nombre}', 'nombre del cliente'],
];

/**
 * Precio de contado a partir del de lista. Sin redondeos: tiene que ser
 * exactamente el descuento que dice el mensaje, si no los números no cierran
 * cuando el cliente los revisa.
 */
export function precioContado(total, descuentoPct) {
  const pct = Number(descuentoPct) || 0;
  return (Number(total) || 0) * (1 - pct / 100);
}

/** Lo que hay que mostrar y mandar, ya resuelto con los valores efectivos. */
export function datosContado(doc, config, total) {
  const c = config?.contado || {};
  const pct = Number(doc?.contadoPct ?? c.descuentoPct ?? 35) || 0;
  const plazo = Number(doc?.contadoPlazoDias ?? c.plazoDias ?? 5) || 0;
  const auto = precioContado(total, pct);
  const manual = Number.isFinite(Number(doc?.contadoManual)) && doc?.contadoManual !== null && doc?.contadoManual !== ''
    ? Number(doc.contadoManual)
    : null;
  return { lista: total, contado: manual ?? auto, auto, manual, pct, plazo };
}

// En el mensaje va "$663.000", pegado, como se escribe por WhatsApp. El
// formateador de la app mete un espacio finito después del signo.
const pesos = (n) => plata(n).replace(/\s/g, '');

export function armarMensaje(doc, config, total) {
  const { lista, contado, pct, plazo } = datosContado(doc, config, total);
  const plantilla = config?.contado?.plantilla?.trim() || PLANTILLA_POR_DEFECTO;
  const nombre = String(doc?.cliente?.nombre || '').trim().split(/\s+/)[0] || '';
  return plantilla
    .replaceAll('{lista}', pesos(lista))
    .replaceAll('{contado}', pesos(contado))
    .replaceAll('{descuento}', num(pct, 1))
    .replaceAll('{plazo}', num(plazo, 0))
    .replaceAll('{nombre}', nombre);
}

/** Copia al portapapeles. Devuelve true si funcionó. */
export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Safari viejo y contextos sin permiso: el truco del textarea oculto.
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
