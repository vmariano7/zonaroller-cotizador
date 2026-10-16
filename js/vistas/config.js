// Configuración: costos, incrementos, reglas de cálculo, datos de la empresa,
// sincronización con la nube y respaldos.

import { estado, guardarConfig, cerrarSesion, sincronizar, exportarRespaldo, importarRespaldo } from '../store.js';
import { TIPOS, CATEGORIA, sistemasDeConfig, usaSistemaBasico, telasDeTipo, precioBaseTela, eligeSistema } from '../calc.js';
import { esc, aviso, confirmar, descargarArchivo, fecha, plata, modal } from '../ui.js';
import { plantillaDe, CLAVES } from '../mensaje.js';
import { tienePin, definirPin } from '../candado.js';

/**
 * Qué artículos llevan porcentaje de ganancia. Los cuatro tipos de cortina
 * salen de TIPOS; los adicionales tienen su propio catálogo, así que van
 * a mano. La clave es la misma que usa `config.incrementos`.
 */
const ARTICULOS_INCREMENTO = [
  ...Object.entries(TIPOS).map(([tipo, def]) => [tipo, def.nombre]),
  ['adicional', 'Adicionales'],
];

let temporizador;
function guardarPronto(parcial) {
  clearTimeout(temporizador);
  Object.assign(estado.config, parcial);
  temporizador = setTimeout(() => guardarConfig(estado.config), 600);
}

