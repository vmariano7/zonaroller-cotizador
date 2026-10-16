// Motor de cálculo de cortinas.
// Fórmula: ((m² × precio tela) + (ancho en metros × precio sistema)) × (1 + incremento)
//          + lo que te sale el instalador. Eso da el precio de CONTADO; el de
//          lista sale de inflarlo para que aguante el descuento (ver factorLista).
//          Todo multiplicado por la cantidad.
// Tela tradicional usa su propia fórmula fija en vez de tela + sistema, pero
// pasa por el mismo incremento e igual conversión a contado/lista.
// Ningún lado se cobra por debajo del metro: ver MINIMO_LADO_M.

// Las telas de cortina, cada una con sus colores. Roller y bandas verticales
// se hacen con las mismas, así que las dos arrancan con este catálogo y
// después cada una se edita por separado en Ajustes. El precio va por m²; el
// color no lo cambia, salvo en Sun Screen 5%, donde cada color puede tener el
// suyo (ver precioTela).
export const TELAS_CORTINA = [
  { nombre: 'Black Out Vinílico EEUU', colores: ['Blanco', 'Beige', 'Gris', 'Ivory', 'Negro'] },
  { nombre: 'Black Out Vinílico ECO', colores: ['Blanco', 'Beige', 'Gris', 'Ivory'] },
  { nombre: 'Blackout Córdoba', colores: ['Nieve', 'Marfil', 'Centeno', 'Camel', 'Tostado', 'Grafito', 'Plomo'] },
  { nombre: 'Sun Screen 1%', colores: ['Blanco-Blanco', 'Blanco-Beige', 'Blanco-Gris', 'Negro-Negro'] },
  // El primero de la lista es el que sale por defecto al cotizar, así que va
  // uno de los más baratos: los demás suben el precio (ver precioTela).
  { nombre: 'Sun Screen 5%', colores: [
    'Blanco-Blanco', 'Blanco-Beige', 'Blanco-Gris',
    'Beige-Beige', 'Gris-Gris', 'Negro-Negro', 'Chocolate-Chocolate',
    'Amarillo-Blanco', 'Verde-Blanco', 'Rojo-Blanco', 'Azul-Blanco',
  ] },
  { nombre: 'Sun Screen 5% Bicolor', colores: ['Bronce', 'Ceniza', 'Caliza', 'Cromo', 'Hierro', 'Cobre', 'Níquel', 'Carbón'] },
  { nombre: 'Sun Screen 5% ECO', colores: ['Blanco-Blanco', 'Blanco-Beige.02', 'Blanco-Gris.03', 'Beige-Beige'] },
  { nombre: 'South Beach', colores: ['Safari', 'Blanco', 'Latte', 'Arena', 'Cielo', 'Natural'] },
  { nombre: 'Córdoba', colores: ['Nieve', 'Marfil', 'Centeno', 'Camel', 'Tostado', 'Grafito', 'Plomo'] },
  { nombre: 'Shantung', colores: ['Pistacho', 'Gris Claro', 'Tierra', 'Gris Oscuro'] },
  { nombre: 'Lux', colores: ['Blanco', 'Ivory', 'Beige', 'Chocolate', 'Esmeralda', 'Perla', 'Terracota', 'Rojo', 'Gris Cemento', 'Tostado'] },
];

/** Una copia propia del catálogo, para que tocar un tipo no toque el otro. */
export const telasCortina = () => TELAS_CORTINA.map((t) => ({ ...t, colores: [...t.colores] }));

/**
 * Telas que usan el sistema "básico" (el más económico) en roller y vertical:
 * los blackouts y las Sun Screen 5%, que es justo lo que dice el nombre del
 * sistema de verticales. El resto usa el de "demás telas".
 * Los dos primeros son los nombres que tenía el catálogo anterior: quedan en
 * la lista para que un renglón cotizado entonces siga saliendo con el mismo
 * sistema con el que salió ese día.
 */
export const TELAS_SISTEMA_BASICO = [
  'Blackout', 'Sunscreen 5%',
  'Black Out Vinílico EEUU', 'Black Out Vinílico ECO', 'Blackout Córdoba',
  'Sun Screen 5%', 'Sun Screen 5% Bicolor', 'Sun Screen 5% ECO',
];

export const TIPOS = {
  roller: {
    nombre: 'Roller',
    telas: telasCortina(),
  },
  vertical: {
    nombre: 'Bandas verticales',
    telas: telasCortina(),
  },
  zebra: {
    nombre: 'Zebra',
    telas: ['Zebra Basic', 'Zebra Woody', 'Zebra Blackout'],
  },
  tela_tradicional: {
    nombre: 'Cortina Tela Tradicional',
    telas: ['GASA PAÑALERA', 'BO JULLIETTE', 'BO MELODY', 'BO TEXTIL M', 'BO TRIADA', 'BO VIVA', 'GASA LANIN', 'GASA LARISA', 'GASA LICIA', 'GASA LOLA', 'GASA PORTOBELO', 'GASA TRAFUL', 'GASA TUSOR', 'LOOP', 'OTTOMAN', 'PATAGONIA TEXTIL', 'TRIADA', 'TUSSOR POLIDON', 'USHUAIA', 'VOILE DE LINO', 'VOILE LOURDES'],
    colores: ['BLANCO OPTICO', 'CRUDO', 'GRIS CLARO', 'GRIS', 'GRIS OSCURO', 'BEIGE', 'MARFIL', 'HUMO', 'NEGRO'],
    paños: [1, 2],
    recogimientos: ['Derecha', 'Izquierda', 'Central', 'Motorizada Izquierda', 'Motorizada Derecha', 'Motorizada Central', 'Sin Guía'],
    pliegues: ['Pellizco simple', 'Pellizco doble', 'Tabla encontrada', 'Tabla pisada'],
  },
};

