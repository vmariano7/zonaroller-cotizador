// Motor de cálculo de cortinas.
// Fórmula: ((m² × precio tela) + (ancho en metros × precio sistema)) × (1 + incremento)
//          + instalación fija por cortina, todo multiplicado por la cantidad.

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
    // Lo que te sale el instalador. Al cliente la instalación va sin cargo,
    // así que esto es puro costo y no toca el precio. Ver costoInstaladorItem.
    instalador: { roller: 15000, vertical: 20000, recargoPct: 50 },
    // Precio de contado y el mensaje que se le manda al cliente. Ver mensaje.js.
    contado: { descuentoPct: 35, plazoDias: 5, plantilla: '' },
    minimoM2: 1,
    redondeo: 100, // redondea el precio unitario final al múltiplo indicado (0 = sin redondeo)
    iva: { activo: false, valor: 21 },
    empresa: {
      nombre: 'Zona Roller',
      instagram: '@zonaroller.mza',
      telefono: '',
      direccion: '',
      email: '',
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

/** Tipos que llevan la tarifa de instalación más cara. */
const INSTALACION_CARA = ['vertical', 'tela_tradicional'];

/** Ancho de la cortina en metros, venga en metros o en centímetros. */
export function anchoEnMetros(item) {
  return item.tipo === 'tela_tradicional'
    ? Number(item.anchoM) || 0
    : (Number(item.anchoCm) || 0) / 100;
}

/**
 * Lo que te sale el instalador por una cortina. Es un costo tuyo: al cliente
 * la instalación va sin cargo, así que no entra en el precio.
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

  const m2Real = anchoM * altoM;
  const m2 = Math.max(Number(config.minimoM2) || 0, m2Real);
  const aplicaMinimo = m2 > m2Real + 1e-9;

  const precioTela = Number(config.telas?.[item.tipo]?.[item.tela]) || 0;
  const sistemaKey = item.sistemaKey || sistemaAuto(item.tipo, item.tela, config);
  const precioSistema = Number(config.sistemas?.[sistemaKey]) || 0;

  const costoTela = m2 * precioTela;
  const costoSistema = anchoM * precioSistema;
  const base = costoTela + costoSistema;

  const reglaInc = config.incrementos?.[item.tipo] || { activo: false, valor: 0 };
  const incrementoPct = reglaInc.activo ? Number(reglaInc.valor) || 0 : 0;
  const montoIncremento = base * (incrementoPct / 100);
  const conIncremento = base + montoIncremento;

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear(conIncremento, config.redondeo);

  const costoInstaladorUnit = item.costoInstaladorFijado != null && Number.isFinite(Number(item.costoInstaladorFijado))
    ? Number(item.costoInstaladorFijado)
    : costoInstaladorItem(item, config, contexto);
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

  const m2Real = anchoM * altoM;
  const formula = 40478.56 * anchoM + 900.38 * altoM + 7944.82 * anchoM * altoM;

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear(formula, config.redondeo);

  const costoInstaladorUnit = item.costoInstaladorFijado != null && Number.isFinite(Number(item.costoInstaladorFijado))
    ? Number(item.costoInstaladorFijado)
    : costoInstaladorItem(item, config, contexto);
  const costoPropio = item.costoFijado != null && Number.isFinite(Number(item.costoFijado))
    ? (Number(item.costoFijado) + costoInstaladorUnit) * cantidad
    : costoInstaladorUnit * cantidad;

  return {
    fijado,
    m2Real,
    m2: m2Real,
    aplicaMinimo: false,
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
