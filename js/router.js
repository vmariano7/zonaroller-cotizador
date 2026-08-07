// Ruteo por hash: funciona en GitHub Pages sin configuración de servidor.

const rutas = [];
let contenedor;
let alCambiar;

export function definirRutas(defs) {
  rutas.length = 0;
  defs.forEach((d) => rutas.push(d));
}

export function navegar(ruta) {
  if (location.hash === `#${ruta}`) resolver();
  else location.hash = ruta;
}

export function rutaActual() {
  return (location.hash || '#/cotizar').slice(1);
}

function emparejar(ruta) {
  for (const def of rutas) {
    const partesDef = def.patron.split('/').filter(Boolean);
    const partesRuta = ruta.split('?')[0].split('/').filter(Boolean);
    if (partesDef.length !== partesRuta.length) continue;

    const params = {};
    let ok = true;
    for (let i = 0; i < partesDef.length; i++) {
      if (partesDef[i].startsWith(':')) params[partesDef[i].slice(1)] = decodeURIComponent(partesRuta[i]);
      else if (partesDef[i] !== partesRuta[i]) { ok = false; break; }
    }
    if (ok) return { def, params };
  }
  return null;
}

function resolver() {
  const ruta = rutaActual();
  const encontrada = emparejar(ruta);
  contenedor.innerHTML = '';
  window.scrollTo({ top: 0 });

  if (!encontrada) {
    contenedor.innerHTML = '<div class="vacio"><p>No encontré esa pantalla.</p><a class="btn" href="#/cotizar">Ir al cotizador</a></div>';
  } else {
    try {
      encontrada.def.vista(contenedor, encontrada.params);
    } catch (err) {
      console.error(err);
      contenedor.innerHTML = `<div class="banner banner--error"><div><strong>Se rompió algo al abrir esta pantalla.</strong><br>${err.message}</div></div>`;
    }
  }
  alCambiar?.(encontrada?.def.nav || ruta);
}

export function iniciarRouter(nodo, { onCambio } = {}) {
  contenedor = nodo;
  alCambiar = onCambio;
  window.addEventListener('hashchange', resolver);
  if (!location.hash) location.hash = '/cotizar';
  else resolver();
}

export { resolver as recargarVista };
