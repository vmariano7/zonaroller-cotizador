// Agenda: calendario mensual con visitas a domicilio, instalaciones y tareas.

import { estado, guardar, borrar } from '../store.js';
import { fechaLarga, capitalizar, esc, aviso, confirmar, modal, hoyISO } from '../ui.js';
import { navegar } from '../router.js';

const TIPOS_EVENTO = {
  visita: 'Visita a domicilio',
  instalacion: 'Instalación',
  entrega: 'Entrega',
  otro: 'Otra tarea',
};

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function claveDia(d) {
  const c = new Date(d);
  c.setMinutes(c.getMinutes() - c.getTimezoneOffset());
  return c.toISOString().slice(0, 10);
}

/** Junta los eventos manuales con las instalaciones agendadas en pedidos. */
function eventosDe(fechaISO) {
  const manuales = estado.agenda
    .filter((e) => e.fecha === fechaISO)
    .map((e) => ({ ...e, origen: 'agenda' }));

  const instalaciones = estado.pedidos
    .filter((p) => p.fechaInstalacion === fechaISO && p.estado !== 'cancelado')
    .map((p) => ({
      id: `pedido-${p.id}`,
      fecha: fechaISO,
      hora: '',
      tipo: 'instalacion',
      titulo: `Instalación · ${p.cliente?.nombre || 'Cliente'}`,
      cliente: p.cliente?.nombre || '',
      direccion: p.cliente?.direccion || '',
      telefono: p.cliente?.telefono || '',
      notas: `${p.numero} · ${p.cantidadCortinas || 0} cortinas`,
      hecho: p.estado === 'instalado',
      origen: 'pedido',
      pedidoId: p.id,
    }));

  return [...instalaciones, ...manuales].sort((a, b) => String(a.hora || '99').localeCompare(String(b.hora || '99')));
}

