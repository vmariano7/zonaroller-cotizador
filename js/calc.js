// Motor de cálculo de cortinas.
// Fórmula: ((m² × precio tela) + (ancho en metros × precio sistema)) × (1 + incremento)
//          + lo que te sale el instalador. Eso da el precio de CONTADO; el de
//          lista sale de inflarlo para que aguante el descuento (ver factorLista).
//          Todo multiplicado por la cantidad.
// Ningún lado se cobra por debajo del metro: ver MINIMO_LADO_M.

export const TIPOS = {
  roller: {
    nombre: 'Roller',
    telas: ['Blackout', 'Sunscreen 5%', 'Sunscreen 1%', 'South Beach', 'Shangtung', 'Córdoba', 'Blackout decorativo'],
  },
  vertical: {
    nombre: 'Bandas verticales',
    telas: ['Blackout', 'Sunscreen 5%', 'Sunscreen 1%', 'South Beach', 'Shangtung', 'Córdoba', 'Blackout decorativo'],
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
    rieles: ['RIEL ALUM PREMIUM TT03', 'RIEL ALUM TT04', 'RIEL PVC PREMIUM TTM1', 'RIEL PVC TTM2'],
  },
};

export const SISTEMAS = {
  roller_basico: 'Roller · Blackout / Sunscreen 5%',
  roller_demas: 'Roller · Demás telas',
  vertical_basico: 'Vertical · Blackout / Sunscreen 5%',
  vertical_demas: 'Vertical · Demás telas',
  zebra: 'Sistema Zebra',
};

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
 * caño: se recogen hacia un lado, así que van comando y recogimiento.
 * La tela tradicional tiene los suyos propios (paños, pliegue, riel…).
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
    telas: {
      roller: cero(TIPOS.roller.telas),
      vertical: cero(TIPOS.vertical.telas),
      zebra: cero(TIPOS.zebra.telas),
    },
    sistemas: { roller_basico: 0, roller_demas: 0, vertical_basico: 0, vertical_demas: 0, zebra: 0 },
    // Telas que usan el sistema "básico" (más económico) en roller y vertical.
    telasSistemaBasico: ['Blackout', 'Sunscreen 5%'],
    incrementos: {
      roller: { activo: true, valor: 0 },
      vertical: { activo: true, valor: 0 },
      zebra: { activo: true, valor: 0 },
    },
    // Lo que te sale el instalador. Se traslada al precio final de la cortina:
    // al cliente no se le cobra aparte, ya viene adentro. Ver costoInstaladorItem.
    instalador: { roller: 15000, vertical: 20000, recargoPct: 50 },
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
    // Lo que pagás todos los meses pase lo que pase: [{ id, concepto, monto }].
    // No son movimientos, no tocan la caja; arman el objetivo del mes. Ver Caja.
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
      riel: t.rieles[0],
      rielColor: 'BLANCO',
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
  return (ARMADO_POR_TIPO[item.tipo] || [])
    .map((campo) => (item[campo] ? `${ARMADO[campo].prefijo} ${item[campo]}` : null))
    .filter(Boolean);
}

/**
 * Descripción de línea para tela tradicional: "Cortina Tela [TELA] [COLOR]
 * [ANCHO]x[ALTO]m [RIEL] [RECOGIMIENTO]". Devuelve null para los demás tipos,
 * que ya se describen con tipo + tela.
 */
export function descripcionItem(item) {
  if (item.tipo !== 'tela_tradicional') return null;
  const ancho = Number(item.anchoM) || 0;
  const alto = Number(item.altoM) || 0;
  return `Cortina Tela ${item.tela} ${item.color} ${ancho}x${alto}m ${item.riel} ${item.recogimiento}`;
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

/** Tipos que llevan la tarifa de instalación más cara. */
const INSTALACION_CARA = ['vertical', 'tela_tradicional'];

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
  const base = INSTALACION_CARA.includes(item.tipo)
    ? Number(tarifas.vertical) || 0
    : Number(tarifas.roller) || 0;
  const conRecargo = cortinasTotales <= 1 || anchoEnMetros(item) > ANCHO_RECARGO_M;
  return conRecargo ? base * (1 + (Number(tarifas.recargoPct) || 0) / 100) : base;
}

/** Sistema que corresponde automáticamente a un tipo + tela. */
export function sistemaAuto(tipo, tela, config) {
  if (tipo === 'zebra') return 'zebra';
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

  // Lo que necesitás cobrar: eso es el contado. El precio de lista lo aguanta
  // con el descuento puesto encima.
  const contadoUnit = conIncremento + costoInstaladorUnit;

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear(contadoUnit * factorLista(config), config.redondeo);

  const costoPropio = item.costoFijado != null && Number.isFinite(Number(item.costoFijado))
    ? (Number(item.costoFijado) + costoInstaladorUnit) * cantidad
    : (base + costoInstaladorUnit) * cantidad;

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
    sistemaNombre: SISTEMAS[sistemaKey] || sistemaKey,
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
    // Costo propio (sin incremento) para saber el margen real.
    costoPropio,
  };
}

/**
 * Cortina Tela Tradicional: fórmula propia, sin tela/sistema de precios
 * configurables. Precio = (40.478,56 × ancho) + (900,38 × alto)
 * + (7.944,82 × ancho × alto), en metros.
 */
function calcularItemTelaTradicional(item, config, contexto = {}) {
  const anchoM = Number(item.anchoM) || 0;
  const altoM = Number(item.altoM) || 0;
  const cantidad = Math.max(1, Number(item.cantidad) || 1);

  // Mismo criterio que en los demás tipos: por debajo del metro no se cotiza.
  const anchoCobrado = ladoCobrado(anchoM);
  const altoCobrado = ladoCobrado(altoM);

  const m2Real = anchoM * altoM;
  const formula = 40478.56 * anchoCobrado + 900.38 * altoCobrado + 7944.82 * anchoCobrado * altoCobrado;

  const costoInstaladorUnit = item.costoInstaladorFijado != null && Number.isFinite(Number(item.costoInstaladorFijado))
    ? Number(item.costoInstaladorFijado)
    : costoInstaladorItem(item, config, contexto);

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear((formula + costoInstaladorUnit) * factorLista(config), config.redondeo);

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
    base: formula,
    incrementoPct: 0,
    montoIncremento: 0,
    conIncremento: formula,
    precioUnitario,
    total: precioUnitario * cantidad,
    costoInstalador: costoInstaladorUnit * cantidad,
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
