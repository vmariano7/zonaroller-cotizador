// Arranque de la aplicación.

import { iniciar, suscribir, estado, sincronizar } from './store.js';
import { definirRutas, iniciarRouter, recargarVista } from './router.js';
import { $, $$, esc, aviso, modal } from './ui.js';
import { tienePin, estaDesbloqueado, pedirPin, bloquear } from './candado.js';

import * as vCotizar from './vistas/cotizar.js';
import * as vPresupuestos from './vistas/presupuestos.js';
import * as vPedidos from './vistas/pedidos.js';
import * as vClientes from './vistas/clientes.js';
import * as vCaja from './vistas/caja.js';
import * as vAgenda from './vistas/agenda.js';
import * as vReportes from './vistas/reportes.js';
import * as vConfig from './vistas/config.js';

const ICONOS = {
  cotizar: '<path d="M4 3h16v18H4z"/><path d="M8 7h8M8 11h3M8 15h3M15 11v5"/>',
  presupuestos: '<path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  pedidos: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  clientes: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 8.5a3 3 0 010 5M18.5 5.5a6.5 6.5 0 010 11"/>',
  caja: '<path d="M3 7h18v12H3z"/><path d="M3 11h18"/><circle cx="17" cy="15" r="1.2"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  reportes: '<path d="M3 21h18"/><rect x="5" y="11" width="3.5" height="7"/><rect x="10.2" y="6" width="3.5" height="12"/><rect x="15.5" y="14" width="3.5" height="4"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
};

// Las cinco de todos los días van en la barra de abajo del celular.
const PRIMARIAS = [
  { nav: 'cotizar', ruta: '/cotizar', texto: 'Cotizar' },
  { nav: 'presupuestos', ruta: '/presupuestos', texto: 'Presupuestos' },
  { nav: 'pedidos', ruta: '/pedidos', texto: 'Pedidos' },
  { nav: 'agenda', ruta: '/agenda', texto: 'Agenda' },
];
// El resto entra por "Más" en el celular; en la compu se ven todas.
const SECUNDARIAS = [
  { nav: 'caja', ruta: '/caja', texto: 'Caja' },
  { nav: 'clientes', ruta: '/clientes', texto: 'Clientes' },
  { nav: 'reportes', ruta: '/reportes', texto: 'Reportes' },
  { nav: 'config', ruta: '/config', texto: 'Ajustes' },
];

const icono = (nombre) =>
  `<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${ICONOS[nombre]}</svg>`;

definirRutas([
  { patron: '/cotizar', nav: 'cotizar', vista: vCotizar.render },
  { patron: '/cotizar/:id', nav: 'cotizar', vista: vCotizar.render },
  { patron: '/presupuestos', nav: 'presupuestos', vista: vPresupuestos.render },
  { patron: '/presupuesto/:id', nav: 'presupuestos', vista: vPresupuestos.renderDetalle },
  { patron: '/pedidos', nav: 'pedidos', vista: vPedidos.render },
  { patron: '/pedido-nuevo', nav: 'pedidos', vista: vPedidos.renderEditor },
  { patron: '/pedido-editar/:id', nav: 'pedidos', vista: vPedidos.renderEditor },
  { patron: '/pedido/:id', nav: 'pedidos', vista: vPedidos.renderDetalle },
  { patron: '/clientes', nav: 'clientes', vista: vClientes.render },
  { patron: '/cliente/:clave', nav: 'clientes', vista: vClientes.renderDetalle },
  { patron: '/caja', nav: 'caja', vista: vCaja.render },
  { patron: '/agenda', nav: 'agenda', vista: vAgenda.render },
  { patron: '/reportes', nav: 'reportes', vista: vReportes.render },
  { patron: '/config', nav: 'config', vista: vConfig.render },
]);

function pintarNav() {
  const enlace = (n, secundaria) =>
    `<a href="#${n.ruta}" data-nav="${n.nav}"${secundaria ? ' class="nav__sec"' : ''}>${icono(n.nav)}<span>${esc(n.texto)}</span></a>`;

  $('#nav').innerHTML = `
    ${PRIMARIAS.map((n) => enlace(n, false)).join('')}
    ${SECUNDARIAS.map((n) => enlace(n, true)).join('')}
    <button class="nav__mas" data-mas>${icono('mas')}<span>Más</span></button>`;

  $('#nav [data-mas]').addEventListener('click', abrirMas);
}

function abrirMas() {
  const m = modal('Más', `
    <div class="lista">
      ${SECUNDARIAS.map(
        (n) => `<a class="item-lista" href="#${n.ruta}" data-cerrar style="text-decoration:none;color:inherit">
          <span style="width:22px;display:grid;place-items:center">${icono(n.nav)}</span>
          <div class="item-lista__cuerpo"><div class="item-lista__titulo">${esc(n.texto)}</div></div>
        </a>`
      ).join('')}
    </div>
    ${tienePin() ? '<button class="btn mt-16" data-bloquear style="width:100%">Bloquear la app</button>' : ''}
  `, { ancho: '420px' });

  m.cuerpo.querySelector('[data-bloquear]')?.addEventListener('click', bloquear);
}

function marcarNav(activo) {
  $$('#nav a').forEach((a) => a.classList.toggle('activo', a.dataset.nav === activo));
  const esSecundaria = SECUNDARIAS.some((n) => n.nav === activo);
  $('#nav [data-mas]')?.classList.toggle('activo', esSecundaria);
}

function pintarSync() {
  const s = estado.sync;
  const caja = $('#sync');
  caja.innerHTML = `<span class="punto punto--${s.estado}"></span><span>${esc(
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
    // Si ya había una versión instalada y llega una nueva, recargamos una sola
    // vez. Sin esto la primera apertura después de una actualización sigue
    // mostrando la versión vieja.
    const habiaVersionPrevia = !!navigator.serviceWorker.controller;
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!habiaVersionPrevia || recargando) return;
      recargando = true;
      location.reload();
    });
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

arrancar().catch((err) => {
  console.error(err);
  document.getElementById('vista').innerHTML = `<div class="banner banner--error"><div><strong>No pude arrancar la app.</strong><br>${err.message}</div></div>`;
});
