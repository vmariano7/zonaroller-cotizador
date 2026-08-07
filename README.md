# Cotizador Zona Roller

Herramienta interna de Zona Roller (cortinas a medida, Mendoza) para cotizar,
seguir pedidos, controlar la caja y agendar visitas e instalaciones.

Funciona en la computadora y en el celular, y se puede sumar a la pantalla de
inicio como una app.

## Secciones

| Sección | Para qué |
|---|---|
| **Cotizar** | Cargar cliente y cortinas, ver el total en vivo, guardar el presupuesto. Autocompleta los datos de clientes que ya compraron. |
| **Presupuestos** | Buscar, editar, duplicar, exportar a PDF, mandar por WhatsApp, convertir en pedido. |
| **Pedidos** | Pedidos confirmados (desde un presupuesto o desde cero), estado, fecha de instalación, pagos y orden de trabajo. |
| **Agenda** | Calendario con visitas a domicilio, instalaciones y tareas. Las instalaciones cargadas en un pedido aparecen solas. |
| **Caja** | Cuánto falta cobrar, quién debe, instalaciones a pagar, ingresos y gastos del mes. |
| **Clientes** | Historial de cada uno: qué compró, cuánto pagó, si debe, qué telas prefiere. Se arman solos con lo que cargás. |
| **Reportes** | Ventas por mes divididas por tipo de cortina, telas más vendidas, mejores clientes, conversión de presupuestos y margen. |
| **Ajustes** | Precios de telas y sistemas, incrementos, reglas de cálculo, datos de la empresa, PIN, sincronización y respaldos. |

En el celular la barra de abajo muestra las cuatro de uso diario; el resto entra
por **Más**. En la computadora se ven todas en el panel lateral.

## Cómo está hecho

HTML, CSS y JavaScript sin dependencias ni compilación: se sirve como archivos
estáticos desde GitHub Pages.

```
index.html            estructura y arranque
css/app.css           todos los estilos, incluida la hoja de impresión del PDF
js/calc.js            motor de cálculo (fórmula de precios)
js/store.js           datos: caché local + sincronización con Supabase
js/dinero.js          totales, cobrado y saldo de un pedido
js/router.js          navegación por hash (#/cotizar, #/pedidos, …)
js/ui.js              formato de moneda y fechas, diálogos, avisos
js/graficos.js        columnas apiladas y barras en SVG, sin librerías
js/pdf.js             presupuesto y orden de trabajo para imprimir o guardar en PDF
js/candado.js         pantalla de PIN
js/vistas/            una pantalla por archivo
sw.js                 service worker: la app abre aunque no haya señal
```

### Dónde viven los datos

En el navegador (localStorage) siempre, y en **Supabase** cuando está configurado,
que es lo que permite ver lo mismo en la compu y en el celular.

**En este repositorio no hay claves ni precios.** Las credenciales de Supabase se
cargan a mano en Ajustes y quedan guardadas solo en cada dispositivo. Las
instrucciones de puesta en marcha y el SQL con los costos están en la carpeta
`privado/`, que no se publica.

## Probarlo en la computadora

```bash
node servidor-local.js
```

Después, abrir http://localhost:4321
