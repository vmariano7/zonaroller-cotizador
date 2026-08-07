// Arranque de la aplicación.

import { iniciar, suscribir, estado, sincronizar } from './store.js';
import { definirRutas, iniciarRouter, recargarVista } from './router.js';
import { $, $$, esc, aviso } from './ui.js';
import { tienePin, estaDesbloqueado, pedirPin } from './candado.js';

import * as vCotizar from './vistas/cotizar.js';
import * as vPresupuestos from './vistas/presupuestos.js';
import * as vPedidos from './vistas/pedidos.js';
import * as vCaja from './vistas/caja.js';
import * as vAgenda from './vistas/agenda.js';
import * as vConfig from './vistas/config.js';

const NAV = [
  { nav: 'cotizar', ruta: '/cotizar', texto: 'Cotizar', icono: '<path d="M4 3h16v18H4z"/><path d="M8 7h8M8 11h3M8 15h3M15 11v5"/>' },
  { nav: 'presupuestos', ruta: '/presupuestos', texto: 'Presupuestos', icono: '<path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>' },
  { nav: 'pedidos', ruta: '/pedidos', texto: 'Pedidos', icono: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>' },
  { nav: 'caja', ruta: '/caja', texto: 'Caja', icono: '<path d="M3 7h18v12H3z"/><path d="M3 11h18"/><circle cx="17" cy="15" r="1.2"/>' },
  { nav: 'agenda', ruta: '/agenda', texto: 'Agenda', icono: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
  { nav: 'config', ruta: '/config', texto: 'Ajustes', icono: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>' },
];

definirRutas([
  { patron: '/cotizar', nav: 'cotizar', vista: vCotizar.render },
  { patron: '/cotizar/:id', nav: 'cotizar', vista: vCotizar.render },
  { patron: '/presupuestos', nav: 'presupuestos', vista: vPresupuestos.render },
  { patron: '/presupuesto/:id', nav: 'presupuestos', vista: vPresupuestos.renderDetalle },
  { patron: '/pedidos', nav: 'pedidos', vista: vPedidos.render },
  { patron: '/pedido-nuevo', nav: 'pedidos', vista: vPedidos.renderEditor },
  { patron: '/pedido-editar/:id', nav: 'pedidos', vista: vPedidos.renderEditor },
  { patron: '/pedido/:id', nav: 'pedidos', vista: vPedidos.renderDetalle },
  { patron: '/caja', nav: 'caja', vista: vCaja.render },
  { patron: '/agenda', nav: 'agenda', vista: vAgenda.render },
  { patron: '/config', nav: 'config', vista: vConfig.render },
]);

function pintarNav() {
  $('#nav').innerHTML = NAV.map(
    (n) => `<a href="#${n.ruta}" data-nav="${n.nav}">
      <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${n.icono}</svg>
      <span>${esc(n.texto)}</span>
    </a>`
  ).join('');
}

function marcarNav(activo) {
  $$('#nav a').forEach((a) => a.classList.toggle('activo', a.dataset.nav === activo));
}

function pintarSync() {
  const s = estado.sync;
  const caja = $('#sync');
  caja.innerHTML = `<span class="punto punto--${s.estado}"></span><span class="oculto-chico">${esc(
    s.estado === 'ok' ? 'En la nube' : s.estado === 'sincronizando' ? 'Sincronizando' : s.estado === 'error' ? 'Sin nube' : 'Local'
  )}</span>`;
  caja.title = s.mensaje;
}

async function arrancar() {
  pintarNav();
  suscribir(pintarSync);

  await iniciar();
  pintarSync();

  if (tienePin() && !estaDesbloqueado()) await pedirPin();

  iniciarRouter($('#vista'), { onCambio: marcarNav });

  $('#sync').addEventListener('click', async () => {
    await sincronizar();
    aviso(estado.sync.mensaje, estado.sync.estado === 'error' ? 'error' : 'ok');
    recargarVista();
  });

  // Al volver a la app desde otra pestaña o app, refrescamos desde la nube.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && estado.sync.activa) sincronizar();
  });

  window.addEventListener('online', () => {
    if (estado.sync.activa) sincronizar();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

arrancar().catch((err) => {
  console.error(err);
  document.getElementById('vista').innerHTML = `<div class="banner banner--error"><div><strong>No pude arrancar la app.</strong><br>${err.message}</div></div>`;
});
