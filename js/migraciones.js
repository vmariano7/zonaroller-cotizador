// Migraciones de la configuración guardada.
//
// La config se guarda entera (en este dispositivo y en Supabase) y al leerla se
// mezcla por arriba de la vacía: `{ ...configVacia(), ...guardada }`. Esa mezcla
// es por clave, no por adentro, así que un catálogo nuevo en el código no llega
// nunca a una cuenta que ya tiene el suyo guardado: lo pisa entero el viejo.
// Por eso las novedades de catálogo se acomodan acá.
//
// Cada migración se aplica UNA sola vez y deja su marca en `config.migraciones`.
// Si después borrás o renombrás algo en Ajustes, no vuelve a aparecer.
//
// Lo que estas migraciones NO tocan nunca son los precios: los costos no viven
// en el código (el repo es público). Se cargan desde Ajustes → Respaldo →
// Importar lista de precios, o a mano en Ajustes.

import { TELAS_CORTINA, SISTEMAS, telaNormalizada, sistemaNormalizado } from './calc.js';

/** Las telas que traía el catálogo antes de tener los nombres del proveedor. */
const TELAS_VIEJAS = ['Blackout', 'Sunscreen 5%', 'Sunscreen 1%', 'South Beach', 'Shangtung', 'Córdoba', 'Blackout decorativo'];

/** Los dos sistemas de roller de antes: ahora el sistema se elige a mano. */
const ROLLER_VIEJOS = ['roller_basico', 'roller_demas'];

/** Los dos de vertical de antes: ahora hay uno solo para todas las telas. */
const VERTICALES_VIEJOS = ['vertical_basico', 'vertical_demas'];

const copiaTela = (t) => ({ nombre: t.nombre, colores: [...t.colores] });

/**
 * El catálogo de telas de un tipo, ya migrado.
 *
 * Si lo guardado son las telas de antes y nada más, se reemplaza por el
 * catálogo nuevo: son las mismas telas con los nombres del proveedor, y dejar
 * las dos listas juntas sería ver todo duplicado. Si en cambio hay telas
 * propias (agregadas o renombradas desde Ajustes), esas quedan donde están y
 * sólo se agregan las que falten.
 *
 * Los precios no se tocan: una tela vieja que ya no esté en la lista conserva
 * su costo guardado, así un presupuesto de entonces se sigue abriendo igual.
 */
function catalogoMigrado(guardadas) {
  const previas = (guardadas || []).map(telaNormalizada).filter((t) => t.nombre);
  const nuevas = TELAS_CORTINA.map(copiaTela);
  const soloViejas = previas.every((t) => TELAS_VIEJAS.includes(t.nombre));
  if (soloViejas) return nuevas;
  return [...previas, ...nuevas.filter((n) => !previas.some((p) => p.nombre === n.nombre))];
}

/**
 * El catálogo de sistemas, ya migrado: entran los de roller con su tipo y sus
 * colores, y los dos de antes quedan ocultos (siguen valiendo con su costo
 * para lo ya cotizado, pero no se ofrecen al armar una cortina nueva).
 */
function sistemasMigrados(guardados) {
  const previos = (guardados || []).map(sistemaNormalizado).filter((s) => s.id);
  const conOcultos = previos.map((s) => (ROLLER_VIEJOS.includes(s.id) ? { ...s, oculto: true } : s));
  const faltantes = Object.entries(SISTEMAS)
    .filter(([id]) => !conOcultos.some((s) => s.id === id))
    .map(([id, def]) => sistemaNormalizado({ id, ...def, protegido: true }));
  return [...conOcultos, ...faltantes];
}

const MIGRACIONES = [
  {
    // Telas de roller y vertical con los nombres y los colores del proveedor,
    // y los siete sistemas de roller para elegir a mano.
    clave: 'catalogo-cortinas-2026-10',
    cambios(config) {
      const catalogoTelas = { ...(config.catalogoTelas || {}) };
      catalogoTelas.roller = catalogoMigrado(catalogoTelas.roller);
      catalogoTelas.vertical = catalogoMigrado(catalogoTelas.vertical);
      return {
        catalogoTelas,
        catalogoSistemas: sistemasMigrados(config.catalogoSistemas),
      };
    },
  },
  {
    // Un solo sistema para todas las bandas verticales. Antes eran dos y los
    // repartía la tela ("básico" para blackouts y sunscreen 5%, "demás telas"
    // para el resto); esa mecánica ya no existe.
    clave: 'vertical-sistema-unico-2026-10',
    cambios(config) {
      const sistemas = { ...(config.sistemas || {}) };
      // El costo arranca con el más alto de los dos que había, para no cotizar
      // ninguna tela por debajo de lo que salía ayer. Se corrige en Ajustes.
      const deAntes = Math.max(...VERTICALES_VIEJOS.map((id) => Number(sistemas[id]) || 0));
      sistemas.vertical = Number(sistemas.vertical) || deAntes;
      VERTICALES_VIEJOS.forEach((id) => { delete sistemas[id]; });

      const catalogo = (config.catalogoSistemas || [])
        .map(sistemaNormalizado)
        .filter((s) => s.id && !VERTICALES_VIEJOS.includes(s.id));
      if (!catalogo.some((s) => s.id === 'vertical')) {
        catalogo.push(sistemaNormalizado({ id: 'vertical', ...SISTEMAS.vertical, protegido: true }));
      }

      // La lista de telas "del sistema básico" no la mira nadie más.
      return { sistemas, catalogoSistemas: catalogo, telasSistemaBasico: undefined };
    },
  },
];

/**
 * Lo que haya que cambiarle a esta config, o null si ya está al día.
 * Quien llama se encarga de guardarlo (ver store.js).
 */
export function migrarConfig(config) {
  const hechas = Array.isArray(config?.migraciones) ? config.migraciones : [];
  const pendientes = MIGRACIONES.filter((m) => !hechas.includes(m.clave));
  if (!pendientes.length) return null;

  let cambios = {};
  pendientes.forEach((m) => {
    cambios = { ...cambios, ...m.cambios({ ...config, ...cambios }) };
  });
  return { ...cambios, migraciones: [...hechas, ...pendientes.map((m) => m.clave)] };
}
