// Capa de datos: caché local siempre + sincronización con Supabase.
//
// La URL y la clave pública de acá abajo son públicas a propósito: son las que
// viajan dentro de cualquier app web de Supabase y por sí solas no abren nada.
// Está verificado: sin sesión, las cinco tablas contestan 401. Lo que da acceso
// es el email y la contraseña, no la clave.
//
// Esto se apoya en dos cosas que viven en Supabase, no acá:
//   1. RLS prendido y política solo para "authenticated" (privado/supabase.sql).
//   2. El registro público apagado, así que nadie puede crearse una cuenta.
// Si alguna de las dos se desactiva, esta clave pasa a ser una puerta abierta.

import { configVacia } from './calc.js';
import { migrarConfig } from './migraciones.js';

export const SUPABASE = {
  url: 'https://jnldoyyctyvxgwngwqsl.supabase.co',
  clave: 'sb_publishable__RaSRNt6pICCVjvGGAjOJg_E4EMDKrK',
};

const CLAVE_DATOS = 'zr_datos_v1';
const CLAVE_SESION = 'zr_sesion_v1';

export const COLECCIONES = ['presupuestos', 'pedidos', 'agenda', 'movimientos'];
const TABLAS = {
  config: 'zr_config',
  presupuestos: 'zr_presupuestos',
  pedidos: 'zr_pedidos',
  agenda: 'zr_agenda',
  movimientos: 'zr_movimientos',
};

const oyentes = new Set();

/**
 * ¿Pudimos leer la config de la nube en esta sesión?
 *
 * Mientras la respuesta sea que no, la copia que tenemos en este aparato puede
 * estar vieja o recién estrenada (toda en cero), y subirla pisaría la de todos
 * los demás. Así que no se sube: se guarda acá y se manda recién cuando la
 * nube conteste y se pueda comparar cuál es más nueva (ver faltaSubirConfig).
 *
 * Esto pasó de verdad: alguien abrió la app por primera vez en su aparato, esa
 * primera lectura falló, y la configuración en blanco terminó arriba de la
 * buena. Los precios de todos volvieron a cero.
 */
let configConfirmada = false;

/**
 * Lo que se guardó en este aparato y todavía no pudo subir: un pago, un cambio
 * de estado, un pedido nuevo. Se guarda junto con los datos, así que aguanta
 * cerrar la app, y se reintenta en cada sincronización.
 *
 * Sin esto, un cambio que no llegaba a la nube —porque se venció la sesión o
 * no había señal— lo borraba la próxima sincronización sin decir nada: al bajar
 * las filas de la nube se reemplazaba todo lo que había acá. Así se perdió un
 * día entero de pagos y de cambios de estado.
 */
let pendientes = [];

function anotarPendiente(coleccion, id, borrado = false) {
  pendientes = pendientes.filter((p) => !(p.coleccion === coleccion && p.id === id));
  pendientes.push({ coleccion, id, borrado });
  escribirLocal();
  contarPendientes();
}

function sacarPendiente(coleccion, id) {
  const antes = pendientes.length;
  pendientes = pendientes.filter((p) => !(p.coleccion === coleccion && p.id === id));
  if (pendientes.length === antes) return;
  escribirLocal();
  contarPendientes();
}

/** Cuántos cambios están esperando para subir. Se muestra en el encabezado. */
function contarPendientes() {
  estado.sync = { ...estado.sync, pendientes: pendientes.length };
  avisar();
}

export const estado = {
  config: configVacia(),
  presupuestos: [],
  pedidos: [],
  agenda: [],
  movimientos: [],
  sesion: { activa: false, email: '', rol: '' },
  sync: { activa: false, estado: 'local', mensaje: 'Guardando solo en este dispositivo', ultima: null },
};

export function suscribir(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function avisar() {
  oyentes.forEach((fn) => {
    try {
      fn(estado);
    } catch (err) {
      console.error('Error en oyente', err);
    }
  });
}

/* ---------- Sesión ---------- */

export function leerSesion() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE_SESION));
    return s?.refresh_token ? s : null;
  } catch {
    return null;
  }
}

/**
 * El rol del usuario, que decide qué pantallas ve (ver permisos.js). Sale de
 * `app_metadata`, que sólo se edita desde el panel de Supabase: el propio
 * usuario no puede cambiárselo con su token. Si no dice nada, es el dueño.
 */
