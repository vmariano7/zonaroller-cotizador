// Pantalla de ingreso.
//
// Reemplaza al PIN, que solo tapaba la pantalla. Acá la sesión es de verdad: la
// abre Supabase y es lo único que habilita leer y escribir en la nube, porque
// las tablas no le contestan a nadie sin sesión.
//
// El formulario es un <form> con los autocomplete que espera el navegador, así
// Chrome ofrece guardar el email y la contraseña. Borrar el historial y las
// cookies no borra las contraseñas guardadas, así que después alcanza con un
// clic para volver a entrar.

import { iniciarSesion, estado } from './store.js';
import { el } from './ui.js';

/**
 * Traduce el error a algo que se pueda accionar.
 *
 * `fetch` tira un TypeError seco —"Failed to fetch" en Chrome, "Load failed" en
 * Safari— para todo lo que pasa antes de la respuesta: sin internet, un bloqueador
 * o antivirus que corta el pedido, o el reloj del equipo tan corrido que el
 * certificado parece inválido. Al usuario "Failed to fetch" no le dice nada.
 */
function explicar(err) {
  const msg = String(err?.message || '');
  if (/invalid login/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Falta confirmar el email de esta cuenta.';

  const esDeRed = err instanceof TypeError
    || /failed to fetch|networkerror|load failed|network request failed/i.test(msg);
  if (!esDeRed) return `No pude entrar. ${msg}`;

  if (!navigator.onLine) return 'Este equipo está sin internet. Conectate y probá de nuevo.';
  return 'No pude conectarme con el servidor. Suele ser el antivirus o una extensión '
    + 'del navegador bloqueando el pedido, o la fecha y hora del equipo mal puestas. '
    + 'Probá en una ventana de incógnito y revisá el reloj de la PC.';
}

/** Muestra la pantalla y resuelve cuando la sesión quedó abierta. */
export function pedirIngreso({ vencida = false } = {}) {
  return new Promise((resolve) => {
    const pantalla = el(`
      <div class="candado">
        <form class="candado__caja" autocomplete="on">
          <div class="cabecera__logo" style="width:44px;height:44px;font-size:1rem;border-radius:12px;margin:0 auto 1rem">ZR</div>
          <h1 style="text-align:center">Zona Roller</h1>
          <p class="sub" style="text-align:center;margin-bottom:1.25rem">${
            vencida ? 'Se venció la sesión. Entrá de nuevo para volver a sincronizar.' : 'Entrá con tu cuenta para ver tus datos.'
          }</p>
          <div class="campo">
            <label for="ing-email">Email</label>
            <input id="ing-email" name="email" type="email" inputmode="email"
                   autocomplete="username" placeholder="vos@ejemplo.com" required>
          </div>
          <div class="campo">
            <label for="ing-pass">Contraseña</label>
            <input id="ing-pass" name="password" type="password"
                   autocomplete="current-password" placeholder="••••••••" required>
          </div>
          <div class="candado__error" hidden></div>
          <button type="submit" class="btn btn--primario mt-16" style="width:100%">Entrar</button>
        </form>
      </div>`);
    document.body.appendChild(pantalla);

    const form = pantalla.querySelector('form');
    const campoEmail = pantalla.querySelector('#ing-email');
    const campoPass = pantalla.querySelector('#ing-pass');
    const error = pantalla.querySelector('.candado__error');
    const boton = pantalla.querySelector('button');

    // Si ya entró antes en este aparato, el email queda puesto.
    campoEmail.value = estado.sesion?.email || '';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.hidden = true;
      boton.disabled = true;
      boton.textContent = 'Entrando…';
      try {
        await iniciarSesion(campoEmail.value, campoPass.value);
        // Sacamos la pantalla recién después de que el navegador procese el
        // submit: si la borramos antes, no ofrece guardar la contraseña.
        setTimeout(() => pantalla.remove(), 0);
        resolve();
      } catch (err) {
        error.hidden = false;
        error.textContent = explicar(err);
        campoPass.value = '';
        campoPass.focus();
      } finally {
        boton.disabled = false;
        boton.textContent = 'Entrar';
      }
    });

    setTimeout(() => (campoEmail.value ? campoPass : campoEmail).focus(), 100);
  });
}