// Cada sistema dice a qué tipo de cortina pertenece y de qué colores viene.
// El costo (por metro lineal) se carga en Ajustes y no depende del color.
export const SISTEMAS = {
  roller_mini_18: { nombre: 'MINI 18mm', tipo: 'roller', colores: ['Blanco', 'Negro'] },
  roller_zenith_32: { nombre: 'ZENITH 32mm', tipo: 'roller', colores: ['Blanco', 'Gris', 'Negro'] },
  roller_zenith_38: { nombre: 'ZENITH 38mm', tipo: 'roller', colores: ['Blanco', 'Gris', 'Negro'] },
  roller_zenith_50: { nombre: 'ZENITH 50mm', tipo: 'roller', colores: ['Blanco', 'Negro'] },
  roller_quantum_28: { nombre: 'QUANTUM 28mm', tipo: 'roller', colores: ['Blanco', 'Gris', 'Negro'] },
  roller_quantum_38: { nombre: 'QUANTUM 38mm', tipo: 'roller', colores: ['Blanco', 'Gris', 'Negro'] },
  roller_quantum_45: { nombre: 'QUANTUM 45mm', tipo: 'roller', colores: ['Blanco', 'Negro'] },
  vertical_basico: { nombre: 'Vertical · Blackout / Sunscreen 5%', tipo: 'vertical', colores: [] },
  vertical_demas: { nombre: 'Vertical · Demás telas', tipo: 'vertical', colores: [] },
  zebra: { nombre: 'Sistema Zebra', tipo: 'zebra', colores: [] },
};

/** Los tipos de cortina en los que el sistema se elige a mano al cotizar. */
const ELIGE_SISTEMA = ['roller'];

/** El que viene puesto en una cortina nueva. El resto arranca sin elegir. */
export const SISTEMA_POR_DEFECTO = { roller: 'roller_zenith_32' };

/** ¿En este tipo de cortina el sistema se elige a mano? */
export function eligeSistema(tipo) {
  return ELIGE_SISTEMA.includes(tipo);
}

/**
 * De qué tipo es un sistema guardado que no lo dice (configs de antes de que
 * los sistemas supieran a qué cortina pertenecen). Se deduce de la clave.
 */
function tipoDeSistemaPorId(id) {
  const clave = String(id || '');
  // Los paneles orientales ya no se cotizan, pero la clave se sigue
  // reconociendo para que esos sistemas no aparezcan más en Ajustes (ver
  // TIPOS_RETIRADOS).
  if (clave.startsWith('panel_oriental')) return 'panel_oriental';
  if (clave.startsWith('roller')) return 'roller';
  if (clave.startsWith('vertical')) return 'vertical';
  if (clave === 'zebra') return 'zebra';
  return '';
}

/** Un sistema del catálogo, con todos sus campos, venga como venga. */
export function sistemaNormalizado(s) {
  const id = String(s?.id || '');
  return {
    id,
    nombre: String(s?.nombre || ''),
    tipo: s?.tipo || tipoDeSistemaPorId(id),
    colores: Array.isArray(s?.colores) ? [...s.colores] : [],
    protegido: !!s?.protegido,
    // Los que quedaron de versiones anteriores: siguen valiendo para lo ya
    // cotizado, pero no se ofrecen al armar una cortina nueva.
    oculto: !!s?.oculto,
  };
}

/**
 * Tipos de cortina que ya no se cotizan. El nombre queda acá para que un
 * presupuesto o un pedido de entonces siga diciendo de qué era, y para sacar
 * de Ajustes los sistemas que quedaron colgados de ellos.
 */
const TIPOS_RETIRADOS = {
  placa: 'Placas',
  panel_oriental: 'Paneles orientales',
};

/** ¿Este sistema es de un tipo de cortina que ya no se cotiza? */
function deTipoRetirado(sistema) {
  return !!TIPOS_RETIRADOS[sistema?.tipo];
}

/**
 * Los sistemas entre los que se elige a mano al cotizar: los de ese tipo de
 * cortina que no estén ocultos. En los tipos que no eligen (verticales, zebra)
 * el sistema lo decide la tela, ver sistemaAuto.
 */
export function sistemasElegibles(tipo, config) {
  if (!eligeSistema(tipo)) return [];
  return sistemasDeConfig(config).filter((s) => s.tipo === tipo && !s.oculto);
}

/** La tela de un renglón con su color, tal como se muestra y se imprime. */
export function telaConColor(item) {
  return [item?.tela, item?.telaColor].filter(Boolean).join(' · ');
}

/** El sistema de un renglón con su color. */
export function sistemaConColor(calc) {
  return [calc?.sistemaNombre, calc?.sistemaColor].filter(Boolean).join(' · ');
}

/** Los colores en que viene un sistema. */
export function coloresDeSistema(id, config) {
  return sistemasDeConfig(config).find((s) => s.id === id)?.colores || [];
}

/**
 * Los sistemas que hay para elegir en Ajustes: los guardados más los que el
 * cálculo puede asignar solo y todavía no estén en la lista. Sin esto, un
 * sistema nuevo no aparecería nunca en un config que se guardó antes de que
 * existiera. Los de un tipo de cortina retirado no se listan: no hay dónde
 * usarlos, aunque sigan guardados con su costo por si hace falta mirar un
 * presupuesto de entonces.
 */