export function render(contenedor) {
  const c = estado.config;

  // Lo que todavía no tiene costo cargado. Hasta que lo tenga cotiza en $0, y
  // el aviso va arriba de todo porque es acá donde se carga. Los sistemas
  // ocultos no cuentan: son de versiones anteriores y no se ofrecen al cotizar.
  const tiposConTela = Object.keys(TIPOS).filter((t) => t !== 'tela_tradicional');
  const telasSinCosto = tiposConTela
    .flatMap((tipo) => telasDeTipo(tipo, c).filter((t) => !(precioBaseTela(tipo, t.nombre, c) > 0)));
  const sistemasSinCosto = sistemasDeConfig(c).filter((sis) => !sis.oculto && !(Number(c.sistemas?.[sis.id]) > 0));
  const cuantos = (n, singular, plural) => (n === 1 ? `1 ${singular}` : `${n} ${plural}`);
  const faltan = [
    telasSinCosto.length ? cuantos(telasSinCosto.length, 'tela', 'telas') : '',
    sistemasSinCosto.length ? cuantos(sistemasSinCosto.length, 'sistema', 'sistemas') : '',
  ].filter(Boolean).join(' y ');

  contenedor.innerHTML = `
    <div class="titulo-pagina">
      <div><h1>Configuración</h1><div class="sub">Los cambios se guardan solos</div></div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">01</span>
        <div><h2>Costos de telas</h2><div class="mini">Valor por metro cuadrado para cada tipo de cortina.</div></div>
      </div>
      <div class="grid grid--3">
        ${Object.entries(TIPOS).filter(([tipo]) => tipo !== 'tela_tradicional').map(([tipo, def]) => `
          <div>
            <h3 style="padding-bottom:.4rem;border-bottom:2px solid var(--linea-fuerte);margin-bottom:.6rem;display:flex;align-items:center;gap:.5rem">
              <span style="flex:1">${esc(def.nombre)}</span>
              <button class="btn btn--chico btn--fantasma" data-gestionar-telas="${tipo}" style="font-size:.7rem;padding:.3rem .6rem">Agregar / borrar</button>
            </h3>
            ${telasDeTipo(tipo, c).map(({ nombre, colores }) => {
              const guardado = c.telas?.[tipo]?.[nombre];
              const porColor = guardado && typeof guardado === 'object' ? guardado : null;
              const distintos = porColor ? Object.keys(porColor).filter((k) => k !== '*').length : 0;
              return `
              <div class="campo" style="display:flex;align-items:center;gap:.6rem">
                <label style="flex:1;margin:0;font-weight:500;color:var(--acento)">${esc(nombre)}</label>
                <div class="con-prefijo" style="width:130px"><span>$</span>
                  <input type="number" inputmode="decimal" min="0" step="1" data-tela="${tipo}|${esc(nombre)}" value="${precioBaseTela(tipo, nombre, c)}">
                </div>
              </div>
              ${colores.length ? `
              <details class="avanzadas" style="margin:-.2rem 0 .7rem">
                <summary class="mini">Colores y precios ${distintos ? `· ${distintos} con precio propio` : `· ${colores.length}, todos al mismo precio`}</summary>
                <div class="mini" style="margin:.5rem 0">Dejá vacío el color que valga lo mismo que arriba.</div>
                ${colores.map((color) => `
                  <div class="campo" style="display:flex;align-items:center;gap:.6rem">
                    <label style="flex:1;margin:0">${esc(color)}</label>
                    <div class="con-prefijo" style="width:130px"><span>$</span>
                      <input type="number" inputmode="decimal" min="0" step="1" placeholder="${precioBaseTela(tipo, nombre, c)}"
                             data-tela-color="${tipo}|${esc(nombre)}|${esc(color)}" value="${porColor?.[color] ?? ''}">
                    </div>
                  </div>`).join('')}
              </details>` : ''}`;
            }).join('')}
          </div>`).join('')}
      </div>
      ${faltan ? `
      <div class="banner banner--aviso" style="margin-top:1rem">
        <div><strong>Faltan costos:</strong> ${faltan} sin precio cargado. Mientras tanto, lo que
        las use cotiza en $0. Cargalos acá abajo uno por uno, o traelos todos juntos con
        <label class="btn btn--chico" style="margin:0 .2rem;vertical-align:baseline">Importar lista de precios<input type="file" accept="application/json,.json" data-importar-precios hidden></label>
        (el archivo <strong>lista-precios.json</strong> de la carpeta privada).</div>
      </div>` : ''}
      <div class="banner banner--info" style="margin-top:1rem">
        <div><strong>Cortina Tela Tradicional</strong> no usa estos costos: su precio base sale de una fórmula fija propia (ancho, alto y ancho×alto), configurada directamente en el código. El porcentaje de ganancia sobre esa fórmula sí se configura, en Incrementos.</div>
      </div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">02</span>
        <div><h2>Adicionales</h2><div class="mini">Precio de contado por unidad de cada producto.</div></div>
        <div class="der"><button class="btn btn--chico" data-gestionar-productos="adicionales">Agregar / editar / borrar</button></div>
      </div>
      ${(c.adicionales || []).length ? `
        <div class="lista">
          ${(c.adicionales || []).map((p) => `
            <div class="campo" style="display:flex;align-items:center;gap:.6rem">
              <span style="flex:1;font-weight:500">${esc(p.nombre)}</span>
              <strong>${plata(p.precio)}</strong>
            </div>`).join('')}
        </div>
      ` : '<div class="mini">Todavía no cargaste ningún adicional.</div>'}
    </div>

    <div class="grid grid--2">
      <div class="tarjeta">
        <div class="tarjeta__cab">
          <span class="seccion-num">03</span>
          <div><h2>Costos de sistemas</h2><div class="mini">Valor por metro lineal (se calcula sobre el ancho).</div></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:.4rem">
          <button class="btn btn--chico btn--fantasma" data-gestionar-sistemas style="font-size:.7rem;padding:.3rem .6rem">Agregar / renombrar / borrar</button>
        </div>
        ${sistemasDeConfig(c).map(({ id: clave, nombre }) => `
          <div class="campo" style="display:flex;align-items:center;gap:.6rem">
            <label style="flex:1;margin:0;font-weight:500">${esc(nombre)}</label>
            <div class="con-prefijo" style="width:140px"><span>$</span>
              <input type="number" inputmode="decimal" min="0" step="1" data-sistema="${clave}" value="${c.sistemas?.[clave] ?? 0}">
            </div>
          </div>`).join('')}

        <div style="border-top:2px solid var(--linea-fuerte);margin:1rem 0 .8rem"></div>

        <h3 style="margin-bottom:.5rem">Costo del instalador <span class="mini" style="font-weight:400">(lo que pagás por cortina)</span></h3>
        <div class="campo" style="display:flex;align-items:center;gap:.6rem">
          <label style="flex:1;margin:0;font-weight:500;color:var(--acento)">Roller y Zebra</label>
          <div class="con-prefijo" style="width:140px"><span>$</span>
            <input type="number" inputmode="decimal" min="0" step="1" data-inst="roller" value="${c.instalador?.roller ?? 15000}">
          </div>
        </div>
        <div class="campo" style="display:flex;align-items:center;gap:.6rem">
          <label style="flex:1;margin:0;font-weight:500;color:var(--acento)">Bandas verticales y Tela tradicional</label>
          <div class="con-prefijo" style="width:140px"><span>$</span>
            <input type="number" inputmode="decimal" min="0" step="1" data-inst="vertical" value="${c.instalador?.vertical ?? 20000}">
          </div>
        </div>
        <div class="campo" style="display:flex;align-items:center;gap:.6rem">
          <label style="flex:1;margin:0;font-weight:500">Recargo</label>
          <div class="con-sufijo" style="width:140px">
            <input type="number" inputmode="decimal" min="0" step="1" data-inst="recargoPct" value="${c.instalador?.recargoPct ?? 50}"><span>%</span>
          </div>
        </div>
        <div class="banner banner--info" style="margin-top:.8rem">
          <div>El recargo se aplica cuando el trabajo es de <strong>una sola cortina</strong>
          o cuando la cortina mide <strong>más de 2,50 m de ancho</strong>. Este costo se
          traslada al precio final de cada cortina, así que al cliente la instalación no se
          le cobra aparte: ya viene adentro.</div>
        </div>

        <div style="border-top:2px solid var(--linea-fuerte);margin:1rem 0 .8rem"></div>

        <h3 style="margin-bottom:.5rem">Cortinas automáticas <span class="mini" style="font-weight:400">(solo roller)</span></h3>
        <div class="campo" style="display:flex;align-items:center;gap:.6rem">
          <label style="flex:1;margin:0;font-weight:500;color:var(--acento)">Costo del motor</label>
          <div class="con-prefijo" style="width:140px"><span>$</span>
            <input type="number" inputmode="decimal" min="0" step="1" data-num="costoMotor" value="${c.costoMotor ?? 0}">
          </div>
        </div>
        <div class="banner banner--info" style="margin-top:.8rem">
          <div>Lo que te sale el motor. Se suma al precio <strong>tal cual, sin ganancia</strong>,
          igual que la instalación: en una venta de contado lo recuperás exacto. Se activa
          cortina por cortina, con el tilde <em>Automatizada</em> en Opciones avanzadas.</div>
        </div>

        <div style="border-top:2px solid var(--linea-fuerte);margin:1rem 0 .8rem"></div>

        <h3 style="margin-bottom:.5rem">Solo tela <span class="mini" style="font-weight:400">(cortina sin sistema)</span></h3>
        <div class="campo" style="display:flex;align-items:center;gap:.6rem">
          <label style="flex:1;margin:0;font-weight:500;color:var(--acento)">Descuento por cortina</label>
          <div class="con-prefijo" style="width:140px"><span>$</span>
            <input type="number" inputmode="decimal" min="0" step="1" data-num="soloTelaDescuento" value="${c.soloTelaDescuento ?? 0}">
          </div>
        </div>
        <div class="banner banner--info" style="margin-top:.8rem">
          <div>Para cuando el cliente ya tiene el sistema y se le vende la tela sola. Es un
          importe <strong>fijo, igual para todos los modelos</strong>: se resta del precio de
          contado y el de lista sale de ahí. Se activa cortina por cortina, con el tilde
          <em>Solo tela</em> en Opciones avanzadas, y el presupuesto lo aclara.</div>
        </div>
      </div>

      <div>
        <div class="tarjeta">
          <div class="tarjeta__cab">
            <span class="seccion-num">04</span>
            <div><h2>Incrementos</h2><div class="mini">Activá y definí el porcentaje por artículo.</div></div>
          </div>
          ${ARTICULOS_INCREMENTO.map(([tipo, nombre]) => {
            const inc = c.incrementos?.[tipo] || { activo: true, valor: 0 };
            return `
            <div class="campo" style="display:flex;align-items:center;gap:.6rem">
              <label class="switch" style="margin:0">
                <input type="checkbox" data-inc-activo="${tipo}"${inc.activo ? ' checked' : ''}>
                <span class="switch__pista"></span>
              </label>
              <span style="flex:1;font-weight:600">${esc(nombre)}</span>
              <div class="con-sufijo" style="width:100px">
                <input type="number" inputmode="decimal" min="0" step="1" data-inc-valor="${tipo}" value="${inc.valor ?? 0}"><span>%</span>
              </div>
            </div>`;
          }).join('')}
          <div class="banner banner--info" style="margin:1rem 0 0">
            <div>En Roller, Verticales y Zebra el incremento se calcula sobre
            tela y sistema. En Tela Tradicional, sobre la fórmula fija del renglón de arriba, y en
            Adicionales sobre el precio de cada unidad. La instalación se suma después, sin
            incremento.</div>
          </div>
        </div>

        <div class="tarjeta">
          <div class="tarjeta__cab">
            <span class="seccion-num">05</span>
            <div><h2>Reglas de cálculo</h2></div>
          </div>
          <div class="campos campos--2">
            <div>
              <label>Mínimo de metros cuadrados</label>
              <div class="con-sufijo"><input type="number" inputmode="decimal" min="0" step="0.1" data-num="minimoM2" value="${c.minimoM2 ?? 1}"><span>m²</span></div>
            </div>
            <div>
              <label>Redondeo del precio de lista</label>
              <select data-redondeo>
                ${[0, 100, 500, 1000].map((v) => `<option value="${v}"${Number(c.redondeo) === v ? ' selected' : ''}>${v === 0 ? 'Sin redondeo' : `Al múltiplo de ${v}`}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="banner banner--info" style="margin:1rem 0 0">
            <div>Además del mínimo de m², <strong>ningún lado se cobra por debajo de 1 m</strong>:
            una cortina de 3,00 × 0,20 m se cotiza como 3,00 × 1,00 = 3 m². La medida real se
            guarda igual y es la que sale impresa.</div>
          </div>
          <div class="campo mt-16" style="display:flex;align-items:center;gap:.6rem">
            <label class="switch" style="margin:0">
              <input type="checkbox" data-iva-activo${c.iva?.activo ? ' checked' : ''}>
              <span class="switch__pista"></span>
            </label>
            <span style="flex:1;font-weight:600">Agregar IVA al total</span>
            <div class="con-sufijo" style="width:100px">
              <input type="number" inputmode="decimal" min="0" step="1" data-iva-valor value="${c.iva?.valor ?? 21}"><span>%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">06</span>
        <div><h2>Datos de Zona Roller</h2><div class="mini">Aparecen en el encabezado del PDF.</div></div>
      </div>
      <div class="campos campos--3">
        <div><label>Nombre</label><input data-emp="nombre" value="${esc(c.empresa?.nombre || '')}"></div>
        <div><label>Teléfono</label><input data-emp="telefono" type="tel" value="${esc(c.empresa?.telefono || '')}"></div>
        <div><label>Instagram</label><input data-emp="instagram" value="${esc(c.empresa?.instagram || '')}"></div>
        <div><label>Email</label><input data-emp="email" type="email" value="${esc(c.empresa?.email || '')}"></div>
        <div><label>Dirección</label><input data-emp="direccion" value="${esc(c.empresa?.direccion || '')}"></div>
        <div><label>CUIT <span class="mini">(sale en los recibos)</span></label><input data-emp="cuit" value="${esc(c.empresa?.cuit || '')}"></div>
        <div><label>Validez del presupuesto</label><div class="con-sufijo"><input type="number" min="1" step="1" data-emp-num="validezDias" value="${c.empresa?.validezDias ?? 15}"><span>días</span></div></div>
        <div>
          <label>Recibos: punto de venta y próximo número</label>
          <div style="display:flex;gap:.5rem">
            <input data-rec="puntoVenta" style="width:90px" value="${esc(c.recibos?.puntoVenta || '0001')}">
            <input type="number" min="1" step="1" data-rec-num="proximo" value="${c.recibos?.proximo ?? 1}">
          </div>
        </div>
      </div>
      <div class="campo mt-16"><label>Forma de pago (sale en el PDF)</label><textarea data-emp="formaPago">${esc(c.empresa?.formaPago || '')}</textarea></div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">07</span>
        <div><h2>Precio de contado y mensaje</h2><div class="mini">Lo que sale por defecto en cada cotización. En cada presupuesto lo podés cambiar.</div></div>
      </div>
      <div class="campos campos--2">
        <div>
          <label>Descuento de contado</label>
          <div class="con-sufijo"><input type="number" inputmode="decimal" min="0" max="100" step="1" data-ctd="descuentoPct" value="${c.contado?.descuentoPct ?? 35}"><span>%</span></div>
        </div>
        <div>
          <label>Plazo de producción</label>
          <div class="con-sufijo"><input type="number" inputmode="numeric" min="0" step="1" data-ctd="plazoDias" value="${c.contado?.plazoDias ?? 5}"><span>días</span></div>
        </div>
      </div>
      <div class="banner banner--info" style="margin-top:.8rem">
        <div>Este descuento es el que arma el precio de lista: la cuenta de costos da el precio
        <strong>de contado</strong>, y el de lista se calcula para que al descontarle este
        porcentaje quede justo ahí. Si lo cambiás, <strong>se mueven todos los precios nuevos</strong>.</div>
      </div>
      <div class="mini mt-16" style="font-weight:600">Texto del mensaje</div>
      <div class="mini" style="margin:.2rem 0 .6rem">Uno por categoría: el que se manda depende de qué tenga el presupuesto.
      Lo que va entre llaves se reemplaza solo: ${CLAVES.map(([k, q]) => `<code>${esc(k)}</code> ${esc(q)}`).join(' · ')}</div>
      ${Object.entries(CATEGORIA).map(([clave, def]) => `
        <details class="avanzadas" style="margin-bottom:.5rem">
          <summary>${esc(def.titulo)} <span class="mini">${c.contado?.plantillas?.[clave]?.trim() ? '· editado' : '· texto por defecto'}</span></summary>
          <div class="campo mt-16">
            <textarea data-ctd-plantilla="${clave}" rows="9" style="min-height:180px">${esc(plantillaDe(clave, c))}</textarea>
          </div>
          <div class="fila-botones">
            <button class="btn btn--fantasma btn--chico" data-ctd-restaurar="${clave}">Volver al texto original</button>
          </div>
        </details>`).join('')}
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">08</span>
        <div><h2>Tu cuenta</h2><div class="mini">Con la misma cuenta ves los mismos datos en la compu y en el celular.</div></div>
      </div>
      <div class="banner banner--${estado.sync.estado === 'error' ? 'error' : estado.sync.activa ? 'info' : 'aviso'}">
        <div>
          <strong>${estado.sync.activa ? (estado.sync.estado === 'error' ? 'Con problemas' : 'Nube conectada') : 'Sin sesión'}</strong><br>
          ${esc(estado.sync.mensaje)}${estado.sync.ultima ? ` · última: ${fecha(estado.sync.ultima, { conHora: true })}` : ''}
        </div>
      </div>
      ${estado.sesion.activa ? `<div class="campo"><label>Sesión iniciada</label><input value="${esc(estado.sesion.email)}" readonly></div>` : ''}
      <div class="fila-botones mt-16">
        <button class="btn" data-sb-sinc>Sincronizar ahora</button>
        ${estado.sesion.activa ? '<button class="btn btn--fantasma" data-sb-salir>Cerrar sesión</button>' : ''}
      </div>
      <div class="mini mt-16">No hay claves que cargar: la app entra sola con tu cuenta y se sincroniza en
      cualquier aparato donde inicies sesión. Cerrá sesión solo si prestás el dispositivo.</div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">09</span>
        <div><h2>PIN de acceso</h2><div class="mini">${tienePin() ? 'Activado: la app lo pide cada vez que se abre.' : 'Desactivado: la app abre directo.'}</div></div>
      </div>
      <div class="campos campos--2">
        <div><label>${tienePin() ? 'PIN nuevo' : 'Elegí un PIN'}</label><input data-pin type="password" inputmode="numeric" maxlength="12" placeholder="Ej. 4821"></div>
        <div><label>Repetilo</label><input data-pin2 type="password" inputmode="numeric" maxlength="12" placeholder="Ej. 4821"></div>
      </div>
      <div class="fila-botones mt-16">
        <button class="btn btn--primario" data-pin-guardar>${tienePin() ? 'Cambiar PIN' : 'Activar PIN'}</button>
        ${tienePin() ? '<button class="btn btn--fantasma" data-pin-quitar>Quitar el PIN</button>' : ''}
      </div>
      <div class="banner banner--aviso mt-16">
        <div>Es un candado extra, para que alguien que agarre el celular desbloqueado no vea
        la facturación de un vistazo. Lo que protege tus datos de verdad es tu cuenta:
        sin iniciar sesión la app no lee ni escribe nada en la nube.</div>
      </div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">10</span>
        <div><h2>Respaldo</h2><div class="mini">Bajá una copia de todo o restaurá desde un archivo.</div></div>
      </div>
      <div class="fila-botones">
        <button class="btn" data-exportar>Descargar respaldo</button>
        <label class="btn" style="margin:0">Importar archivo<input type="file" accept="application/json,.json" data-importar hidden></label>
        <label class="btn" style="margin:0">Importar lista de precios<input type="file" accept="application/json,.json" data-importar-precios hidden></label>
      </div>
      <div class="mini mt-16"><strong>Importar lista de precios</strong> sólo toca telas y sistemas: los
      carga y actualiza sin tocar nada más de la configuración, y sin borrar los que ya tenías.</div>
      <div class="mini mt-16">${estado.presupuestos.length} presupuestos · ${estado.pedidos.length} pedidos · ${estado.agenda.length} eventos · ${estado.movimientos.length} movimientos</div>
    </div>
  `;

  // Todos los casilleros de acá abajo son <input type="number">, y esos siempre
  // entregan el valor con punto decimal y sin separador de miles. leerNumero,
  // que está pensado para texto en formato argentino, leería "1.5" como 15.
  const leerCasillero = (inp) => Number(inp.value) || 0;

  /* ---- Precios de telas ---- */
  // El precio de una tela es un número suelto, salvo cuando algún color vale
  // distinto: ahí se guarda un objeto con un precio por color y `*` como
  // precio general. Ver precioTela en calc.js.
  const guardarPrecioTela = (tipo, tela, armar) => {
    const telas = { ...estado.config.telas };
    telas[tipo] = { ...telas[tipo], [tela]: armar(telas[tipo]?.[tela]) };
    guardarPronto({ telas });
  };

  contenedor.querySelectorAll('[data-tela]').forEach((inp) =>
    inp.addEventListener('input', () => {
      const [tipo, tela] = inp.dataset.tela.split('|');
      guardarPrecioTela(tipo, tela, (actual) => (actual && typeof actual === 'object'
        ? { ...actual, '*': leerCasillero(inp) }
        : leerCasillero(inp)));
    })
  );

  contenedor.querySelectorAll('[data-tela-color]').forEach((inp) =>
    inp.addEventListener('input', () => {
      const [tipo, tela, color] = inp.dataset.telaColor.split('|');
      guardarPrecioTela(tipo, tela, (actual) => {
        const mapa = actual && typeof actual === 'object' ? { ...actual } : { '*': Number(actual) || 0 };
        if (inp.value === '') delete mapa[color];
        else mapa[color] = leerCasillero(inp);
        // Si ningún color quedó con precio propio, vuelve a ser un número.
        return Object.keys(mapa).some((k) => k !== '*') ? mapa : (mapa['*'] || 0);
      });
    })
  );

  /* ---- Sistemas ---- */
  contenedor.querySelectorAll('[data-sistema]').forEach((inp) =>
    inp.addEventListener('input', () => {
      guardarPronto({ sistemas: { ...estado.config.sistemas, [inp.dataset.sistema]: leerCasillero(inp) } });
    })
  );

  /* ---- Catálogos: agregar / renombrar / borrar telas, sistemas y productos ---- */
  contenedor.querySelectorAll('[data-gestionar-telas]').forEach((b) =>
    b.addEventListener('click', () => dialogoTelas(b.dataset.gestionarTelas, () => render(contenedor)))
  );
  contenedor.querySelector('[data-gestionar-sistemas]')?.addEventListener('click', () =>
    dialogoSistemas(() => render(contenedor))
  );
  contenedor.querySelectorAll('[data-gestionar-productos]').forEach((b) =>
    b.addEventListener('click', () => dialogoProductos(b.dataset.gestionarProductos, () => render(contenedor)))
  );

  /* ---- Números sueltos ---- */
  contenedor.querySelectorAll('[data-num]').forEach((inp) =>
    inp.addEventListener('input', () => guardarPronto({ [inp.dataset.num]: leerCasillero(inp) }))
  );

  /* ---- Costo del instalador ---- */
  contenedor.querySelectorAll('[data-inst]').forEach((inp) =>
    inp.addEventListener('input', () =>
      guardarPronto({ instalador: { ...estado.config.instalador, [inp.dataset.inst]: leerCasillero(inp) } })
    )
  );

  contenedor.querySelector('[data-redondeo]').addEventListener('change', (e) =>
    guardarPronto({ redondeo: Number(e.target.value) })
  );

  /* ---- Incrementos ---- */
  // Si el tipo todavía no tiene entrada guardada (por ejemplo, recién se
  // sumó "tela_tradicional" a un config viejo), arranca con el mismo default
  // que se usa para pintar el checkbox, así el primer guardado queda completo.
  const incDefault = (tipo) => estado.config.incrementos?.[tipo] || { activo: true, valor: 0 };
  contenedor.querySelectorAll('[data-inc-activo]').forEach((inp) =>
    inp.addEventListener('change', () => {
      const tipo = inp.dataset.incActivo;
      const incrementos = { ...estado.config.incrementos };
      incrementos[tipo] = { ...incDefault(tipo), activo: inp.checked };
      guardarPronto({ incrementos });
    })
  );
  contenedor.querySelectorAll('[data-inc-valor]').forEach((inp) =>
    inp.addEventListener('input', () => {
      const tipo = inp.dataset.incValor;
      const incrementos = { ...estado.config.incrementos };
      incrementos[tipo] = { ...incDefault(tipo), valor: leerCasillero(inp) };
      guardarPronto({ incrementos });
    })
  );

  /* ---- IVA ---- */
  contenedor.querySelector('[data-iva-activo]').addEventListener('change', (e) =>
    guardarPronto({ iva: { ...estado.config.iva, activo: e.target.checked } })
  );
  contenedor.querySelector('[data-iva-valor]').addEventListener('input', (e) =>
    guardarPronto({ iva: { ...estado.config.iva, valor: leerCasillero(e.target) } })
  );

  /* ---- Empresa ---- */
  contenedor.querySelectorAll('[data-emp]').forEach((inp) =>
    inp.addEventListener('input', () =>
      guardarPronto({ empresa: { ...estado.config.empresa, [inp.dataset.emp]: inp.value } })
    )
  );
  /* ---- Numeración de recibos ---- */
  contenedor.querySelectorAll('[data-rec]').forEach((inp) =>
    inp.addEventListener('input', () =>
      guardarPronto({ recibos: { ...estado.config.recibos, [inp.dataset.rec]: inp.value.trim() } })
    )
  );
  contenedor.querySelectorAll('[data-rec-num]').forEach((inp) =>
    inp.addEventListener('input', () =>
      guardarPronto({ recibos: { ...estado.config.recibos, [inp.dataset.recNum]: leerCasillero(inp) } })
    )
  );

  contenedor.querySelectorAll('[data-emp-num]').forEach((inp) =>
    inp.addEventListener('input', () =>
      guardarPronto({ empresa: { ...estado.config.empresa, [inp.dataset.empNum]: leerCasillero(inp) } })
    )
  );

  /* ---- Contado y mensaje ---- */
  contenedor.querySelectorAll('[data-ctd]').forEach((inp) =>
    inp.addEventListener('input', () =>
      guardarPronto({ contado: { ...estado.config.contado, [inp.dataset.ctd]: leerCasillero(inp) } })
    )
  );
  // Un texto por categoría. El de cortinas se sigue guardando también en
  // `contado.plantilla` (donde vivía cuando había uno solo) para que una
  // versión vieja de la app siga mostrando algo con sentido.
  const guardarPlantilla = (clave, texto) => {
    const contado = { ...estado.config.contado };
    contado.plantillas = { ...contado.plantillas, [clave]: texto };
    if (clave === 'cortina') contado.plantilla = texto;
    guardarPronto({ contado });
  };

  contenedor.querySelectorAll('[data-ctd-plantilla]').forEach((ta) =>
    ta.addEventListener('input', () => guardarPlantilla(ta.dataset.ctdPlantilla, ta.value))
  );

  contenedor.querySelectorAll('[data-ctd-restaurar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!(await confirmar('¿Volver al texto original? Perdés los cambios que le hayas hecho.', { textoOk: 'Volver al original' }))) return;
      const clave = b.dataset.ctdRestaurar;
      guardarPlantilla(clave, '');
      aviso('Texto restaurado.');
      render(contenedor);
    })
  );

  /* ---- Sincronización ---- */
  contenedor.querySelector('[data-sb-sinc]').addEventListener('click', async () => {
    await sincronizar();
    aviso(estado.sync.estado === 'ok' ? 'Sincronizado.' : estado.sync.mensaje, estado.sync.estado === 'ok' ? 'ok' : 'error');
    render(contenedor);
  });

  contenedor.querySelector('[data-sb-salir]')?.addEventListener('click', async () => {
    if (!(await confirmar(
      '¿Cerrar sesión en este dispositivo? Vas a tener que entrar de nuevo con tu email y contraseña. Los datos quedan guardados en la nube.',
      { textoOk: 'Cerrar sesión' }
    ))) return;
    cerrarSesion();
    location.reload();
  });

  /* ---- PIN ---- */
  contenedor.querySelector('[data-pin-guardar]').addEventListener('click', async () => {
    const pin = contenedor.querySelector('[data-pin]').value.trim();
    const pin2 = contenedor.querySelector('[data-pin2]').value.trim();
    if (pin.length < 4) return aviso('Usá al menos 4 caracteres.', 'error');
    if (pin !== pin2) return aviso('Los dos PIN no coinciden.', 'error');
    await definirPin(pin);
    aviso('PIN activado. Te lo va a pedir la próxima vez que abras la app.');
    render(contenedor);
  });

  contenedor.querySelector('[data-pin-quitar]')?.addEventListener('click', async () => {
    if (!(await confirmar('¿Quitar el PIN? La app va a abrir directo en todos tus dispositivos.', { textoOk: 'Quitar' }))) return;
    await definirPin('');
    aviso('PIN desactivado.');
    render(contenedor);
  });

  /* ---- Respaldo ---- */
  contenedor.querySelector('[data-exportar]').addEventListener('click', () => {
    const nombre = `zona-roller-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    descargarArchivo(nombre, JSON.stringify(exportarRespaldo(), null, 2));
    aviso('Respaldo descargado.');
  });

  // Hay dos botones iguales: el del aviso de "faltan costos" y el de Respaldo.
  contenedor.querySelectorAll('[data-importar-precios]').forEach((inp) =>
    inp.addEventListener('change', async (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      try {
        const datos = JSON.parse(await archivo.text());
        const cuenta = await importarListaDePrecios(datos);
        // Si la nube rechazó el guardado, la lista quedó sólo en este aparato:
        // mejor decirlo acá que dejar que se pierda en el próximo arranque.
        const enLaNube = estado.sync.estado !== 'error';
        aviso(
          `Lista cargada: ${cuenta.telas} telas y ${cuenta.sistemas} sistemas.${enLaNube ? '' : ' Ojo: todavía no subió a la nube.'}`,
          enLaNube ? 'ok' : 'error'
        );
        render(contenedor);
      } catch (err) {
        aviso(`No pude leer el archivo. ${err.message}`, 'error');
      }
      e.target.value = '';
    })
  );

  contenedor.querySelector('[data-importar]').addEventListener('change', async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    try {
      const datos = JSON.parse(await archivo.text());
      const reemplazar = await confirmar(
        'Elegí cómo importar: "Reemplazar" borra lo que hay ahora y deja solo el archivo. Cancelá para fusionar (suma lo del archivo a lo que ya tenés).',
        { textoOk: 'Reemplazar todo', peligro: true }
      );
      await importarRespaldo(datos, { reemplazar });
      aviso('Datos importados.');
      render(contenedor);
    } catch (err) {
      aviso(`No pude leer el archivo: ${err.message}`, 'error');
    } finally {
      e.target.value = '';
    }
  });
}

