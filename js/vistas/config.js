// Configuración: costos, incrementos, reglas de cálculo, datos de la empresa,
// sincronización con la nube y respaldos.

import { estado, guardarConfig, cerrarSesion, sincronizar, exportarRespaldo, importarRespaldo } from '../store.js';
import { TIPOS, SISTEMAS } from '../calc.js';
import { esc, aviso, confirmar, descargarArchivo, fecha, plata, modal } from '../ui.js';
import { PLANTILLA_POR_DEFECTO, CLAVES } from '../mensaje.js';
import { tienePin, definirPin } from '../candado.js';

let temporizador;
function guardarPronto(parcial) {
  clearTimeout(temporizador);
  Object.assign(estado.config, parcial);
  temporizador = setTimeout(() => guardarConfig(estado.config), 600);
}

export function render(contenedor) {
  const c = estado.config;

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
            ${(c.catalogoTelas?.[tipo] || def.telas).map((tela) => `
              <div class="campo" style="display:flex;align-items:center;gap:.6rem">
                <label style="flex:1;margin:0;font-weight:500;color:var(--acento)">${esc(tela)}</label>
                <div class="con-prefijo" style="width:130px"><span>$</span>
                  <input type="number" inputmode="decimal" min="0" step="1" data-tela="${tipo}|${esc(tela)}" value="${c.telas?.[tipo]?.[tela] ?? 0}">
                </div>
              </div>`).join('')}
          </div>`).join('')}
      </div>
      <div class="banner banner--info" style="margin-top:1rem">
        <div><strong>Cortina Tela Tradicional</strong> no usa estos costos: su precio base sale de una fórmula fija propia (ancho, alto y ancho×alto), configurada directamente en el código. El porcentaje de ganancia sobre esa fórmula sí se configura, en Incrementos.</div>
      </div>
    </div>

    <div class="grid grid--2">
      <div class="tarjeta">
        <div class="tarjeta__cab">
          <span class="seccion-num">02</span>
          <div><h2>Placas</h2><div class="mini">Productos para la calculadora de Placas del cotizador.</div></div>
        </div>
        ${(c.placas || []).length ? `
          <div class="lista">
            ${(c.placas || []).map((p) => `
              <div class="campo" style="display:flex;align-items:center;gap:.6rem">
                <span style="flex:1;font-weight:500">${esc(p.nombre)}</span>
                <strong>${plata(p.precio)}</strong>
              </div>`).join('')}
          </div>
        ` : '<div class="mini">Todavía no cargaste ninguna placa.</div>'}
        <button class="btn btn--chico mt-16" data-gestionar-productos="placas" style="width:100%">Agregar / editar / borrar</button>
      </div>

      <div class="tarjeta">
        <div class="tarjeta__cab">
          <span class="seccion-num">03</span>
          <div><h2>Adicionales</h2><div class="mini">Productos para la calculadora de Adicionales del cotizador.</div></div>
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
        <button class="btn btn--chico mt-16" data-gestionar-productos="adicionales" style="width:100%">Agregar / editar / borrar</button>
      </div>
    </div>

    <div class="grid grid--2">
      <div class="tarjeta">
        <div class="tarjeta__cab">
          <span class="seccion-num">04</span>
          <div><h2>Costos de sistemas</h2><div class="mini">Valor por metro lineal (se calcula sobre el ancho).</div></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:.4rem">
          <button class="btn btn--chico btn--fantasma" data-gestionar-sistemas style="font-size:.7rem;padding:.3rem .6rem">Agregar / renombrar / borrar</button>
        </div>
        ${(c.catalogoSistemas || Object.entries(SISTEMAS).map(([id, nombre]) => ({ id, nombre }))).map(({ id: clave, nombre }) => `
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
      </div>

      <div>
        <div class="tarjeta">
          <div class="tarjeta__cab">
            <span class="seccion-num">05</span>
            <div><h2>Incrementos</h2><div class="mini">Activá y definí el porcentaje por artículo.</div></div>
          </div>
          ${Object.entries(TIPOS).map(([tipo, def]) => {
            const inc = c.incrementos?.[tipo] || { activo: true, valor: 0 };
            return `
            <div class="campo" style="display:flex;align-items:center;gap:.6rem">
              <label class="switch" style="margin:0">
                <input type="checkbox" data-inc-activo="${tipo}"${inc.activo ? ' checked' : ''}>
                <span class="switch__pista"></span>
              </label>
              <span style="flex:1;font-weight:600">${esc(def.nombre)}</span>
              <div class="con-sufijo" style="width:100px">
                <input type="number" inputmode="decimal" min="0" step="1" data-inc-valor="${tipo}" value="${inc.valor ?? 0}"><span>%</span>
              </div>
            </div>`;
          }).join('')}
          <div class="banner banner--info" style="margin:1rem 0 0">
            <div>En Roller, Verticales y Zebra el incremento se calcula sobre tela y sistema.
            En Tela Tradicional se calcula sobre la fórmula fija del renglón de arriba.
            En todos los casos la instalación se suma después, sin incremento.</div>
          </div>
        </div>

        <div class="tarjeta">
          <div class="tarjeta__cab">
            <span class="seccion-num">06</span>
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
        <span class="seccion-num">07</span>
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
        <span class="seccion-num">08</span>
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
      <div class="campo mt-16">
        <label>Texto del mensaje</label>
        <textarea data-ctd-texto rows="10" style="min-height:200px">${esc(c.contado?.plantilla || PLANTILLA_POR_DEFECTO)}</textarea>
        <div class="mini mt-16">Lo que va entre llaves se reemplaza solo: ${CLAVES.map(([k, q]) => `<code>${esc(k)}</code> ${esc(q)}`).join(' · ')}</div>
      </div>
      <div class="fila-botones">
        <button class="btn btn--fantasma btn--chico" data-ctd-restaurar>Volver al texto original</button>
      </div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta__cab">
        <span class="seccion-num">09</span>
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
        <span class="seccion-num">10</span>
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
        <span class="seccion-num">11</span>
        <div><h2>Respaldo</h2><div class="mini">Bajá una copia de todo o restaurá desde un archivo.</div></div>
      </div>
      <div class="fila-botones">
        <button class="btn" data-exportar>Descargar respaldo</button>
        <label class="btn" style="margin:0">Importar archivo<input type="file" accept="application/json,.json" data-importar hidden></label>
      </div>
      <div class="mini mt-16">${estado.presupuestos.length} presupuestos · ${estado.pedidos.length} pedidos · ${estado.agenda.length} eventos · ${estado.movimientos.length} movimientos</div>
    </div>
  `;

  // Todos los casilleros de acá abajo son <input type="number">, y esos siempre
  // entregan el valor con punto decimal y sin separador de miles. leerNumero,
  // que está pensado para texto en formato argentino, leería "1.5" como 15.
  const leerCasillero = (inp) => Number(inp.value) || 0;

  /* ---- Precios de telas ---- */
  contenedor.querySelectorAll('[data-tela]').forEach((inp) =>
    inp.addEventListener('input', () => {
      const [tipo, tela] = inp.dataset.tela.split('|');
      const telas = { ...estado.config.telas };
      telas[tipo] = { ...telas[tipo], [tela]: leerCasillero(inp) };
      guardarPronto({ telas });
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
  const textoMensaje = contenedor.querySelector('[data-ctd-texto]');
  textoMensaje.addEventListener('input', () =>
    guardarPronto({ contado: { ...estado.config.contado, plantilla: textoMensaje.value } })
  );
  contenedor.querySelector('[data-ctd-restaurar]').addEventListener('click', async () => {
    if (!(await confirmar('¿Volver al texto original? Perdés los cambios que le hayas hecho.', { textoOk: 'Volver al original' }))) return;
    textoMensaje.value = PLANTILLA_POR_DEFECTO;
    guardarPronto({ contado: { ...estado.config.contado, plantilla: '' } });
    aviso('Texto restaurado.');
  });

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
 * Agregar, renombrar o borrar telas de un tipo (roller, vertical o zebra).
 * Roller y vertical llevan además el tilde de "sistema básico": las telas
 * tildadas usan el sistema económico (ver `telasSistemaBasico` en calc.js);
 * las demás usan el sistema "demás telas". Zebra tiene un solo sistema, así
 * que ahí no hace falta elegir.
 */
function dialogoTelas(tipo, alGuardar) {
  const nombreTipo = TIPOS[tipo].nombre;
  const nombresOriginales = estado.config.catalogoTelas?.[tipo] || TIPOS[tipo].telas;
  const precios = estado.config.telas?.[tipo] || {};
  const basicas = new Set(estado.config.telasSistemaBasico || []);
  const conSistema = tipo !== 'zebra';

  let lista = nombresOriginales.map((n) => ({ nombre: n, precio: Number(precios[n]) || 0, basico: basicas.has(n) }));
  if (!lista.length) lista.push({ nombre: '', precio: 0, basico: false });

  const m = modal(`Telas de ${nombreTipo}`, `
    <div class="mini mb-16">Agregá, renombrá o borrá telas de ${nombreTipo.toLowerCase()}.
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
      <div class="campo" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
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
      </div>`).join('');

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
        if (!lista.length) lista.push({ nombre: '', precio: 0, basico: false });
        pintarFilas();
      })
    );
  }
  pintarFilas();

  m.cuerpo.querySelector('[data-agregar]').addEventListener('click', () => {
    lista.push({ nombre: '', precio: 0, basico: false });
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
    nombresNuevos.forEach((n) => { preciosNuevos[n] = limpia.find((t) => t.nombre === n).precio; });

    const cambios = {
      catalogoTelas: { ...estado.config.catalogoTelas, [tipo]: nombresNuevos },
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
 * Agregar, renombrar o borrar sistemas. Los 5 que arma el cálculo automático
 * (roller/vertical × básico/demás, y zebra) se pueden renombrar o borrar
 * igual que cualquier otro: si se borra uno que el cálculo sigue necesitando,
 * esa combinación de tela pasa a costar $0 de sistema hasta que se cargue uno
 * nuevo (igual que cualquier costo sin cargar en esta app).
 */
function dialogoSistemas(alGuardar) {
  const catalogoOriginal = estado.config.catalogoSistemas?.length
    ? estado.config.catalogoSistemas
    : Object.entries(SISTEMAS).map(([id, nombre]) => ({ id, nombre, protegido: true }));
  let lista = catalogoOriginal.map((s) => ({ ...s, precio: Number(estado.config.sistemas?.[s.id]) || 0 }));

  const m = modal('Sistemas', `
    <div class="mini mb-16">Agregá, renombrá o borrá sistemas. Los marcados con ★ son los que elige
    solo el cálculo según la tela (no se asignan a mano).</div>
    <div data-filas></div>
    <button class="btn btn--chico mt-16" data-agregar style="width:100%">+ Agregar sistema</button>
    <div class="fila-botones fila-botones--fin mt-16">
      <button class="btn btn--fantasma" data-cerrar>Cancelar</button>
      <button class="btn btn--primario" id="ss-ok">Guardar</button>
    </div>`, { ancho: '640px' });

  const cajaFilas = m.cuerpo.querySelector('[data-filas]');

  function pintarFilas() {
    cajaFilas.innerHTML = lista.map((s, i) => `
      <div class="campo" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
        <input data-nombre="${i}" placeholder="Nombre del sistema" value="${esc(s.nombre)}" style="flex:1">
        ${s.protegido ? '<span class="mini" title="Lo asigna solo el cálculo">★</span>' : ''}
        <div class="con-prefijo" style="width:140px"><span>$</span>
          <input type="number" inputmode="decimal" min="0" step="1" data-precio="${i}" value="${s.precio}">
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
        pintarFilas();
      })
    );
  }
  pintarFilas();

  m.cuerpo.querySelector('[data-agregar]').addEventListener('click', () => {
    lista.push({ id: crypto.randomUUID(), nombre: '', protegido: false, precio: 0 });
    pintarFilas();
  });

  m.cuerpo.querySelector('#ss-ok').onclick = async () => {
    const limpia = lista.map((s) => ({ ...s, nombre: s.nombre.trim() })).filter((s) => s.nombre);
    const catalogoSistemas = limpia.map(({ id, nombre, protegido }) => ({ id, nombre, protegido: !!protegido }));
    const sistemas = Object.fromEntries(limpia.map((s) => [s.id, s.precio]));
    await guardarConfig({ catalogoSistemas, sistemas });
    m.cerrar();
    aviso('Sistemas actualizados.');
    alGuardar?.();
  };
}

/**
 * Agregar, editar o borrar productos de Placas o Adicionales: cada uno es
 * simplemente nombre + precio, que la calculadora del cotizador multiplica
 * por la cantidad que se cargue.
 */
function dialogoProductos(categoria, alGuardar) {
  const titulo = categoria === 'placas' ? 'Placas' : 'Adicionales';
  let lista = (estado.config[categoria] || []).map((p) => ({ ...p }));
  if (!lista.length) lista.push({ id: crypto.randomUUID(), nombre: '', precio: 0 });

  const m = modal(`Productos: ${titulo}`, `
    <div class="mini mb-16">Estos son los productos que vas a poder elegir en la calculadora de
    ${titulo.toLowerCase()} del cotizador. El total sale de multiplicar el precio por la cantidad.</div>
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
        <input data-nombre="${i}" placeholder="Ej. Placa decorativa 60x60" value="${esc(p.nombre)}" style="flex:1">
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
