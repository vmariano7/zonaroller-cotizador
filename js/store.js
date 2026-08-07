// Capa de datos: caché local siempre + sincronización con Supabase cuando está configurada.
// Las credenciales de Supabase NUNCA viven en el código: las carga el usuario en
// Configuración y quedan en el localStorage de cada dispositivo.

import { configVacia } from './calc.js';

const CLAVE_DATOS = 'zr_datos_v1';
const CLAVE_CONEXION = 'zr_conexion_v1';

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

/* ---------- Conexión a Supabase ---------- */

export function leerConexion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CONEXION)) || null;
  } catch {
    return null;
  }
}

export function guardarConexion(url, clave) {
  const limpia = (url || '').trim().replace(/\/+$/, '');
  if (!limpia || !clave) {
    localStorage.removeItem(CLAVE_CONEXION);
    estado.sync = { activa: false, estado: 'local', mensaje: 'Guardando solo en este dispositivo', ultima: null };
    avisar();
    return;
  }
  localStorage.setItem(CLAVE_CONEXION, JSON.stringify({ url: limpia, clave: clave.trim() }));
}

function cabeceras(conexion, extra = {}) {
  return {
    apikey: conexion.clave,
    Authorization: `Bearer ${conexion.clave}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function pedir(conexion, ruta, opciones = {}) {
  const res = await fetch(`${conexion.url}/rest/v1/${ruta}`, {
    ...opciones,
    headers: cabeceras(conexion, opciones.headers),
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${texto.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

export async function probarConexion(url, clave) {
  const conexion = { url: (url || '').trim().replace(/\/+$/, ''), clave: (clave || '').trim() };
  if (!conexion.url || !conexion.clave) throw new Error('Falta la URL o la clave.');
  await pedir(conexion, `${TABLAS.presupuestos}?select=id&limit=1`);
  return true;
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
  avisar();

  const conexion = leerConexion();
  if (conexion) await sincronizar();
  return estado;
}

/** Trae todo desde Supabase y reemplaza la caché local. */
export async function sincronizar() {
  const conexion = leerConexion();
  if (!conexion) {
    estado.sync = { activa: false, estado: 'local', mensaje: 'Guardando solo en este dispositivo', ultima: null };
    avisar();
    return;
  }
  estado.sync = { ...estado.sync, activa: true, estado: 'sincronizando', mensaje: 'Sincronizando…' };
  avisar();

  try {
    const [config, ...resto] = await Promise.all([
      pedir(conexion, `${TABLAS.config}?select=*&id=eq.principal`),
      ...COLECCIONES.map((c) => pedir(conexion, `${TABLAS[c]}?select=*&borrado=is.false&order=actualizado.desc`)),
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
  const conexion = leerConexion();
  if (!conexion) return;
  const fila = {
    id: registro.id,
    datos: { ...registro },
    actualizado: new Date().toISOString(),
    borrado: false,
  };
  delete fila.datos.actualizado;
  try {
    await pedir(conexion, `${TABLAS[coleccion]}?on_conflict=id`, {
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

  const conexion = leerConexion();
  if (!conexion) return;
  try {
    await pedir(conexion, `${TABLAS.config}?on_conflict=id`, {
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

  const conexion = leerConexion();
  if (!conexion) return;
  try {
    await pedir(conexion, `${TABLAS[coleccion]}?id=eq.${encodeURIComponent(id)}`, {
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

  if (leerConexion()) {
    await guardarConfig(estado.config);
    for (const c of COLECCIONES) {
      for (const r of estado[c]) await subirFila(c, r);
    }
    avisar();
  }
}