/**
 * Carga una lista de precios: telas y sistemas con sus colores y sus valores,
 * y de paso qué telas usan el sistema básico. Se mezcla con lo que ya está
 * cargado —lo que no viene en el archivo queda como está, así los presupuestos
 * viejos siguen encontrando sus telas y sus sistemas— y no toca ninguna otra
 * parte de la configuración.
 */
async function importarListaDePrecios(datos) {
  const c = estado.config;
  const cambios = {};
  const cuenta = { telas: 0, sistemas: 0 };

  if (datos.catalogoTelas) {
    cambios.catalogoTelas = { ...c.catalogoTelas, ...datos.catalogoTelas };
  }
  if (datos.telas) {
    const telas = { ...c.telas };
    Object.entries(datos.telas).forEach(([tipo, mapa]) => {
      telas[tipo] = { ...telas[tipo], ...mapa };
      cuenta.telas += Object.keys(mapa).length;
    });
    cambios.telas = telas;
  }
  if (Array.isArray(datos.catalogoSistemas)) {
    const porId = new Map((c.catalogoSistemas || []).map((s) => [s.id, s]));
    datos.catalogoSistemas.forEach((s) => porId.set(s.id, { ...porId.get(s.id), ...s }));
    cambios.catalogoSistemas = [...porId.values()];
  }
  if (datos.sistemas) {
    cambios.sistemas = { ...c.sistemas, ...datos.sistemas };
    cuenta.sistemas = Object.keys(datos.sistemas).length;
  }
  // Las telas del sistema básico se suman a las que ya estaban tildadas: las de
  // antes se dejan en paz para que un renglón viejo siga saliendo con el mismo
  // sistema con el que se cotizó.
  if (Array.isArray(datos.telasSistemaBasico)) {
    cambios.telasSistemaBasico = [...new Set([...(c.telasSistemaBasico || []), ...datos.telasSistemaBasico])];
  }
  if (!Object.keys(cambios).length) throw new Error('El archivo no trae telas ni sistemas.');

  await guardarConfig(cambios);
  return cuenta;
}