function rolDelToken(access_token) {
  try {
    const cuerpo = String(access_token || '').split('.')[1];
    const json = JSON.parse(atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/')));
    return String(json?.app_metadata?.rol || '');
  } catch {
    return '';
  }
}

/** Guarda lo que devuelve Supabase y anota cuándo hay que renovar. */
function anotarSesion(datos, email) {
  const sesion = {
    access_token: datos.access_token,
    refresh_token: datos.refresh_token,
    // Un minuto de colchón: no queremos usar un token que vence en el camino.
    expira: Date.now() + (Number(datos.expires_in) || 3600) * 1000 - 60000,
    email: datos.user?.email || email || '',
    rol: String(datos.user?.app_metadata?.rol || '') || rolDelToken(datos.access_token),
  };
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  estado.sesion = { activa: true, email: sesion.email, rol: sesion.rol };
  return sesion;
}

export function cerrarSesion() {
  localStorage.removeItem(CLAVE_SESION);
  estado.sesion = { activa: false, email: '', rol: '' };
  estado.sync = { activa: false, estado: 'local', mensaje: 'Sin sesión — guardando solo en este dispositivo', ultima: null };
  avisar();
}

async function pedirToken(cuerpo, tipo) {
  const res = await fetch(`${SUPABASE.url}/auth/v1/token?grant_type=${tipo}`, {
    method: 'POST',
    headers: { apikey: SUPABASE.clave, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error_description || datos.msg || datos.error || `Error ${res.status}`);
  return datos;
}

export async function iniciarSesion(email, contrasena) {
  const datos = await pedirToken({ email: String(email || '').trim(), password: contrasena }, 'password');
  anotarSesion(datos, email);
  avisar();
  return true;
}

/**
 * Un access token vigente, renovándolo si venció. Devuelve null si no hay
 * sesión o si el refresh ya no sirve (ahí hay que volver a entrar).
 */
async function token() {
  const s = leerSesion();
  if (!s) return null;
  if (s.access_token && Date.now() < Number(s.expira || 0)) return s.access_token;
  try {
    const datos = await pedirToken({ refresh_token: s.refresh_token }, 'refresh_token');
    return anotarSesion(datos, s.email).access_token;
  } catch {
    // Sin internet no se puede renovar, pero la sesión sigue siendo válida:
    // se reintenta en la próxima sincronización.
    if (!navigator.onLine) return null;
    cerrarSesion();
    return null;
  }
}

async function pedir(ruta, opciones = {}) {
  const t = await token();
  if (!t) throw new Error('Se venció la sesión. Entrá de nuevo.');
  const res = await fetch(`${SUPABASE.url}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SUPABASE.clave,
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
      ...opciones.headers,
    },
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${texto.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

/* ---------- Caché local ---------- */

function leerLocal() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_DATOS)) || null;
  } catch {
    return null;
  }
}

function escribirLocal() {
  const datos = {
    config: estado.config,
    presupuestos: estado.presupuestos,
    pedidos: estado.pedidos,
    agenda: estado.agenda,
    movimientos: estado.movimientos,
    pendientes,
  };
  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
  } catch (err) {
    console.error('No se pudo guardar en este dispositivo', err);
  }
}

/* ---------- Carga inicial ---------- */

export async function iniciar() {
  const local = leerLocal();
  if (local) {
    estado.config = { ...configVacia(), ...(local.config || {}) };
    COLECCIONES.forEach((c) => {
      estado[c] = Array.isArray(local[c]) ? local[c] : [];
    });
    pendientes = Array.isArray(local.pendientes) ? local.pendientes : [];
    contarPendientes();
  }

  const s = leerSesion();
  estado.sesion = { activa: !!s, email: s?.email || '', rol: s?.rol || rolDelToken(s?.access_token) };
  avisar();

  if (s) await sincronizar();
  else await aplicarMigraciones();
  return estado;
}

/** Trae todo desde Supabase y reemplaza la caché local. */
export async function sincronizar() {
  if (!leerSesion()) {
    estado.sync = { activa: false, estado: 'local', mensaje: 'Sin sesión — guardando solo en este dispositivo', ultima: null };
    avisar();
    return;
  }
  estado.sync = { ...estado.sync, activa: true, estado: 'sincronizando', mensaje: 'Sincronizando…' };
  avisar();

  let faltaSubirConfig = false;

  try {
    const [config, ...resto] = await Promise.all([
      pedir(`${TABLAS.config}?select=*&id=eq.principal`),
      ...COLECCIONES.map((c) => pedir(`${TABLAS[c]}?select=*&borrado=is.false&order=actualizado.desc`)),
    ]);

    // La nube contestó. Puede no haber fila todavía (cuenta nueva), pero ya
    // sabemos qué hay allá, así que de acá en más se puede comparar y subir.
    configConfirmada = true;

    if (Array.isArray(config) && config[0]?.datos) {
      // La config de la nube manda, salvo que la de acá sea más nueva y todavía
      // no haya subido (se guardó algo sin señal, o falló el envío). En ese
      // caso gana la de acá y se sube: lo último que cargaste no se pierde.
      const deLaNube = config[0].datos;
      const cuando = (c, fila) => Date.parse(c?.actualizado || fila?.actualizado || '') || 0;
      if (cuando(deLaNube, config[0]) >= cuando(estado.config)) {
        estado.config = { ...configVacia(), ...deLaNube };
      } else {
        faltaSubirConfig = true;
      }
    }
    COLECCIONES.forEach((c, i) => {
      const filas = resto[i];
      if (!Array.isArray(filas)) return;
      const bajadas = new Map(filas.map((f) => [f.id, { ...f.datos, id: f.id, actualizado: f.actualizado }]));
      // Lo que todavía no subió manda sobre lo que baja: si no, la nube le
      // pasa por encima a un pago que acá está y allá todavía no. Ver pendientes.
      pendientes.filter((p) => p.coleccion === c).forEach((p) => {
        if (p.borrado) {
          bajadas.delete(p.id);
          return;
        }
        const local = estado[c].find((r) => r.id === p.id);
        if (local) bajadas.set(p.id, local);
      });
      estado[c] = [...bajadas.values()];
    });

    escribirLocal();
    // Con la nube contestando, se reintenta lo que había quedado a medio camino.
    await subirPendientes();
    estado.sync = {
      activa: true,
      estado: 'ok',
      mensaje: 'Sincronizado con la nube',
      ultima: new Date().toISOString(),
    };
    if (faltaSubirConfig) await guardarConfig({});
  } catch (err) {
    console.error(err);
    estado.sync = {
      activa: true,
      estado: 'error',
      mensaje: `Sin conexión con la nube — se guarda en este dispositivo. ${err.message}`,
      ultima: estado.sync.ultima,
    };
  }
  // Va al final y fuera del try: si el código trae un catálogo nuevo, hay que
  // acomodarlo tanto sobre lo que bajó de la nube como sobre lo que quedó acá
  // cuando no hubo señal.
  await aplicarMigraciones();
  // estado.sync se rearma entero más arriba, así que el contador de lo que
  // falta subir se vuelve a poner acá.
  contarPendientes();
}

/**
 * Pone al día la config guardada cuando el código trae novedades que la mezcla
 * no alcanza a traer sola (catálogos nuevos de telas y sistemas). Nunca toca
 * precios. Ver migraciones.js.
 */
async function aplicarMigraciones() {
  // Nunca sobre una config sin confirmar: migrar la escribe, y escribirla la
  // sube. Si la nube no contestó, esto espera a la próxima sincronización.
  if (leerSesion() && !configConfirmada) return;
  const cambios = migrarConfig(estado.config);
  if (cambios) await guardarConfig(cambios);
}

/* ---------- Escritura ---------- */

async function subirFila(coleccion, registro) {
  if (!leerSesion()) return;
  const fila = {
    id: registro.id,
    datos: { ...registro },
    actualizado: new Date().toISOString(),
    borrado: false,
  };
  delete fila.datos.actualizado;
  try {
    await pedir(`${TABLAS[coleccion]}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(fila),
    });
    sacarPendiente(coleccion, registro.id);
    estado.sync = { ...estado.sync, estado: 'ok', mensaje: 'Sincronizado con la nube', ultima: new Date().toISOString() };
  } catch (err) {
    console.error(err);
    // Queda anotado para reintentarlo, y sobre todo para que la próxima
    // sincronización no lo pise con lo que haya en la nube.
    anotarPendiente(coleccion, registro.id);
    estado.sync = { ...estado.sync, estado: 'error', mensaje: `Guardado en este dispositivo, falta subir a la nube. ${err.message}` };
  }
}

/** Marca una fila como borrada en la nube. Devuelve si pudo. */
async function borrarFila(coleccion, id) {
  try {
    await pedir(`${TABLAS[coleccion]}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ borrado: true, actualizado: new Date().toISOString() }),
    });
    sacarPendiente(coleccion, id);
    return true;
  } catch (err) {
    console.error(err);
    anotarPendiente(coleccion, id, true);
    estado.sync = { ...estado.sync, estado: 'error', mensaje: `Borrado acá, falta sincronizar. ${err.message}` };
    avisar();
    return false;
  }
}

/** Reintenta todo lo que había quedado sin subir. */
async function subirPendientes() {
  for (const p of [...pendientes]) {
    if (p.borrado) {
      await borrarFila(p.coleccion, p.id);
      continue;
    }
    const item = estado[p.coleccion]?.find((r) => r.id === p.id);
    if (item) await subirFila(p.coleccion, item);
    else sacarPendiente(p.coleccion, p.id);
  }
}

export async function guardarConfig(nuevaConfig) {
  // La hora del último cambio viaja adentro de la config: con eso se decide,
  // al sincronizar, si manda la de acá o la de la nube.
  estado.config = { ...estado.config, ...nuevaConfig, actualizado: new Date().toISOString() };
  escribirLocal();
  avisar();

  if (!leerSesion()) return;
  if (!configConfirmada) {
    // Ver configConfirmada: se guardó acá y sube sola cuando la nube conteste.
    estado.sync = {
      ...estado.sync,
      estado: 'error',
      mensaje: 'Guardado en este dispositivo. Todavía no pude leer la configuración de la nube, así que no la piso hasta sincronizar.',
    };
    avisar();
    return;
  }
  try {
    await pedir(`${TABLAS.config}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 'principal', datos: estado.config, actualizado: new Date().toISOString() }),
    });
    estado.sync = { ...estado.sync, estado: 'ok', mensaje: 'Sincronizado con la nube', ultima: new Date().toISOString() };
  } catch (err) {
    console.error(err);
    estado.sync = { ...estado.sync, estado: 'error', mensaje: `Guardado en este dispositivo, falta subir a la nube. ${err.message}` };
  }
  avisar();
}