export function sistemasDeConfig(config) {
  const guardados = (config?.catalogoSistemas || [])
    .map(sistemaNormalizado)
    .filter((s) => !deTipoRetirado(s));
  const faltantes = Object.entries(SISTEMAS)
    .filter(([id]) => !guardados.some((s) => s.id === id))
    .map(([id, def]) => sistemaNormalizado({ id, ...def, protegido: true }));
  return [...guardados, ...faltantes];
}

/**
 * Cómo se llama cada tipo de renglón en pantalla y en los PDF. Sale de TIPOS
 * para que agregar un tipo de cortina alcance con tocar un solo lugar.
 */
export const NOMBRE_TIPO = {
  // Los retirados van primero: si alguna clave volviera a usarse, gana la de
  // ahora.
  ...TIPOS_RETIRADOS,
  ...Object.fromEntries(Object.entries(TIPOS).map(([clave, def]) => [clave, def.nombre])),
  adicional: 'Adicional',
};

/**
 * Nombre a mostrar de un sistema. Antes `SISTEMAS` era la única fuente; ahora
 * el catálogo vive en `config.catalogoSistemas` (editable desde Ajustes) y
 * `SISTEMAS` queda como default para configs viejas que todavía no lo tienen.
 */
export function nombreSistema(id, config) {
  const enCatalogo = (config?.catalogoSistemas || []).find((s) => s.id === id);
  return enCatalogo?.nombre || SISTEMAS[id]?.nombre || id;
}

/**
 * Telas disponibles para un tipo (roller, vertical, zebra). El catálogo real
 * vive en `config.catalogoTelas` (editable desde Ajustes); `TIPOS[tipo].telas`
 * queda como default para configs viejas que todavía no lo tienen.
 */
export function telasDeTipo(tipo, config) {
  const cat = config?.catalogoTelas?.[tipo];
  const lista = Array.isArray(cat) && cat.length ? cat : (TIPOS[tipo]?.telas || []);
  return lista.map(telaNormalizada).filter((t) => t.nombre);
}

/**
 * Una entrada del catálogo de telas. Puede estar guardada como el nombre
 * suelto (así era antes de que las telas tuvieran colores) o como objeto.
 */
export function telaNormalizada(entrada) {
  if (typeof entrada === 'string') return { nombre: entrada, colores: [] };
  return {
    nombre: String(entrada?.nombre || ''),
    colores: Array.isArray(entrada?.colores) ? [...entrada.colores] : [],
  };
}

/** Los colores en que viene una tela. */
export function coloresDeTela(tipo, nombre, config) {
  return telasDeTipo(tipo, config).find((t) => t.nombre === nombre)?.colores || [];
}

/**
 * Precio por m² de una tela. Casi siempre es un número y el color no lo
 * cambia. Cuando sí lo cambia (hoy, Sun Screen 5%), lo guardado es un objeto
 * con un precio por color y `*` como precio de los colores que no estén
 * listados.
 */
export function precioTela(tipo, tela, color, config) {
  const valor = config?.telas?.[tipo]?.[tela];
  if (valor && typeof valor === 'object') {
    const delColor = valor[color];
    return Number(delColor === undefined || delColor === '' ? valor['*'] : delColor) || 0;
  }
  return Number(valor) || 0;
}

/** El precio general de una tela: el que vale salvo que el color diga otra cosa. */
export function precioBaseTela(tipo, tela, config) {
  const valor = config?.telas?.[tipo]?.[tela];
  if (valor && typeof valor === 'object') return Number(valor['*']) || 0;
  return Number(valor) || 0;
}

/**
 * Cómo se arma cada cortina. No entra en el precio: son las decisiones que
 * necesita el taller y que viajan a la orden de trabajo.
 * Ojo con `sistemaCano`: es el diámetro del caño, otra cosa que el `sistemaKey`
 * de arriba, que es el que define el costo.
 */
export const ARMADO = {
  comando: { etiqueta: 'Lado del comando', prefijo: 'Comando', valores: ['Izquierda', 'Derecha', 'I/D'] },
  cadena: { etiqueta: 'Tipo de cadena', prefijo: 'Cadena', valores: ['Metálica', 'PVC'] },
  caida: { etiqueta: 'Tipo de caída', prefijo: 'Caída', valores: ['Adelante', 'Atrás'] },
  sistemaCano: { etiqueta: 'Sistema (caño)', prefijo: 'Sistema', valores: ['32', '38', '45'] },
  recogimientoVertical: {
    etiqueta: 'Tipo de recogimiento', prefijo: 'Recogimiento',
    valores: ['Derecho', 'Izquierdo', 'Central', 'Bilateral'],
  },
};

/**
 * Qué se elige en cada tipo. Las bandas verticales no llevan cadena, caída ni
 * caño: se recogen hacia un lado, así que van comando y recogimiento. La tela
 * tradicional tiene los suyos propios (paños, pliegue, recogimiento).
 */
export const ARMADO_POR_TIPO = {
  roller: ['comando', 'cadena', 'caida', 'sistemaCano'],
  zebra: ['comando', 'cadena', 'caida', 'sistemaCano'],
  vertical: ['comando', 'recogimientoVertical'],
  tela_tradicional: [],
};