/**
 * Agregar, renombrar o borrar telas de un tipo (roller, vertical o zebra).
 * Roller y vertical llevan además el tilde de "sistema básico": las telas
 * tildadas usan el sistema económico (ver `telasSistemaBasico` en calc.js);
 * las demás usan el sistema "demás telas". Zebra tiene un solo sistema, así
 * que ahí no hace falta elegir.
 */
function dialogoTelas(tipo, alGuardar) {
  const nombreTipo = TIPOS[tipo].nombre;
  const originales = telasDeTipo(tipo, estado.config);
  const nombresOriginales = originales.map((t) => t.nombre);
  const precios = estado.config.telas?.[tipo] || {};
  const basicas = new Set(estado.config.telasSistemaBasico || []);
  // El tilde de "sistema básico" sólo tiene sentido donde el sistema lo decide
  // la tela: en los tipos que lo eligen a mano al cotizar, no.
  const conSistema = usaSistemaBasico(tipo) && !eligeSistema(tipo);

  let lista = originales.map((t) => ({
    nombre: t.nombre,
    colores: t.colores.join(', '),
    precio: precioBaseTela(tipo, t.nombre, estado.config),
    basico: basicas.has(t.nombre),
  }));
  const filaVacia = () => ({ nombre: '', colores: '', precio: 0, basico: false });
  if (!lista.length) lista.push(filaVacia());

  const m = modal(`Telas de ${nombreTipo}`, `
    <div class="mini mb-16">Agregá, renombrá o borrá telas de ${nombreTipo.toLowerCase()}. Los colores van
    separados por coma y se eligen al cotizar; si alguno vale distinto, su precio se carga en Ajustes,
    debajo de la tela.
    ${conSistema ? ' Tildá <strong>sistema básico</strong> para las que usan el sistema más económico (por defecto Blackout y Sunscreen 5%); el resto usa "demás telas".' : ''}</div>
    <div data-filas></div>
    <button class="btn btn--chico mt-16" data-agregar style="width:100%">+ Agregar tela</button>
    <div class="fila-botones fila-botones--fin mt-16">
      <button class="btn btn--fantasma" data-cerrar>Cancelar</button>
      <button class="btn btn--primario" id="tl-ok">Guardar</button>
    </div>`, { ancho: '640px' });

  const cajaFilas = m.cuerpo.querySelector('[data-filas]');

  function pintarFilas() {
    cajaFilas.innerHTML = lista.map((t, i) => `
      <div class="campo" style="margin-bottom:.7rem">
        <div style="display:flex;align-items:center;gap:.5rem">
          <input data-nombre="${i}" placeholder="Ej. Sunscreen 3%" value="${esc(t.nombre)}" style="flex:1">
          <div class="con-prefijo" style="width:130px"><span>$</span>
            <input type="number" inputmode="decimal" min="0" step="1" data-precio="${i}" value="${t.precio}">
          </div>
          ${conSistema ? `
          <label class="switch" style="margin:0" title="Usa el sistema básico">
            <input type="checkbox" data-basico="${i}"${t.basico ? ' checked' : ''}>
            <span class="switch__pista"></span>
          </label>` : ''}
          <button class="btn-icono" data-quitar="${i}" title="Quitar">&#10005;</button>
        </div>
        <input data-colores="${i}" placeholder="Colores, separados por coma" value="${esc(t.colores)}" style="margin-top:.35rem">
      </div>`).join('');

    cajaFilas.querySelectorAll('[data-colores]').forEach((inp) =>
      inp.addEventListener('input', () => { lista[Number(inp.dataset.colores)].colores = inp.value; })
    );

    cajaFilas.querySelectorAll('[data-nombre]').forEach((inp) =>
      inp.addEventListener('input', () => { lista[Number(inp.dataset.nombre)].nombre = inp.value; })
    );
    cajaFilas.querySelectorAll('[data-precio]').forEach((inp) =>
      inp.addEventListener('input', () => { lista[Number(inp.dataset.precio)].precio = Number(inp.value) || 0; })
    );
    cajaFilas.querySelectorAll('[data-basico]').forEach((inp) =>
      inp.addEventListener('change', () => { lista[Number(inp.dataset.basico)].basico = inp.checked; })
    );
    cajaFilas.querySelectorAll('[data-quitar]').forEach((b) =>
      b.addEventListener('click', () => {
        lista.splice(Number(b.dataset.quitar), 1);
        if (!lista.length) lista.push(filaVacia());
        pintarFilas();
      })
    );
  }
  pintarFilas();

  m.cuerpo.querySelector('[data-agregar]').addEventListener('click', () => {
    lista.push(filaVacia());
    pintarFilas();
  });

  m.cuerpo.querySelector('#tl-ok').onclick = async () => {
    const limpia = lista.map((t) => ({ ...t, nombre: t.nombre.trim() })).filter((t) => t.nombre);
    if (!limpia.length) {
      aviso('Cargá al menos una tela.', 'error');
      return;
    }
    const nombresNuevos = [...new Set(limpia.map((t) => t.nombre))];
    const preciosNuevos = { ...precios };
    nombresNuevos.forEach((n) => {
      const fila = limpia.find((t) => t.nombre === n);
      const actual = preciosNuevos[n];
      // Si la tela tenía precios por color, se le cambia sólo el general.
      preciosNuevos[n] = actual && typeof actual === 'object' ? { ...actual, '*': fila.precio } : fila.precio;
    });
    // La tela se guarda como nombre suelto mientras no tenga colores; así los
    // tipos que no los usan quedan igual que siempre.
    const catalogoNuevo = nombresNuevos.map((n) => {
      const colores = limpia.find((t) => t.nombre === n).colores
        .split(',').map((x) => x.trim()).filter(Boolean);
      return colores.length ? { nombre: n, colores } : n;
    });

    const cambios = {
      catalogoTelas: { ...estado.config.catalogoTelas, [tipo]: catalogoNuevo },
      telas: { ...estado.config.telas, [tipo]: preciosNuevos },
    };
    if (conSistema) {
      // Las telas que no pertenecen a este tipo (por ejemplo, si el nombre
      // también existe en el otro tipo) quedan como estaban; acá solo se
      // actualiza la parte de la lista que corresponde a las telas editadas.
      const ajenas = (estado.config.telasSistemaBasico || []).filter((n) => !nombresOriginales.includes(n));
      const propias = limpia.filter((t) => t.basico).map((t) => t.nombre);
      cambios.telasSistemaBasico = [...ajenas, ...propias];
    }
    await guardarConfig(cambios);
    m.cerrar();
    aviso('Telas actualizadas.');
    alGuardar?.();
  };
}

