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
        error.textContent = /invalid login/i.test(err.message)
          ? 'Email o contraseña incorrectos.'
          : `No pude entrar. ${err.message}`;
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
