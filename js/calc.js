// Motor de cálculo de cortinas.
// Fórmula: ((m² × precio tela) + (ancho en metros × precio sistema)) × (1 + incremento)
//          + lo que te sale el instalador. Eso da el precio de CONTADO; el de
//          lista sale de inflarlo para que aguante el descuento (ver factorLista).
//          Todo multiplicado por la cantidad.
// Tela tradicional usa su propia fórmula fija en vez de tela + sistema, pero
// pasa por el mismo incremento e igual conversión a contado/lista.
// Ningún lado se cobra por debajo del metro: ver MINIMO_LADO_M.

// Las telas de siempre: roller, verticales y paneles orientales se hacen con
// las mismas. Son sólo el punto de partida — la lista se edita en Ajustes.
const TELAS_COMUNES = ['Blackout', 'Sunscreen 5%', 'Sunscreen 1%', 'South Beach', 'Shangtung', 'Córdoba', 'Blackout decorativo'];

export const TIPOS = {
  roller: {
    nombre: 'Roller',
    telas: [...TELAS_COMUNES],
  },
  vertical: {
    nombre: 'Bandas verticales',
    telas: [...TELAS_COMUNES],
  },
  panel_oriental: {
    nombre: 'Paneles orientales',
    telas: [...TELAS_COMUNES],
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

export const SISTEMAS = {
  roller_basico: 'Roller · Blackout / Sunscreen 5%',
  roller_demas: 'Roller · Demás telas',
  vertical_basico: 'Vertical · Blackout / Sunscreen 5%',
  vertical_demas: 'Vertical · Demás telas',
  zebra: 'Sistema Zebra',
  panel_oriental: 'Sistema Paneles Orientales',
};

/**
 * Los sistemas que hay para elegir en Ajustes: los guardados más los que el
 * cálculo puede asignar solo y todavía no estén en la lista. Sin esto, un
 * sistema nuevo (como el de paneles orientales) no aparecería nunca en un
 * config que se guardó antes de que existiera.
 */
export function sistemasDeConfig(config) {
  const guardados = config?.catalogoSistemas || [];
  const faltantes = Object.entries(SISTEMAS)
    .filter(([id]) => !guardados.some((s) => s.id === id))
    .map(([id, nombre]) => ({ id, nombre, protegido: true }));
  return [...guardados, ...faltantes];
}

/**
 * Cómo se llama cada tipo de renglón en pantalla y en los PDF. Sale de TIPOS
 * para que agregar un tipo de cortina alcance con tocar un solo lugar.
 */
export const NOMBRE_TIPO = {
  ...Object.fromEntries(Object.entries(TIPOS).map(([clave, def]) => [clave, def.nombre])),
  placa: 'Placa',
  adicional: 'Adicional',
};

/**
 * Nombre a mostrar de un sistema. Antes `SISTEMAS` era la única fuente; ahora
 * el catálogo vive en `config.catalogoSistemas` (editable desde Ajustes) y
 * `SISTEMAS` queda como default para configs viejas que todavía no lo tienen.
 */
export function nombreSistema(id, config) {
  const enCatalogo = (config?.catalogoSistemas || []).find((s) => s.id === id);
  return enCatalogo?.nombre || SISTEMAS[id] || id;
}

/**
 * Telas disponibles para un tipo (roller, vertical, zebra). El catálogo real
 * vive en `config.catalogoTelas` (editable desde Ajustes); `TIPOS[tipo].telas`
 * queda como default para configs viejas que todavía no lo tienen.
 */
export function telasDeTipo(tipo, config) {
  const cat = config?.catalogoTelas?.[tipo];
  return Array.isArray(cat) && cat.length ? cat : (TIPOS[tipo]?.telas || []);
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
 * caño: se recogen hacia un lado, así que van comando y recogimiento. Los
 * paneles orientales corren de la misma manera, sobre riel, así que llevan lo
 * mismo. La tela tradicional tiene los suyos propios (paños, pliegue,
 * recogimiento).
 */
export const ARMADO_POR_TIPO = {
  roller: ['comando', 'cadena', 'caida', 'sistemaCano'],
  zebra: ['comando', 'cadena', 'caida', 'sistemaCano'],
  vertical: ['comando', 'recogimientoVertical'],
  panel_oriental: ['comando', 'recogimientoVertical'],
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
      roller: [...TIPOS.roller.telas],
      vertical: [...TIPOS.vertical.telas],
      panel_oriental: [...TIPOS.panel_oriental.telas],
      zebra: [...TIPOS.zebra.telas],
    },
    telas: {
      roller: cero(TIPOS.roller.telas),
      vertical: cero(TIPOS.vertical.telas),
      panel_oriental: cero(TIPOS.panel_oriental.telas),
      zebra: cero(TIPOS.zebra.telas),
    },
    // Catálogo de sistemas: igual que las telas, editable desde Ajustes.
    // `protegido` son los que arma el cálculo automático (ver sistemaAuto);
    // se pueden renombrar o borrar igual, pero Ajustes avisa antes de borrarlos.
    catalogoSistemas: Object.entries(SISTEMAS).map(([id, nombre]) => ({ id, nombre, protegido: true })),
    sistemas: { roller_basico: 0, roller_demas: 0, vertical_basico: 0, vertical_demas: 0, zebra: 0, panel_oriental: 0 },
    // Telas que usan el sistema "básico" (más económico) en roller y vertical.
    telasSistemaBasico: ['Blackout', 'Sunscreen 5%'],
    // Placas y adicionales: catálogos de productos simples (nombre + precio)
    // que se cargan enteramente desde Ajustes. El precio es de contado: la
    // placa va por m² y el adicional por unidad. Ver calcularItemPlaca y
    // calcularItemAdicional.
    placas: [],
    adicionales: [],
    // Colocación y envío de placas: van al costo de contado igual que el
    // precio del producto (ver calcularItemPlaca), así que al pasarlo a lista
    // se les aplica el mismo descuento que a todo lo demás.
    placaColocacionM2: 0,
    placaEnvioFijo: 0,
    incrementos: {
      roller: { activo: true, valor: 0 },
      vertical: { activo: true, valor: 0 },
      panel_oriental: { activo: true, valor: 0 },
      zebra: { activo: true, valor: 0 },
      tela_tradicional: { activo: true, valor: 0 },
      placa: { activo: true, valor: 0 },
      adicional: { activo: true, valor: 0 },
    },
    // Lo que te sale el instalador. Se traslada al precio final de la cortina:
    // al cliente no se le cobra aparte, ya viene adentro. Ver costoInstaladorItem.
    instalador: { roller: 15000, vertical: 20000, panel_oriental: 0, recargoPct: 50 },
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
  if (tipo === 'placa' || tipo === 'adicional') {
    return {
      id: crypto.randomUUID(),
      ambiente: '',
      tipo,
      productoId: null,
      producto: '', // nombre copiado al elegir el producto: si lo borrás o renombrás después, el renglón viejo lo sigue mostrando igual
      cantidad: 1,
      detalle: '',
      // La placa se cotiza por superficie y puede llevar colocación y envío;
      // el adicional se cobra por unidad y no lleva nada de eso.
      ...(tipo === 'placa' ? { m2: null, colocacion: false, envio: false } : {}),
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
      detalle: '',
    };
  }
  return {
    id: crypto.randomUUID(),
    ambiente: '',
    tipo,
    tela: TIPOS[tipo].telas[0],
    anchoCm: null,
    altoCm: null,
    cantidad: 1,
    sistemaKey: null, // null = automático según tipo y tela
    instalacion: true,
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
  if (item.tipo === 'placa') {
    return [item.colocacion ? 'Con colocación' : null, item.envio ? 'Con envío' : null].filter(Boolean);
  }
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
 * Un presupuesto o pedido es de una sola categoría: se elige al crearlo.
 * Devuelve con qué está armado, mirando sus renglones.
 */
export function categoriaDoc(doc) {
  const tipo = (doc?.items || []).find((it) => it?.tipo)?.tipo;
  return tipo === 'placa' || tipo === 'adicional' ? tipo : 'cortina';
}

/** Cómo se llama cada categoría en pantalla. La clave sale de categoriaDoc. */
export const CATEGORIA = {
  cortina: { tipoItem: 'roller', singular: 'cortina', plural: 'cortinas', conArticulo: 'las cortinas', titulo: 'Cortinas', agregar: '+ Agregar otra cortina' },
  placa: { tipoItem: 'placa', singular: 'placa', plural: 'placas', conArticulo: 'las placas', titulo: 'Placas', agregar: '+ Agregar otra placa' },
  adicional: { tipoItem: 'adicional', singular: 'adicional', plural: 'adicionales', conArticulo: 'los adicionales', titulo: 'Adicionales', agregar: '+ Agregar otro adicional' },
};

/** "1 cortina", "3 placas", "4 adicionales". */
export function contarItems(cantidad, categoria) {
  const cat = CATEGORIA[categoria] || CATEGORIA.cortina;
  const n = Number(cantidad) || 0;
  return `${n} ${n === 1 ? cat.singular : cat.plural}`;
}

/** El catálogo de productos de una categoría, tal como se carga en Ajustes. */
export function catalogoDe(tipo, config) {
  if (tipo === 'placa') return config?.placas || [];
  if (tipo === 'adicional') return config?.adicionales || [];
  return [];
}

/**
 * Superficie de una placa, en m². Se carga en un solo casillero.
 * Los renglones viejos guardaban ancho y alto por separado: si vienen así,
 * se multiplican, para que un presupuesto de antes siga dando lo mismo.
 */
export function superficiePlaca(item) {
  if (item?.m2 != null && item.m2 !== '') return Number(item.m2) || 0;
  return (Number(item?.anchoM) || 0) * (Number(item?.altoM) || 0);
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
  if (item.tipo === 'placa') {
    // Con coma, como se escribe acá: este texto sale impreso en el presupuesto.
    const m2 = String(superficiePlaca(item)).replace('.', ',');
    return [item.producto || 'Placa', `${m2} m²`].filter(Boolean).join(' ');
  }
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
 * misma; verticales y tela tradicional comparten la más cara; los paneles
 * orientales tienen la suya. Lo que no esté acá usa la de roller.
 */
const TARIFA_INSTALADOR = {
  roller: 'roller',
  zebra: 'roller',
  vertical: 'vertical',
  tela_tradicional: 'vertical',
  panel_oriental: 'panel_oriental',
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
 * Zebra y paneles orientales tienen un solo sistema, así que no se dividen.
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
  if (item.tipo === 'placa') return calcularItemPlaca(item, config);
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

  const precioTela = Number(config.telas?.[item.tipo]?.[item.tela]) || 0;
  const sistemaKey = item.sistemaKey || sistemaAuto(item.tipo, item.tela, config);
  const precioSistema = Number(config.sistemas?.[sistemaKey]) || 0;

  const costoTela = m2 * precioTela;
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

  // Lo que necesitás cobrar: eso es el contado. El precio de lista lo aguanta
  // con el descuento puesto encima.
  const contadoUnit = conIncremento + costoInstaladorUnit + costoMotorUnit;

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear(contadoUnit * factorLista(config), config.redondeo);

  const costoPropio = item.costoFijado != null && Number.isFinite(Number(item.costoFijado))
    ? (Number(item.costoFijado) + costoInstaladorUnit + costoMotorUnit) * cantidad
    : (base + costoInstaladorUnit + costoMotorUnit) * cantidad;

  return {
    fijado,
    m2Real,
    m2,
    aplicaMinimo,
    anchoM,
    altoM,
    cantidad,
    precioTela,
    sistemaKey,
    sistemaNombre: nombreSistema(sistemaKey, config),
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
 * Placa: precio de contado por m² (cargado en Ajustes) × superficie, más
 * colocación (por m², opcional) y envío (fijo, opcional) — los tres a precio
 * de contado. El de lista sale de aplicarle el mismo factor que a las
 * cortinas (ver factorLista): colocación y envío también se inflan, a
 * diferencia de la instalación de una cortina, porque acá los tres montos ya
 * vienen dados como costo de contado.
 */
function calcularItemPlaca(item, config) {
  const producto = (config.placas || []).find((p) => p.id === item.productoId);
  const cantidad = Math.max(1, Number(item.cantidad) || 1);
  const area = superficiePlaca(item);

  const precioM2 = Number(producto?.precio) || 0;
  const base = area * precioM2;

  // La ganancia se calcula sobre la placa, igual que en las cortinas se
  // calcula sobre tela y sistema: colocación y envío se suman después.
  const reglaInc = config.incrementos?.placa || { activo: false, valor: 0 };
  const incrementoPct = reglaInc.activo ? Number(reglaInc.valor) || 0 : 0;
  const montoIncremento = base * (incrementoPct / 100);
  const conIncremento = base + montoIncremento;

  const costoColocacionUnit = item.colocacion ? area * (Number(config.placaColocacionM2) || 0) : 0;
  const costoEnvioUnit = item.envio ? Number(config.placaEnvioFijo) || 0 : 0;
  const contadoUnit = conIncremento + costoColocacionUnit + costoEnvioUnit;

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear(contadoUnit * factorLista(config), config.redondeo);

  const costoPropio = item.costoFijado != null && Number.isFinite(Number(item.costoFijado))
    ? (Number(item.costoFijado) + costoColocacionUnit + costoEnvioUnit) * cantidad
    : (base + costoColocacionUnit + costoEnvioUnit) * cantidad;

  return {
    fijado,
    m2Real: area,
    m2: area,
    aplicaMinimo: false,
    // Una placa se cotiza por superficie, no por ancho × alto: los dejamos en
    // cero para que se note si alguna pantalla los muestra sin querer.
    anchoM: 0,
    altoM: 0,
    cantidad,
    precioTela: precioM2,
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
    // Colocación reusa el mismo casillero que la instalación de una cortina:
    // así Pedidos y Caja la siguen viendo como "lo que hay que pagarle a
    // alguien" sin que haga falta tocar esas pantallas.
    costoInstalador: costoColocacionUnit * cantidad,
    costoColocacion: costoColocacionUnit * cantidad,
    costoEnvio: costoEnvioUnit * cantidad,
    automatizada: false,
    costoMotor: 0,
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

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear((conIncremento + costoInstaladorUnit) * factorLista(config), config.redondeo);

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
  const cortinasTotales = lista.reduce((a, it) => a + Math.max(1, Number(it.cantidad) || 1), 0);
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
  const telas = Object.values(config.telas || {}).flatMap((g) => Object.values(g || {}));
  const sistemas = Object.values(config.sistemas || {});
  return [...telas, ...sistemas].some((v) => Number(v) > 0);
}