/**
 * Agregar, renombrar o borrar sistemas. Los que arma el cálculo automático
 * (vertical × básico/demás, y zebra) se pueden renombrar o borrar igual que
 * cualquier otro: si se borra uno que el cálculo sigue necesitando, esa
 * combinación de tela pasa a costar $0 de sistema hasta que se cargue uno
 * nuevo (igual que cualquier costo sin cargar en esta app).
 *
 * Un sistema agregado a mano sin tipo de cortina no queda atado a nada: queda
 * para cargarle un costo, pero el cotizador no lo ofrece en ningún lado. Para
 * que aparezca al cotizar una roller, hay que elegirle el tipo.
 */
function dialogoSistemas(alGuardar) {
  // La lista sale de sistemasDeConfig y no del catálogo guardado a secas: así
  // los sistemas que el cálculo conoce pero el config todavía no tiene
  // aparecen acá, y guardar no les borra el costo por no haber estado en la
  // lista.
  let lista = sistemasDeConfig(estado.config).map((s) => ({ ...s, colores: s.colores.join(', '), precio: Number(estado.config.sistemas?.[s.id]) || 0 }));

  const m = modal('Sistemas', `
    <div class="mini mb-16">Agregá, renombrá o borrá sistemas. Cada uno va atado a un tipo de cortina:
    en roller el sistema se elige a mano al cotizar, así que todos los de roller aparecen en ese
    selector; en los demás tipos lo elige solo el cálculo según la tela. Los colores van separados
    por coma. Los marcados con ★ son los que asigna el cálculo: si borrás uno, las cortinas que lo
    usaban cotizan con $0 de sistema hasta que les pongas otro.</div>
    <div data-filas></div>
    <button class="btn btn--chico mt-16" data-agregar style="width:100%">+ Agregar sistema</button>
    <div class="fila-botones fila-botones--fin mt-16">
      <button class="btn btn--fantasma" data-cerrar>Cancelar</button>
      <button class="btn btn--primario" id="ss-ok">Guardar</button>
    </div>`, { ancho: '640px' });

  const cajaFilas = m.cuerpo.querySelector('[data-filas]');

  function pintarFilas() {
    cajaFilas.innerHTML = lista.map((s, i) => `
      <div class="campo" style="margin-bottom:.7rem${s.oculto ? ';opacity:.6' : ''}">
        <div style="display:flex;align-items:center;gap:.5rem">
          <input data-nombre="${i}" placeholder="Nombre del sistema" value="${esc(s.nombre)}" style="flex:1">
          ${s.protegido ? '<span class="mini" title="Lo asigna solo el cálculo">★</span>' : ''}
          <div class="con-prefijo" style="width:140px"><span>$</span>
            <input type="number" inputmode="decimal" min="0" step="1" data-precio="${i}" value="${s.precio}">
          </div>
          <button class="btn-icono" data-quitar="${i}" title="Quitar">&#10005;</button>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;margin-top:.35rem">
          <select data-tipo-sistema="${i}" style="width:190px">
            <option value="">Sin tipo de cortina</option>
            ${Object.entries(TIPOS).map(([clave, def]) => `<option value="${clave}"${s.tipo === clave ? ' selected' : ''}>${esc(def.nombre)}</option>`).join('')}
          </select>
          <input data-colores="${i}" placeholder="Colores, separados por coma" value="${esc(s.colores)}" style="flex:1">
        </div>
        ${s.oculto ? '<div class="mini" style="margin-top:.3rem">De una versión anterior: vale para lo ya cotizado, pero no se ofrece al armar una cortina nueva.</div>' : ''}
      </div>`).join('');

    cajaFilas.querySelectorAll('[data-tipo-sistema]').forEach((inp) =>
      inp.addEventListener('change', () => { lista[Number(inp.dataset.tipoSistema)].tipo = inp.value; })
    );
    cajaFilas.querySelectorAll('[data-colores]').forEach((inp) =>
      inp.addEventListener('input', () => { lista[Number(inp.dataset.colores)].colores = inp.value; })
    );

    cajaFilas.querySelectorAll('[data-nombre]').forEach((inp) =>
      inp.addEventListener('input', () => { lista[Number(inp.dataset.nombre)].nombre = inp.value; })
    );
    cajaFilas.querySelectorAll('[data-precio]').forEach((inp) =>
      inp.addEventListener('input', () => { lista[Number(inp.dataset.precio)].precio = Number(inp.value) || 0; })
    );
    cajaFilas.querySelectorAll('[data-quitar]').forEach((b) =>
      b.addEventListener('click', () => {
        lista.splice(Number(b.dataset.quitar), 1);
        pintarFilas();
      })
    );
  }
  pintarFilas();

  m.cuerpo.querySelector('[data-agregar]').addEventListener('click', () => {
    lista.push({ id: crypto.randomUUID(), nombre: '', tipo: '', colores: '', protegido: false, oculto: false, precio: 0 });
    pintarFilas();
  });

  m.cuerpo.querySelector('#ss-ok').onclick = async () => {
    const limpia = lista.map((s) => ({ ...s, nombre: s.nombre.trim() })).filter((s) => s.nombre);
    // Los ★ son los que el cálculo asigna solo según la tela. Si borrás uno,
    // esas cortinas pasan a cotizar con $0 de sistema: conviene decirlo.
    const borradosDelCalculo = sistemasDeConfig(estado.config)
      .filter((s) => s.protegido && !s.oculto && !limpia.some((x) => x.id === s.id))
      .map((s) => s.nombre);
    const catalogoSistemas = limpia.map(({ id, nombre, tipo, colores, protegido, oculto }) => ({
      id,
      nombre,
      tipo: tipo || '',
      colores: String(colores || '').split(',').map((x) => x.trim()).filter(Boolean),
      protegido: !!protegido,
      oculto: !!oculto,
    }));
    const sistemas = Object.fromEntries(limpia.map((s) => [s.id, s.precio]));
    await guardarConfig({ catalogoSistemas, sistemas });
    m.cerrar();
    aviso(
      borradosDelCalculo.length
        ? `Sistemas actualizados. Borraste ${borradosDelCalculo.join(' y ')}: las cortinas que lo usaban van a cotizar con $0 de sistema.`
        : 'Sistemas actualizados.',
      borradosDelCalculo.length ? 'error' : 'ok'
    );
    alGuardar?.();
  };
}