export function render(contenedor) {
  let cursor = new Date();
  cursor.setDate(1);

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div><h1>Agenda</h1><div class="sub">Visitas, instalaciones y tareas</div></div>
      <div class="der"><button class="btn btn--primario" data-nuevo>+ Agendar</button></div>
    </div>
    <div class="grid grid--2" style="align-items:start">
      <div data-cal></div>
      <div data-proximos></div>
    </div>
  `;

  contenedor.querySelector('[data-nuevo]').addEventListener('click', () => dialogoEvento(null, hoyISO(), pintar));

  const cajaCal = contenedor.querySelector('[data-cal]');
  const cajaProx = contenedor.querySelector('[data-proximos]');

  function pintar() {
    pintarCalendario();
    pintarProximos();
  }

  function pintarCalendario() {
    const anio = cursor.getFullYear();
    const mes = cursor.getMonth();
    const primero = new Date(anio, mes, 1);
    // Semana que arranca el lunes
    const desplazamiento = (primero.getDay() + 6) % 7;
    const inicio = new Date(anio, mes, 1 - desplazamiento);
    const hoy = claveDia(new Date());

    const celdas = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      const iso = claveDia(d);
      const eventos = eventosDe(iso);
      const fuera = d.getMonth() !== mes;
      celdas.push(`
        <div class="cal__dia${fuera ? ' cal__dia--fuera' : ''}${iso === hoy ? ' cal__dia--hoy' : ''}" data-dia="${iso}">
          <div class="cal__num">${d.getDate()}</div>
          ${eventos.slice(0, 3).map((e) => `<span class="cal__ev cal__ev--${e.tipo}${e.hecho ? ' cal__ev--hecho' : ''}">${e.hora ? `${esc(e.hora)} ` : ''}${esc(e.titulo)}</span>`).join('')}
          ${eventos.length > 3 ? `<span class="mini">+${eventos.length - 3} más</span>` : ''}
        </div>`);
    }

    cajaCal.innerHTML = `
      <div class="cal">
        <div class="cal__cab">
          <button class="btn-icono" data-prev aria-label="Mes anterior">‹</button>
          <h3>${capitalizar(primero.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }))}</h3>
          <button class="btn-icono" data-next aria-label="Mes siguiente">›</button>
          <button class="btn btn--chico" data-hoy style="margin-left:auto">Hoy</button>
        </div>
        <div class="cal__grid">
          ${DOW.map((d) => `<div class="cal__dow">${d}</div>`).join('')}
          ${celdas.join('')}
        </div>
      </div>`;

    cajaCal.querySelector('[data-prev]').onclick = () => { cursor.setMonth(cursor.getMonth() - 1); pintar(); };
    cajaCal.querySelector('[data-next]').onclick = () => { cursor.setMonth(cursor.getMonth() + 1); pintar(); };
    cajaCal.querySelector('[data-hoy]').onclick = () => { cursor = new Date(); cursor.setDate(1); pintar(); };
    cajaCal.querySelectorAll('[data-dia]').forEach((n) =>
      n.addEventListener('click', () => dialogoDia(n.dataset.dia, pintar))
    );
  }

  function pintarProximos() {
    const hoy = hoyISO();
    const dias = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(`${hoy}T12:00:00`);
      d.setDate(d.getDate() + i);
      const iso = claveDia(d);
      const eventos = eventosDe(iso).filter((e) => !e.hecho);
      if (eventos.length) dias.push({ iso, eventos });
    }

    cajaProx.innerHTML = `
      <div class="tarjeta">
        <div class="tarjeta__cab"><h2>Próximos 30 días</h2></div>
        ${dias.length ? dias.map(({ iso, eventos }) => `
          <div style="margin-bottom:.9rem">
            <div class="mini" style="font-weight:700;color:var(--tinta)">${fechaLarga(iso)}</div>
            ${eventos.map((e) => `
              <div class="item-lista" style="margin-top:.35rem;padding:.6rem .7rem" data-ev="${e.id}" data-ev-fecha="${e.fecha}">
                <div class="item-lista__cuerpo">
                  <div class="item-lista__titulo" style="font-size:.88rem">
                    <span class="chip chip--${e.tipo === 'instalacion' ? 'verde' : e.tipo === 'visita' ? 'azul' : 'gris'}">${esc(TIPOS_EVENTO[e.tipo] || e.tipo)}</span>
                    ${e.hora ? `<span class="mini">${esc(e.hora)}</span>` : ''}
                  </div>
                  <div style="font-weight:600">${esc(e.titulo)}</div>
                  ${e.direccion ? `<div class="mini">${esc(e.direccion)}</div>` : ''}
                </div>
              </div>`).join('')}
          </div>`).join('') : '<div class="mini">No tenés nada agendado en los próximos 30 días.</div>'}
      </div>`;

    cajaProx.querySelectorAll('[data-ev]').forEach((n) =>
      n.addEventListener('click', () => dialogoDia(n.dataset.evFecha, pintar))
    );
  }

  pintar();
}

/* ---------- Diálogos ---------- */

function dialogoDia(iso, alCambiar) {
  const eventos = eventosDe(iso);
  const m = modal(fechaLarga(iso), `
    <div data-lista></div>
    <button class="btn btn--primario mt-16" data-agregar style="width:100%">+ Agendar en este día</button>
  `, { ancho: '520px' });

  function pintarLista() {
    const lista = m.cuerpo.querySelector('[data-lista]');
    const evs = eventosDe(iso);
    if (!evs.length) {
      lista.innerHTML = '<div class="mini">Nada agendado este día.</div>';
      return;
    }
    lista.innerHTML = evs
      .map((e) => `
        <div class="cortina" style="margin-bottom:.6rem">
          <div class="cortina__cab">
            <span class="chip chip--${e.tipo === 'instalacion' ? 'verde' : e.tipo === 'visita' ? 'azul' : 'gris'}">${esc(TIPOS_EVENTO[e.tipo] || e.tipo)}</span>
            ${e.hora ? `<span class="mini">${esc(e.hora)}</span>` : ''}
            <div style="margin-left:auto;display:flex;gap:.2rem">
              ${e.origen === 'agenda' ? `<button class="btn-icono" data-editar="${e.id}" title="Editar">✎</button><button class="btn-icono" data-borrar="${e.id}" title="Borrar">✕</button>` : `<button class="btn btn--chico" data-ver="${e.pedidoId}">Ver pedido</button>`}
            </div>
          </div>
          <div style="font-weight:650">${esc(e.titulo)}</div>
          ${e.direccion ? `<div class="mini">📍 ${esc(e.direccion)}</div>` : ''}
          ${e.telefono ? `<div class="mini">📞 <a href="tel:${esc(e.telefono)}">${esc(e.telefono)}</a></div>` : ''}
          ${e.notas ? `<div class="mini mt-16">${esc(e.notas)}</div>` : ''}
          ${e.origen === 'agenda' ? `
            <div class="check mt-16">
              <label class="switch"><input type="checkbox" data-hecho="${e.id}"${e.hecho ? ' checked' : ''}><span class="switch__pista"></span></label>
              <span>Hecho</span>
            </div>` : ''}
        </div>`)
      .join('');

    lista.querySelectorAll('[data-borrar]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!(await confirmar('¿Borrar este evento?', { textoOk: 'Borrar', peligro: true }))) return;
        await borrar('agenda', b.dataset.borrar);
        pintarLista();
        alCambiar?.();
      })
    );
    lista.querySelectorAll('[data-editar]').forEach((b) =>
      b.addEventListener('click', () => {
        const ev = estado.agenda.find((x) => x.id === b.dataset.editar);
        m.cerrar();
        dialogoEvento(ev, iso, alCambiar);
      })
    );
    lista.querySelectorAll('[data-hecho]').forEach((b) =>
      b.addEventListener('change', async () => {
        const ev = estado.agenda.find((x) => x.id === b.dataset.hecho);
        if (ev) await guardar('agenda', { ...ev, hecho: b.checked });
        pintarLista();
        alCambiar?.();
      })
    );
    lista.querySelectorAll('[data-ver]').forEach((b) =>
      b.addEventListener('click', () => {
        m.cerrar();
        navegar(`/pedido/${b.dataset.ver}`);
      })
    );
  }

  m.cuerpo.querySelector('[data-agregar]').onclick = () => {
    m.cerrar();
    dialogoEvento(null, iso, alCambiar);
  };

  pintarLista();
}

function dialogoEvento(ev, iso, alCambiar) {
  const e = ev || { tipo: 'visita', fecha: iso, hora: '', titulo: '', cliente: '', direccion: '', telefono: '', notas: '', hecho: false };
  const m = modal(ev ? 'Editar evento' : 'Agendar', `
    <div class="campos campos--2">
      <div><label>Tipo</label><select id="ev-tipo">${Object.entries(TIPOS_EVENTO).map(([k, v]) => `<option value="${k}"${e.tipo === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>Título</label><input id="ev-titulo" value="${esc(e.titulo)}" placeholder="Ej. Medición living"></div>
    </div>
    <div class="campos campos--2 mt-16">
      <div><label>Fecha</label><input id="ev-fecha" type="date" value="${esc(e.fecha)}"></div>
      <div><label>Hora</label><input id="ev-hora" type="time" value="${esc(e.hora || '')}"></div>
    </div>
    <div class="campos campos--2 mt-16">
      <div><label>Cliente</label><input id="ev-cliente" value="${esc(e.cliente || '')}" list="lista-clientes"></div>
      <div><label>Teléfono</label><input id="ev-telefono" type="tel" value="${esc(e.telefono || '')}"></div>
    </div>
    <datalist id="lista-clientes">
      ${[...new Set([...estado.presupuestos, ...estado.pedidos].map((x) => x.cliente?.nombre).filter(Boolean))].map((n) => `<option value="${esc(n)}">`).join('')}
    </datalist>
    <div class="campo mt-16"><label>Dirección</label><input id="ev-direccion" value="${esc(e.direccion || '')}"></div>
    <div class="campo"><label>Notas</label><textarea id="ev-notas">${esc(e.notas || '')}</textarea></div>
    <div class="fila-botones fila-botones--fin mt-16">
      <button class="btn btn--fantasma" data-cerrar>Cancelar</button>
      <button class="btn btn--primario" id="ev-ok">Guardar</button>
    </div>`, { ancho: '560px' });

  // Autocompletar datos al elegir un cliente conocido
  m.cuerpo.querySelector('#ev-cliente').addEventListener('change', (evt) => {
    const nombre = evt.target.value.trim().toLowerCase();
    const doc = [...estado.pedidos, ...estado.presupuestos].find((x) => (x.cliente?.nombre || '').trim().toLowerCase() === nombre);
    if (!doc) return;
    const dir = m.cuerpo.querySelector('#ev-direccion');
    const tel = m.cuerpo.querySelector('#ev-telefono');
    if (!dir.value) dir.value = doc.cliente?.direccion || '';
    if (!tel.value) tel.value = doc.cliente?.telefono || '';
  });

  m.cuerpo.querySelector('#ev-ok').onclick = async () => {
    const titulo = m.cuerpo.querySelector('#ev-titulo').value.trim();
    const cliente = m.cuerpo.querySelector('#ev-cliente').value.trim();
    if (!titulo && !cliente) return aviso('Poné un título o un cliente.', 'error');
    await guardar('agenda', {
      ...(ev || {}),
      tipo: m.cuerpo.querySelector('#ev-tipo').value,
      titulo: titulo || cliente,
      fecha: m.cuerpo.querySelector('#ev-fecha').value || iso,
      hora: m.cuerpo.querySelector('#ev-hora').value,
      cliente,
      telefono: m.cuerpo.querySelector('#ev-telefono').value.trim(),
      direccion: m.cuerpo.querySelector('#ev-direccion').value.trim(),
      notas: m.cuerpo.querySelector('#ev-notas').value.trim(),
      hecho: e.hecho || false,
    });
    m.cerrar();
    aviso('Evento agendado.');
    alCambiar?.();
  };
}
