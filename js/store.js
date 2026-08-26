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

export const estado = {
  config: configVacia(),
  presupuestos: [],
  pedidos: [],
  agenda: [],
  movimientos: [],
  sesion: { activa: false, email: '' },
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

/** Guarda lo que devuelve Supabase y anota cuándo hay que renovar. */
function anotarSesion(datos, email) {
  const sesion = {
    access_token: datos.access_token,
    refresh_token: datos.refresh_token,
    // Un minuto de colchón: no queremos usar un token que vence en el camino.
    expira: Date.now() + (Number(datos.expires_in) || 3600) * 1000 - 60000,
    email: datos.user?.email || email || '',
  };
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  estado.sesion = { activa: true, email: sesion.email };
  return sesion;
}

export function cerrarSesion() {
  localStorage.removeItem(CLAVE_SESION);
  estado.sesion = { activa: false, email: '' };
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
  }

  const s = leerSesion();
  estado.sesion = { activa: !!s, email: s?.email || '' };
  avisar();

  if (s) await sincronizar();
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

  try {
    const [config, ...resto] = await Promise.all([
      pedir(`${TABLAS.config}?select=*&id=eq.principal`),
      ...COLECCIONES.map((c) => pedir(`${TABLAS[c]}?select=*&borrado=is.false&order=actualizado.desc`)),
    ]);

    if (Array.isArray(config) && config[0]?.datos) {
      estado.config = { ...configVacia(), ...config[0].datos };
    }
    COLECCIONES.forEach((c, i) => {
      const filas = resto[i];
      if (Array.isArray(filas)) estado[c] = filas.map((f) => ({ ...f.datos, id: f.id, actualizado: f.actualizado }));
    });

    escribirLocal();
    estado.sync = {
      activa: true,
      estado: 'ok',
      mensaje: 'Sincronizado con la nube',
      ultima: new Date().toISOString(),
    };
  } catch (err) {
    console.error(err);
    estado.sync = {
      activa: true,
      estado: 'error',
      mensaje: `Sin conexión con la nube — se guarda en este dispositivo. ${err.message}`,
      ultima: estado.sync.ultima,
    };
  }
  avisar();
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
    estado.sync = { ...estado.sync, estado: 'ok', mensaje: 'Sincronizado con la nube', ultima: new Date().toISOString() };
  } catch (err) {
    console.error(err);
    estado.sync = { ...estado.sync, estado: 'error', mensaje: `Guardado en este dispositivo, falta subir a la nube. ${err.message}` };
  }
}

export async function guardarConfig(nuevaConfig) {
  estado.config = { ...estado.config, ...nuevaConfig };
  escribirLocal();
  avisar();

  if (!leerSesion()) return;
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
  try {
    await pedir(`${TABLAS[coleccion]}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ borrado: true, actualizado: new Date().toISOString() }),
    });
  } catch (err) {
    console.error(err);
    estado.sync = { ...estado.sync, estado: 'error', mensaje: `Borrado acá, falta sincronizar. ${err.message}` };
    avisar();
  }
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