// Config vacía: los precios reales NO viven en el código, se cargan desde
// Supabase o desde un respaldo importado. Ver README.
export function configVacia() {
  const cero = (telas) => Object.fromEntries(telas.map((t) => [t, 0]));
  return {
    // Catálogo de telas por tipo: la lista de nombres se puede agregar, editar
    // (renombrar) y borrar desde Ajustes. Arranca con las de siempre para que
    // no cambie nada hasta que lo toques.
    catalogoTelas: {
      roller: telasCortina(),
      vertical: telasCortina(),
      zebra: [...TIPOS.zebra.telas],
    },
    telas: {
      roller: cero(TELAS_CORTINA.map((t) => t.nombre)),
      vertical: cero(TELAS_CORTINA.map((t) => t.nombre)),
      zebra: cero(TIPOS.zebra.telas),
    },
    // Catálogo de sistemas: igual que las telas, editable desde Ajustes.
    // `protegido` son los que arma el cálculo automático (ver sistemaAuto);
    // se pueden renombrar o borrar igual, pero Ajustes avisa antes de borrarlos.
    catalogoSistemas: Object.entries(SISTEMAS).map(([id, def]) => sistemaNormalizado({ id, ...def, protegido: true })),
    sistemas: Object.fromEntries(Object.keys(SISTEMAS).map((id) => [id, 0])),
    telasSistemaBasico: [...TELAS_SISTEMA_BASICO],
    // Adicionales: catálogo de productos simples (nombre + precio por unidad)
    // que se carga enteramente desde Ajustes. El precio es de contado.
    // Ver calcularItemAdicional.
    adicionales: [],
    incrementos: {
      roller: { activo: true, valor: 0 },
      vertical: { activo: true, valor: 0 },
      zebra: { activo: true, valor: 0 },
      tela_tradicional: { activo: true, valor: 0 },
      adicional: { activo: true, valor: 0 },
    },
    // Lo que te sale el instalador. Se traslada al precio final de la cortina:
    // al cliente no se le cobra aparte, ya viene adentro. Ver costoInstaladorItem.
    instalador: { roller: 15000, vertical: 20000, recargoPct: 50 },
    // Cortina "solo tela": el cliente ya tiene el sistema y se le vende la tela
    // sola. Es un descuento fijo, igual para todos los modelos, que se resta
    // del precio de contado (el de lista sale de ahí). El importe real se
    // carga en Ajustes. Ver calcularItem.
    soloTelaDescuento: 0,
    // Lo que te sale el motor de una roller automatizada. Va a precio de costo,
    // sin incremento: se suma después de la ganancia, igual que la instalación.
    // El importe real se carga en Ajustes, no vive en el código.
    costoMotor: 0,
    // Precio de contado y el mensaje que se le manda al cliente. Ver mensaje.js.
    contado: { descuentoPct: 35, plazoDias: 5, plantilla: '' },
    // Punto de partida de la caja: lo que hay en el local y en el banco en el
    // momento del corte. De ahí para adelante suman solos los cobros y los
    // movimientos que cargues. Los importes reales no viven en el código: se
    // cargan desde Caja. Ver saldosCaja() en dinero.js.
    saldos: { desde: '', efectivo: 0, cuenta: 0 },
    // Numeración de los recibos de pago, para seguir la serie que ya venías
    // haciendo a mano. Ver recibo.js.
    recibos: { puntoVenta: '0001', proximo: 1 },
    // Proveedores y lo que le debés a cada uno. Se carga a mano en Caja y se
    // descuenta del capital proyectado. Ver dialogoProveedores en caja.js.
    proveedores: [],
    // Gastos fijos que se cargaban cuando Caja mostraba el objetivo del mes.
    // Ese tablero se sacó; los datos quedan guardados por si vuelve.
    gastosFijos: [],
    minimoM2: 1,
    redondeo: 100, // redondea el precio unitario final al múltiplo indicado (0 = sin redondeo)
    iva: { activo: false, valor: 21 },
    empresa: {
      nombre: 'Zona Roller',
      instagram: '@zonaroller.mza',
      telefono: '',
      direccion: '',
      email: '',
      cuit: '',
      validezDias: 15,
      formaPago: '50% de seña para iniciar el trabajo y el saldo contra entrega.',
    },
  };
}

export function itemVacio(tipo = 'roller') {
  if (tipo === 'adicional') {
    return {
      id: crypto.randomUUID(),
      ambiente: '',
      tipo,
      productoId: null,
      producto: '', // nombre copiado al elegir el producto: si lo borrás o renombrás después, el renglón viejo lo sigue mostrando igual
      cantidad: 1,
      detalle: '',
    };
  }
  if (tipo === 'tela_tradicional') {
    const t = TIPOS.tela_tradicional;
    return {
      id: crypto.randomUUID(),
      ambiente: '',
      tipo,
      tela: t.telas[0],
      color: t.colores[0],
      cantPaños: 1,
      recogimiento: t.recogimientos[0],
      pliegue: t.pliegues[0],
      anchoM: null,
      altoM: null,
      cantidad: 1,
      instalacion: true,
      soloTela: false,
      detalle: '',
    };
  }
  const primeraTela = telaNormalizada(TIPOS[tipo].telas[0]);
  return {
    id: crypto.randomUUID(),
    ambiente: '',
    tipo,
    tela: primeraTela.nombre,
    telaColor: primeraTela.colores[0] || '',
    anchoCm: null,
    altoCm: null,
    cantidad: 1,
    // Los tipos que eligen sistema a mano arrancan con uno puesto; en los
    // demás queda en null y lo decide la tela (ver sistemaAuto).
    sistemaKey: SISTEMA_POR_DEFECTO[tipo] || null,
    sistemaColor: '',
    instalacion: true,
    soloTela: false, // el cliente pone el sistema: se vende la tela sola, con descuento fijo
    ...(admiteMotor(tipo) ? { automatizada: false } : {}),
    // Armado: arranca vacío, se elige cortina por cortina. Al agregar otra
    // cortina el editor copia lo que hayas puesto en la anterior.
    ...Object.fromEntries((ARMADO_POR_TIPO[tipo] || []).map((k) => [k, ''])),
    detalle: '',
  };
}

