// Exportación a PDF usando la impresión del navegador.
// En el celular: botón compartir → Imprimir → Guardar como PDF.
// En la compu: destino "Guardar como PDF".

import { estado } from './store.js';
import { calcularTotales, descripcionItem, detallesTecnicos } from './calc.js';
import { plata, num, fecha, esc, sumarDias, ajuste } from './ui.js';
import { datosContado } from './mensaje.js';

const NOMBRE_TIPO = { roller: 'Roller', vertical: 'Bandas verticales', zebra: 'Zebra', tela_tradicional: 'Cortina Tela Tradicional' };

export function montarHoja(html, tituloVentana, claseExtra = '') {
  document.querySelectorAll('.hoja').forEach((n) => n.remove());
  const hoja = document.createElement('div');
  hoja.className = `hoja${claseExtra ? ` ${claseExtra}` : ''}`;
  hoja.innerHTML = html;
  document.body.appendChild(hoja);

  const tituloPrevio = document.title;
  document.title = tituloVentana;

  const limpiar = () => {
    document.title = tituloPrevio;
    hoja.remove();
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);

  // Damos un respiro al navegador para pintar antes de abrir el diálogo.
  setTimeout(() => window.print(), 60);
  // Red de seguridad por si el navegador no dispara afterprint.
  setTimeout(limpiar, 60000);
}

function encabezado(emp) {
  return `
    <div class="hoja__cab">
      <div>
        <div class="hoja__marca">${esc(emp.nombre || 'Zona Roller')}</div>
        <div style="font-size:8.5pt">Cortinas roller a medida · Mendoza</div>
      </div>
      <div class="hoja__datos">
        ${emp.telefono ? `${esc(emp.telefono)}<br>` : ''}
        ${emp.instagram ? `${esc(emp.instagram)}<br>` : ''}
        ${emp.email ? `${esc(emp.email)}<br>` : ''}
        ${emp.direccion ? `${esc(emp.direccion)}` : ''}
      </div>
    </div>`;
}

function bloqueCliente(cliente) {
  return `
    <div class="hoja__bloque">
      <h4>Cliente</h4>
      <strong>${esc(cliente?.nombre || '—')}</strong><br>
      ${cliente?.direccion ? `${esc(cliente.direccion)}${cliente.ciudad ? `, ${esc(cliente.ciudad)}` : ''}<br>` : ''}
      ${cliente?.telefono ? `${esc(cliente.telefono)}<br>` : ''}
      ${cliente?.email ? `${esc(cliente.email)}` : ''}
    </div>`;
}