/**
 * Agregar, editar o borrar adicionales: cada uno es nombre + precio de
 * contado por unidad.
 */
function dialogoProductos(categoria, alGuardar) {
  let lista = (estado.config[categoria] || []).map((p) => ({ ...p }));
  if (!lista.length) lista.push({ id: crypto.randomUUID(), nombre: '', precio: 0 });

  const m = modal('Adicionales', `
    <div class="mini mb-16">Precio de contado por unidad. En el cotizador se multiplica por la
    cantidad y se le aplica el descuento de contado/lista.</div>
    <div data-filas></div>
    <button class="btn btn--chico mt-16" data-agregar style="width:100%">+ Agregar producto</button>
    <div class="fila-botones fila-botones--fin mt-16">
      <button class="btn btn--fantasma" data-cerrar>Cancelar</button>
      <button class="btn btn--primario" id="pr-ok">Guardar</button>
    </div>`, { ancho: '560px' });

  const cajaFilas = m.cuerpo.querySelector('[data-filas]');

  function pintarFilas() {
    cajaFilas.innerHTML = lista.map((p, i) => `
      <div class="campo" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
        <input data-nombre="${i}" placeholder="Ej. Traba de seguridad" value="${esc(p.nombre)}" style="flex:1">
        <div class="con-prefijo" style="width:150px"><span>$</span>
          <input type="number" inputmode="decimal" min="0" step="1" data-precio="${i}" value="${Number(p.precio) || 0}">
        </div>
        <button class="btn-icono" data-quitar="${i}" title="Quitar">&#10005;</button>
      </div>`).join('');

    cajaFilas.querySelectorAll('[data-nombre]').forEach((inp) =>
      inp.addEventListener('input', () => { lista[Number(inp.dataset.nombre)].nombre = inp.value; })
    );
    cajaFilas.querySelectorAll('[data-precio]').forEach((inp) =>
      inp.addEventListener('input', () => { lista[Number(inp.dataset.precio)].precio = Number(inp.value) || 0; })
    );
    cajaFilas.querySelectorAll('[data-quitar]').forEach((b) =>
      b.addEventListener('click', () => {
        lista.splice(Number(b.dataset.quitar), 1);
        if (!lista.length) lista.push({ id: crypto.randomUUID(), nombre: '', precio: 0 });
        pintarFilas();
      })
    );
  }
  pintarFilas();

  m.cuerpo.querySelector('[data-agregar]').addEventListener('click', () => {
    lista.push({ id: crypto.randomUUID(), nombre: '', precio: 0 });
    pintarFilas();
  });

  m.cuerpo.querySelector('#pr-ok').onclick = async () => {
    const limpia = lista
      .filter((p) => p.nombre.trim())
      .map((p) => ({ id: p.id || crypto.randomUUID(), nombre: p.nombre.trim(), precio: Number(p.precio) || 0 }));
    await guardarConfig({ [categoria]: limpia });
    m.cerrar();
    aviso('Productos actualizados.');
    alGuardar?.();
  };
}