/**
 * Cómo se arma esta cortina, en texto: lo que necesita el taller.
 * Sirve tanto para el resumen en pantalla como para la orden de trabajo.
 */
export function detallesTecnicos(item) {
  if (item.tipo === 'tela_tradicional') {
    const paños = Number(item.cantPaños) || 1;
    return [`${paños} paño${paños === 1 ? '' : 's'}`, item.pliegue, item.recogimiento].filter(Boolean);
  }
  // Que vaya primero: el taller arma distinto una roller motorizada.
  const motor = admiteMotor(item.tipo) && item.automatizada ? ['Automatizada (motor)'] : [];
  return motor.concat(
    (ARMADO_POR_TIPO[item.tipo] || [])
      .map((campo) => (item[campo] ? `${ARMADO[campo].prefijo} ${item[campo]}` : null))
      .filter(Boolean)
  );
}

/**
 * De qué es un presupuesto o pedido, mirando sus renglones. Se elige al
 * crearlo, pero un presupuesto de cortinas puede llevar adicionales
 * enganchados; manda lo principal, que es lo que decide qué editor se abre y
 * qué mensaje se manda.
 */
export function categoriaDoc(doc) {
  const cats = new Set((doc?.items || []).filter((it) => it?.tipo).map(categoriaItem));
  if (cats.has('cortina')) return 'cortina';
  if (cats.has('adicional')) return 'adicional';
  return 'cortina';
}

/** De qué categoría es un renglón suelto: cortina o adicional. */
export function categoriaItem(item) {
  return item?.tipo === 'adicional' ? 'adicional' : 'cortina';
}

/** Cómo se llama cada categoría en pantalla. La clave sale de categoriaDoc. */
export const CATEGORIA = {
  cortina: { tipoItem: 'roller', singular: 'cortina', plural: 'cortinas', conArticulo: 'las cortinas', titulo: 'Cortinas', agregar: '+ Agregar otra cortina' },
  adicional: { tipoItem: 'adicional', singular: 'adicional', plural: 'adicionales', conArticulo: 'los adicionales', titulo: 'Adicionales', agregar: '+ Agregar otro adicional' },
};

/** "1 cortina", "4 adicionales". */
export function contarItems(cantidad, categoria) {
  const cat = CATEGORIA[categoria] || CATEGORIA.cortina;
  const n = Number(cantidad) || 0;
  return `${n} ${n === 1 ? cat.singular : cat.plural}`;
}

/**
 * Con qué está hecho el renglón, para los rankings: la tela si es una cortina,
 * el producto si es un adicional. Sin esto, un adicional entra a los rankings
 * como "undefined": no tiene tela.
 */
export function materialItem(item) {
  if (categoriaItem(item) === 'cortina') return item?.tela || '';
  return item?.producto || NOMBRE_TIPO[item?.tipo] || '';
}

/**
 * Cuántas unidades hay de cada categoría, en texto: "5 cortinas · 2 adicionales".
 * Recibe un objeto { cortina, adicional } y saltea las que están en 0.
 */
export function frasearUnidades(unidades) {
  const partes = Object.keys(CATEGORIA)
    .filter((cat) => Number(unidades?.[cat]) > 0)
    .map((cat) => contarItems(unidades[cat], cat));
  return partes.length ? partes.join(' · ') : contarItems(0, 'cortina');
}

/** Cuántas unidades hay de cada categoría entre estos renglones: { cortina, adicional }. */
export function unidadesDeItems(items) {
  const unidades = {};
  (items || []).forEach((it) => {
    const cat = categoriaItem(it);
    unidades[cat] = (unidades[cat] || 0) + Math.max(1, Number(it.cantidad) || 1);
  });
  return unidades;
}

/**
 * Lo mismo sumando documentos enteros. Se cuentan los renglones uno por uno:
 * un presupuesto de cortinas puede traer adicionales, y cada cosa va a su
 * categoría. Sin esto, un pedido de adicionales figuraba como si fueran cortinas.
 */
export function unidadesDeDocs(docs) {
  const unidades = {};
  (docs || []).forEach((d) => {
    const propias = d?.items?.length
      ? unidadesDeItems(d.items)
      : { [categoriaDoc(d)]: Number(d?.cantidadCortinas) || 0 };
    Object.entries(propias).forEach(([cat, n]) => { unidades[cat] = (unidades[cat] || 0) + n; });
  });
  return unidades;
}

/** El catálogo de productos de una categoría, tal como se carga en Ajustes. */
export function catalogoDe(tipo, config) {
  if (tipo === 'adicional') return config?.adicionales || [];
  return [];
}

/**
 * Descripción de línea para tela tradicional: "Cortina Tela [TELA] [COLOR]
 * [ANCHO]x[ALTO]m [RECOGIMIENTO]". Devuelve null para los demás tipos,
 * que ya se describen con tipo + tela.
 *
 * El riel ya no se elige al cotizar, pero los renglones viejos lo tienen
 * guardado: si está, se sigue mostrando tal como salió en su momento.
 */