export function imprimirPresupuesto(p) {
  const emp = estado.config.empresa || {};
  const t = calcularTotales(p.items, estado.config, { descuentoPct: p.descuentoPct });
  const dias = p.validezDias ?? emp.validezDias ?? 15;
  const validez = sumarDias(p.fecha, dias);
  const ctd = datosContado(p, estado.config, t.total);

  const html = `
    ${encabezado(emp)}

    <div class="hoja__titulo">
      <h1>Presupuesto ${esc(p.numero || '')}</h1>
      <div style="margin-left:auto;font-size:9.5pt">${fecha(p.fecha)}</div>
    </div>

    <div class="hoja__bloques">
      ${bloqueCliente(p.cliente)}
      <div class="hoja__bloque">
        <h4>Validez</h4>
        Este presupuesto es válido por ${num(dias, 0)} días,<br>hasta el <strong>${fecha(validez)}</strong>.
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:24%">Ambiente</th>
          <th style="width:30%">Cortina</th>
          <th class="num">Medidas</th>
          <th class="num">Cant.</th>
          <th class="num">Precio unit.</th>
          <th class="num">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${t.lineas.map(({ item, calc }) => `
          <tr>
            <td>${esc(item.ambiente || '—')}</td>
            <td>${esc(descripcionItem(item) || `${NOMBRE_TIPO[item.tipo] || item.tipo} · ${item.tela}`)}${item.detalle ? `<br><span style="font-size:8pt">${esc(item.detalle)}</span>` : ''}${item.instalacion ? '<br><span style="font-size:8pt">Instalación sin cargo</span>' : ''}</td>
            <td class="num">${num(calc.anchoM)} × ${num(calc.altoM)} m</td>
            <td class="num">${calc.cantidad}</td>
            <td class="num">${plata(calc.precioUnitario)}</td>
            <td class="num">${plata(calc.total)}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <div class="hoja__totales">
      <div><span>Subtotal</span><span>${plata(t.subtotal)}</span></div>
      ${ajuste(t) ? `<div><span>${esc(ajuste(t).etiqueta)}</span><span>${esc(ajuste(t).monto)}</span></div>` : ''}
      ${t.montoIva ? `<div><span>IVA ${num(t.ivaPct, 0)}%</span><span>${plata(t.montoIva)}</span></div>` : ''}
      <div class="total"><span>Total</span><span>${plata(t.total)}</span></div>
      <div class="contado"><span>Pagando de contado (${num(ctd.pct, 1)}% off)</span><span>${plata(ctd.contado)}</span></div>
    </div>

    <div class="hoja__pie">
      ${p.notas ? `<p><strong>Observaciones:</strong> ${esc(p.notas)}</p>` : ''}
      ${emp.formaPago ? `<p><strong>Forma de pago:</strong> ${esc(emp.formaPago)}</p>` : ''}
      <p>Los precios incluyen la confección a medida y la colocación indicada en cada renglón.
      Las medidas fueron tomadas según lo informado por el cliente; cualquier diferencia puede modificar el valor final.</p>
      <p style="margin-top:8px">¡Gracias por elegir ${esc(emp.nombre || 'Zona Roller')}!</p>
    </div>
  `;

  montarHoja(html, `Presupuesto ${p.numero || ''} - ${p.cliente?.nombre || ''}`.trim());
}

export function imprimirOrdenTrabajo(p) {
  const emp = estado.config.empresa || {};
  const t = calcularTotales(p.items, estado.config, { descuentoPct: p.descuentoPct });
  const pagado = (p.pagos || []).reduce((a, g) => a + (Number(g.monto) || 0), 0);

  const html = `
    ${encabezado(emp)}

    <div class="hoja__titulo">
      <h1>Orden de trabajo ${esc(p.numero || '')}</h1>
      <div style="margin-left:auto;font-size:9.5pt">${fecha(p.fecha)}</div>
    </div>

    <div class="hoja__bloques">
      ${bloqueCliente(p.cliente)}
      <div class="hoja__bloque">
        <h4>Instalación</h4>
        ${p.fechaInstalacion ? `<strong>${fecha(p.fechaInstalacion)}</strong>` : 'A coordinar'}<br>
        ${esc(p.cliente?.direccion || '')}
      </div>
      <div class="hoja__bloque">
        <h4>Cobranza</h4>
        Total ${plata(t.total)}<br>
        Pagado ${plata(pagado)}<br>
        <strong>Saldo ${plata(t.total - pagado)}</strong>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:20%">Ambiente</th>
          <th style="width:22%">Tipo y tela</th>
          <th class="num">Ancho</th>
          <th class="num">Alto</th>
          <th class="num">Cant.</th>
          <th style="width:24%">Sistema</th>
          <th style="width:18%">Detalle</th>
        </tr>
      </thead>
      <tbody>
        ${t.lineas.map(({ item, calc }) => {
          const esTelaTradicional = item.tipo === 'tela_tradicional';
          const ancho = esTelaTradicional ? `${num(item.anchoM)} m` : `${num(item.anchoCm, 0)} cm`;
          const alto = esTelaTradicional ? `${num(item.altoM)} m` : `${num(item.altoCm, 0)} cm`;
          // El taller necesita todo el armado: comando, cadena, caída, caño.
          const detalle = [...detallesTecnicos(item), item.detalle].filter(Boolean).join(' · ');
          return `
          <tr>
            <td>${esc(item.ambiente || '—')}</td>
            <td>${esc(NOMBRE_TIPO[item.tipo] || item.tipo)}<br><span style="font-size:8pt">${esc(item.tela)}${esTelaTradicional ? ` ${esc(item.color || '')}` : ''}</span></td>
            <td class="num"><strong>${ancho}</strong></td>
            <td class="num"><strong>${alto}</strong></td>
            <td class="num">${calc.cantidad}</td>
            <td style="font-size:8.5pt">${esc(calc.sistemaNombre)}</td>
            <td style="font-size:8.5pt">${esc(detalle)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <div class="hoja__pie">
      ${p.notas ? `<p><strong>Observaciones:</strong> ${esc(p.notas)}</p>` : ''}
      ${p.cliente?.notas ? `<p><strong>Notas internas:</strong> ${esc(p.cliente.notas)}</p>` : ''}
      <p style="margin-top:14px">Conforme de instalación — Firma del cliente: ______________________________</p>
    </div>
  `;

  montarHoja(html, `OT ${p.numero || ''} - ${p.cliente?.nombre || ''}`.trim());
}
