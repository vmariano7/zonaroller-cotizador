// Pantalla de bloqueo por PIN.
//
// Ojo con las expectativas: esto NO es seguridad real. La página es pública y
// cualquiera que sepa mirar el código la puede saltear. Sirve para que alguien
// que agarre tu celular desbloqueado no vea la facturación de un vistazo.
// Lo que sí protege los datos de verdad es que la clave de Supabase no está en
// el código: sin esa clave la app no tiene de dónde leer nada.

import { estado, guardarConfig } from './store.js';
import { el } from './ui.js';

const CLAVE_SESION = 'zr_desbloqueado';
const SAL = 'zona-roller-2026';

export async function hashPin(pin) {
  const datos = new TextEncoder().encode(`${SAL}:${String(pin).trim()}`);
  const buf = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function tienePin() {
  return !!estado.config?.pinHash;
}

export async function definirPin(pin) {
  if (!pin) {
    await guardarConfig({ pinHash: '' });
    sessionStorage.removeItem(CLAVE_SESION);
    return;
  }
  await guardarConfig({ pinHash: await hashPin(pin) });
  sessionStorage.setItem(CLAVE_SESION, '1');
}

export function estaDesbloqueado() {
  return sessionStorage.getItem(CLAVE_SESION) === '1';
}

export function bloquear() {
  sessionStorage.removeItem(CLAVE_SESION);
  location.reload();
}

/** Muestra la pantalla de PIN y resuelve cuando el usuario acierta. */
export function pedirPin() {
  return new Promise((resolve) => {
    const pantalla = el(`
      <div class="candado">
        <div class="candado__caja">
          <div class="cabecera__logo" style="width:44px;height:44px;font-size:1rem;border-radius:12px;margin:0 auto 1rem">ZR</div>
          <h1 style="text-align:center">Zona Roller</h1>
          <p class="sub" style="text-align:center;margin-bottom:1.25rem">Ingresá tu PIN para continuar</p>
          <input class="candado__pin" type="password" inputmode="numeric" autocomplete="current-password"
                 placeholder="••••" maxlength="12" aria-label="PIN">
          <div class="candado__error" hidden>PIN incorrecto</div>
          <button class="btn btn--primario mt-16" style="width:100%">Entrar</button>
        </div>
      </div>`);
    document.body.appendChild(pantalla);

    const campo = pantalla.querySelector('.candado__pin');
    const error = pantalla.querySelector('.candado__error');
    const boton = pantalla.querySelector('button');

    let intentos = 0;
    const probar = async () => {
      const hash = await hashPin(campo.value);
      if (hash === estado.config.pinHash) {
        sessionStorage.setItem(CLAVE_SESION, '1');
        pantalla.remove();
        resolve();
        return;
      }
      intentos++;
      error.hidden = false;
      error.textContent = intentos >= 3 ? 'PIN incorrecto. Si te lo olvidaste, borrá los datos del sitio en el navegador.' : 'PIN incorrecto';
      campo.value = '';
      campo.focus();
    };

    boton.addEventListener('click', probar);
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') probar();
      else error.hidden = true;
    });
    setTimeout(() => campo.focus(), 100);
  });
}