export function descripcionItem(item) {
  if (item.tipo === 'adicional') return item.producto || 'Adicional';
  if (item.tipo !== 'tela_tradicional') return null;
  const ancho = Number(item.anchoM) || 0;
  const alto = Number(item.altoM) || 0;
  return ['Cortina Tela', item.tela, item.color, `${ancho}x${alto}m`, item.riel, item.recogimiento]
    .filter(Boolean)
    .join(' ');
}

/** Ancho a partir del cual el instalador cobra el recargo. */
const ANCHO_RECARGO_M = 2.5;

/**
 * Nada por debajo del metro entra en la cuenta. No es sólo el mínimo de 1 m²:
 * cada lado se cobra como mínimo un metro. Una cortina de 3,00 × 0,20 m son
 * 3 m² (3 × 1), no 0,60 redondeado a 1.
 *
 * Ojo: es para cobrar. La medida real se sigue guardando y es la que sale
 * impresa en el presupuesto y en la orden de trabajo.
 */
const MINIMO_LADO_M = 1;

const ladoCobrado = (metros) => Math.max(MINIMO_LADO_M, Number(metros) || 0);

/**
 * Con qué tarifa de instalación se cobra cada tipo. Roller y zebra van con la
 * misma y verticales y tela tradicional comparten la más cara. Lo que no esté
 * acá usa la de roller.
 */
const TARIFA_INSTALADOR = {
  roller: 'roller',
  zebra: 'roller',
  vertical: 'vertical',
  tela_tradicional: 'vertical',
};

/** Solo las roller se automatizan. */
export function admiteMotor(tipo) {
  return tipo === 'roller';
}

/**
 * Lo que te sale el motor de esta cortina, o 0 si no lleva.
 * Se traslada tal cual al precio, sin incremento: es un costo que se recupera,
 * no algo sobre lo que se gana. Por eso se suma después de la ganancia, en el
 * mismo lugar que la instalación.
 */
export function costoMotorItem(item, config) {
  if (!admiteMotor(item?.tipo) || !item?.automatizada) return 0;
  return Number(config?.costoMotor) || 0;
}

/** Ancho de la cortina en metros, venga en metros o en centímetros. */
export function anchoEnMetros(item) {
  return item.tipo === 'tela_tradicional'
    ? Number(item.anchoM) || 0
    : (Number(item.anchoCm) || 0) / 100;
}

/**
 * Lo que te sale el instalador por una cortina. Se traslada tal cual al precio
 * final: al cliente no se le cobra la instalación aparte, ya está adentro del
 * número. Se suma después del incremento, así que no lleva ganancia encima.
 *
 * La tarifa base depende del tipo, y sube un 50% en los dos casos en que el
 * instalador cobra más: cuando el viaje es por una sola cortina, y cuando la
 * cortina pasa los 2,50 m de ancho (hace falta otra persona).
 */
export function costoInstaladorItem(item, config, { cortinasTotales = 1 } = {}) {
  if (!item.instalacion) return 0;
  const tarifas = config.instalador || {};
  const base = Number(tarifas[TARIFA_INSTALADOR[item.tipo] || 'roller']) || 0;
  const conRecargo = cortinasTotales <= 1 || anchoEnMetros(item) > ANCHO_RECARGO_M;
  return conRecargo ? base * (1 + (Number(tarifas.recargoPct) || 0) / 100) : base;
}

/**
 * Tipos cuyo sistema se elige según la tela: los que están en
 * `telasSistemaBasico` usan el económico y el resto el de "demás telas".
 * Zebra tiene un solo sistema, así que no se divide.
 */
export function usaSistemaBasico(tipo) {
  return tipo === 'roller' || tipo === 'vertical';
}

/** Sistema que corresponde automáticamente a un tipo + tela. */
export function sistemaAuto(tipo, tela, config) {
  if (!usaSistemaBasico(tipo)) return tipo;
  const basicas = config.telasSistemaBasico || [];
  const sufijo = basicas.includes(tela) ? 'basico' : 'demas';
  return `${tipo}_${sufijo}`;
}

/**
 * Lo que se descuenta a una cortina marcada "solo tela": un importe fijo que
 * se resta del contado, igual para todos los modelos. Sale de Ajustes.
 */
function descuentoSoloTela(item, config) {
  return item?.soloTela ? Number(config?.soloTelaDescuento) || 0 : 0;
}

function redondear(valor, multiplo) {
  if (!multiplo || multiplo <= 0) return valor;
  return Math.round(valor / multiplo) * multiplo;
}

/**
 * Cuánto hay que inflar la cuenta para llegar al precio de lista.
 *
 * Tela + sistema + incremento + instalador da lo que necesitás cobrar: ese es
 * el precio de CONTADO. El de lista tiene que ser más alto, de manera que al
 * hacerle el 35% de descuento aterrice justo ahí. Con 35% el factor es
 * 1 / 0,65 = 1,538…
 */
export function factorLista(config) {
  const pct = Number(config?.contado?.descuentoPct);
  const resto = 1 - (Number.isFinite(pct) ? pct : 35) / 100;
  return resto > 0 ? 1 / resto : 1;
}