export async function guardar(coleccion, registro) {
  if (!COLECCIONES.includes(coleccion)) throw new Error(`Colección desconocida: ${coleccion}`);
  const item = { ...registro };
  if (!item.id) item.id = crypto.randomUUID();
  if (!item.creado) item.creado = new Date().toISOString();
  item.actualizado = new Date().toISOString();

  const lista = estado[coleccion];
  const i = lista.findIndex((r) => r.id === item.id);
  if (i >= 0) lista[i] = item;
  else lista.unshift(item);

  escribirLocal();
  avisar();
  await subirFila(coleccion, item);
  avisar();
  return item;
}

export async function borrar(coleccion, id) {
  estado[coleccion] = estado[coleccion].filter((r) => r.id !== id);
  escribirLocal();
  avisar();

  if (!leerSesion()) return;
  await borrarFila(coleccion, id);
}

export function obtener(coleccion, id) {
  return estado[coleccion].find((r) => r.id === id) || null;
}

/** Número correlativo por colección, con prefijo. Ej: P-0042 / OT-0042 */
export function proximoNumero(coleccion, prefijo) {
  const usados = estado[coleccion]
    .map((r) => Number(String(r.numero || '').replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  const siguiente = (usados.length ? Math.max(...usados) : 0) + 1;
  return `${prefijo}-${String(siguiente).padStart(4, '0')}`;
}

/* ---------- Respaldo ---------- */

export function exportarRespaldo() {
  return {
    version: 1,
    generado: new Date().toISOString(),
    config: estado.config,
    presupuestos: estado.presupuestos,
    pedidos: estado.pedidos,
    agenda: estado.agenda,
    movimientos: estado.movimientos,
  };
}

export async function importarRespaldo(datos, { reemplazar = false } = {}) {
  if (!datos || typeof datos !== 'object') throw new Error('El archivo no tiene el formato esperado.');

  if (datos.config) estado.config = { ...configVacia(), ...datos.config };

  for (const c of COLECCIONES) {
    const entrantes = Array.isArray(datos[c]) ? datos[c] : [];
    if (reemplazar) {
      estado[c] = entrantes;
    } else {
      const porId = new Map(estado[c].map((r) => [r.id, r]));
      entrantes.forEach((r) => porId.set(r.id, r));
      estado[c] = [...porId.values()];
    }
  }

  escribirLocal();
  avisar();

  if (leerSesion()) {
    await guardarConfig(estado.config);
    for (const c of COLECCIONES) {
      for (const r of estado[c]) await subirFila(c, r);
    }
    avisar();
  }
}
