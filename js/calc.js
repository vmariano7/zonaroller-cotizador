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
};

export const SISTEMAS = {
  roller_basico: 'Roller · Blackout / Sunscreen 5%',
  roller_demas: 'Roller · Demás telas',
  vertical_basico: 'Vertical · Blackout / Sunscreen 5%',
  vertical_demas: 'Vertical · Demás telas',
  zebra: 'Sistema Zebra',
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
    instalacion: 0, // lo que le cobrás al cliente por cortina
    costoInstalador: 0, // lo que le pagás al instalador por cortina
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
    detalle: '',
  };
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
 * Si el renglón trae `precioFijado` (por ejemplo, algo importado del cotizador
 * viejo), ese precio manda: no lo recalculamos ni lo redondeamos. Así, cambiar
 * los costos de hoy no reescribe lo que se cobró hace meses.
 */
export function calcularItem(item, config) {
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

  const instalacionUnit = item.instalacion ? Number(config.instalacion) || 0 : 0;

  const fijado = item.precioFijado != null && Number.isFinite(Number(item.precioFijado));
  const precioUnitario = fijado
    ? Number(item.precioFijado)
    : redondear(conIncremento + instalacionUnit, config.redondeo);

  const costoInstaladorUnit = item.instalacion ? Number(config.costoInstalador) || 0 : 0;
  const costoPropio = item.costoFijado != null && Number.isFinite(Number(item.costoFijado))
    ? Number(item.costoFijado) * cantidad
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
    instalacionUnit,
    precioUnitario,
    total: precioUnitario * cantidad,
    costoInstalador: costoInstaladorUnit * cantidad,
    // Costo propio (sin incremento) para saber el margen real.
    costoPropio,
  };
}

/** Totales de un presupuesto o pedido completo. */
export function calcularTotales(items, config, opciones = {}) {
  const descuentoPct = Number(opciones.descuentoPct) || 0;
  const lineas = (items || []).map((it) => ({ item: it, calc: calcularItem(it, config) }));

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