/**
 * Calcula el desglose completo de una cortina. Nunca lanza: los faltantes valen 0.
 *
 * Si el renglón trae `precioFijado`/`costoFijado`/`costoInstaladorFijado` (por
 * ejemplo, algo importado del cotizador viejo), esos valores mandan: no se
 * recalculan ni se redondean. Así, cambiar los costos de hoy no reescribe lo
 * que se cobró o costó hace meses.
 */
export function calcularItem(item, config, contexto = {}) {
  if (item.tipo === 'adicional') return calcularItemAdicional(item, config);
  if (item.tipo === 'tela_tradicional') return calcularItemTelaTradicional(item, config, contexto);

  const anchoM = (Number(item.anchoCm) || 0) / 100;
  const altoM = (Number(item.altoCm) || 0) / 100;
  const cantidad = Math.max(1, Number(item.cantidad) || 1);

  // Lo que se cobra nunca baja del metro por lado, ni a lo ancho ni a lo alto.
  const anchoCobrado = ladoCobrado(anchoM);
  const altoCobrado = ladoCobrado(altoM);

  const m2Real = anchoM * altoM;
  const m2 = Math.max(Number(config.minimoM2) || 0, anchoCobrado * altoCobrado);
  const aplicaMinimo = m2 > m2Real + 1e-9;

  const precioTelaUnit = precioTela(item.tipo, item.tela, item.telaColor, config);
  const sistemaKey = item.sistemaKey || sistemaAuto(item.tipo, item.tela, config);
  const precioSistema = Number(config.sistemas?.[sistemaKey]) || 0;

  const costoTela = m2 * precioTelaUnit;
  const costoSistema = anchoCobrado * precioSistema;
  const base = costoTela + costoSistema;

  const reglaInc = config.incrementos?.[item.tipo] || { activo: false, valor: 0 };
  const incrementoPct = reglaInc.activo ? Number(reglaInc.valor) || 0 : 0;
  const montoIncremento = base * (incrementoPct / 100);
  const conIncremento = base + montoIncremento;

  const costoInstaladorUnit = item.costoInstaladorFijado != null && Number.isFinite(Number(item.costoInstaladorFijado))
    ? Number(item.costoInstaladorFijado)
    : costoInstaladorItem(item, config, contexto);

  // El motor va a precio de costo, sin ganancia, así que entra acá abajo y no
  // arriba con la tela y el sistema.
  const costoMotorUnit = costoMotorItem(item, config);

  // "Solo tela": la cuenta se hace completa y se le resta un fijo. No baja
  // de cero por más chica que sea la cortina.
  const soloTela = !!item.soloTela;
  const descSoloTela = descuentoSoloTela(item, config);

  // Lo que necesitás cobrar: eso es el contado. El precio de lista lo aguanta
  // con el descuento puesto encima.
  const contadoUnit = Math.max(0, conIncremento + costoInstaladorUnit + costoMotorUnit - descSoloTela);

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear(contadoUnit * factorLista(config), config.redondeo);

  // Si va sin sistema, el sistema no se compra: no es costo.
  const costoMateriales = soloTela ? costoTela : base;
  const costoPropio = item.costoFijado != null && Number.isFinite(Number(item.costoFijado))
    ? (Number(item.costoFijado) + costoInstaladorUnit + costoMotorUnit) * cantidad
    : (costoMateriales + costoInstaladorUnit + costoMotorUnit) * cantidad;

  return {
    fijado,
    m2Real,
    m2,
    aplicaMinimo,
    anchoM,
    altoM,
    cantidad,
    precioTela: precioTelaUnit,
    soloTela,
    descuentoSoloTela: descSoloTela,
    sistemaKey,
    sistemaNombre: nombreSistema(sistemaKey, config),
    sistemaColor: item.sistemaColor || '',
    telaColor: item.telaColor || '',
    precioSistema,
    costoTela,
    costoSistema,
    base,
    incrementoPct,
    montoIncremento,
    conIncremento,
    precioUnitario,
    total: precioUnitario * cantidad,
    costoInstalador: costoInstaladorUnit * cantidad,
    automatizada: !!costoMotorUnit,
    costoMotor: costoMotorUnit * cantidad,
    // Costo propio (sin incremento) para saber el margen real.
    costoPropio,
  };
}

/**
 * Adicional: precio de contado por unidad (cargado en Ajustes) × cantidad,
 * con el porcentaje de ganancia de Ajustes → Incrementos encima. Como en todo
 * lo demás, el precio de lista sale de inflar el contado con factorLista.
 */
function calcularItemAdicional(item, config) {
  const producto = (config.adicionales || []).find((p) => p.id === item.productoId);
  const cantidad = Math.max(1, Number(item.cantidad) || 1);

  const precioUnidad = Number(producto?.precio) || 0;
  const base = precioUnidad;

  const reglaInc = config.incrementos?.adicional || { activo: false, valor: 0 };
  const incrementoPct = reglaInc.activo ? Number(reglaInc.valor) || 0 : 0;
  const montoIncremento = base * (incrementoPct / 100);
  const conIncremento = base + montoIncremento;

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear(conIncremento * factorLista(config), config.redondeo);

  const costoPropio = item.costoFijado != null && Number.isFinite(Number(item.costoFijado))
    ? Number(item.costoFijado) * cantidad
    : base * cantidad;

  return {
    fijado,
    // Un adicional se vende por unidad: no tiene medidas ni superficie.
    m2Real: 0,
    m2: 0,
    aplicaMinimo: false,
    anchoM: 0,
    altoM: 0,
    cantidad,
    precioTela: precioUnidad,
    sistemaKey: null,
    sistemaNombre: item.producto || producto?.nombre || '',
    precioSistema: 0,
    costoTela: base,
    costoSistema: 0,
    base,
    incrementoPct,
    montoIncremento,
    conIncremento,
    precioUnitario,
    total: precioUnitario * cantidad,
    costoInstalador: 0,
    costoColocacion: 0,
    costoEnvio: 0,
    automatizada: false,
    costoMotor: 0,
    costoPropio,
  };
}

/**
 * Cortina Tela Tradicional: fórmula propia, sin tela/sistema de precios
 * configurables. Precio base = (40.478,56 × ancho) + (900,38 × alto)
 * + (7.944,82 × ancho × alto), en metros. Sobre eso sí se le puede aplicar
 * un incremento (ganancia), igual que a los demás tipos.
 */
function calcularItemTelaTradicional(item, config, contexto = {}) {
  const anchoM = Number(item.anchoM) || 0;
  const altoM = Number(item.altoM) || 0;
  const cantidad = Math.max(1, Number(item.cantidad) || 1);

  // Mismo criterio que en los demás tipos: por debajo del metro no se cotiza.
  const anchoCobrado = ladoCobrado(anchoM);
  const altoCobrado = ladoCobrado(altoM);

  const m2Real = anchoM * altoM;
  const base = 40478.56 * anchoCobrado + 900.38 * altoCobrado + 7944.82 * anchoCobrado * altoCobrado;

  const reglaInc = config.incrementos?.tela_tradicional || { activo: false, valor: 0 };
  const incrementoPct = reglaInc.activo ? Number(reglaInc.valor) || 0 : 0;
  const montoIncremento = base * (incrementoPct / 100);
  const conIncremento = base + montoIncremento;

  const costoInstaladorUnit = item.costoInstaladorFijado != null && Number.isFinite(Number(item.costoInstaladorFijado))
    ? Number(item.costoInstaladorFijado)
    : costoInstaladorItem(item, config, contexto);

  const soloTela = !!item.soloTela;
  const descSoloTela = descuentoSoloTela(item, config);
  const contadoUnit = Math.max(0, conIncremento + costoInstaladorUnit - descSoloTela);

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear(contadoUnit * factorLista(config), config.redondeo);

  const costoPropio = item.costoFijado != null && Number.isFinite(Number(item.costoFijado))
    ? (Number(item.costoFijado) + costoInstaladorUnit) * cantidad
    : costoInstaladorUnit * cantidad;

  return {
    fijado,
    m2Real,
    m2: anchoCobrado * altoCobrado,
    aplicaMinimo: anchoCobrado * altoCobrado > m2Real + 1e-9,
    anchoM,
    altoM,
    cantidad,
    precioTela: 0,
    soloTela,
    descuentoSoloTela: descSoloTela,
    sistemaKey: null,
    sistemaNombre: item.riel || '',
    precioSistema: 0,
    costoTela: 0,
    costoSistema: 0,
    base,
    incrementoPct,
    montoIncremento,
    conIncremento,
    precioUnitario,
    total: precioUnitario * cantidad,
    costoInstalador: costoInstaladorUnit * cantidad,
    // La tela tradicional no se automatiza: van para que el desglose tenga
    // siempre la misma forma, venga del tipo que venga.
    automatizada: false,
    costoMotor: 0,
    costoPropio,
  };
}

/** Totales de un presupuesto o pedido completo. */
export function calcularTotales(items, config, opciones = {}) {
  const descuentoPct = Number(opciones.descuentoPct) || 0;
  const lista = items || [];
  // El recargo del instalador depende del trabajo entero: si el viaje es por
  // una sola cortina cobra más, así que cada renglón necesita saber el total.
  // Se cuentan sólo las cortinas: un adicional enganchado al mismo presupuesto
  // no le ahorra el viaje a nadie.
  const unidades = unidadesDeItems(lista);
  const cortinasTotales = unidades.cortina || 0;
  const lineas = lista.map((it) => ({ item: it, calc: calcularItem(it, config, { cortinasTotales }) }));

  const subtotal = lineas.reduce((a, l) => a + l.calc.total, 0);
  const montoDescuento = subtotal * (descuentoPct / 100);
  const neto = subtotal - montoDescuento;

  const ivaActivo = !!config.iva?.activo;
  const ivaPct = ivaActivo ? Number(config.iva.valor) || 0 : 0;
  const montoIva = neto * (ivaPct / 100);
  const total = neto + montoIva;

  const costoInstalacion = lineas.reduce((a, l) => a + l.calc.costoInstalador, 0);
  const costoPropio = lineas.reduce((a, l) => a + l.calc.costoPropio, 0);
  const cantidadCortinas = lineas.reduce((a, l) => a + l.calc.cantidad, 0);

  return {
    lineas,
    cantidadCortinas,
    // Lo mismo abierto por categoría, para decir "3 cortinas · 1 adicional".
    unidades,
    subtotal,
    descuentoPct,
    montoDescuento,
    neto,
    ivaPct,
    montoIva,
    total,
    costoInstalacion,
    costoPropio,
    ganancia: neto - costoPropio,
  };
}

export function hayPreciosCargados(config) {
  const telas = Object.values(config.telas || {})
    .flatMap((g) => Object.values(g || {}))
    .flatMap((v) => (v && typeof v === 'object' ? Object.values(v) : [v]));
  const sistemas = Object.values(config.sistemas || {});
  return [...telas, ...sistemas].some((v) => Number(v) > 0);
}
