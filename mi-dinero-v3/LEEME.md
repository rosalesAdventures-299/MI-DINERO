# Mi Dinero 💰

Tu app personal de gastos e ingresos. Funciona **100% en tu teléfono**, sin
cuentas, sin servidor y sin internet una vez instalada. Tus datos nunca salen
de tu Samsung S26 Ultra.

## ¿Qué incluye?

- **Inicio**: saldo total, ingresos/gastos del mes, tus cuentas y tus
  movimientos más recientes.
- **Movimientos**: historial completo con buscador y filtros (gastos,
  ingresos, transferencias).
- **Análisis**: gastos por categoría y una gráfica de ingresos vs. gastos de
  los últimos 6 meses.
- **Registrar**: agrega gastos, ingresos o transferencias entre tus cuentas,
  con categoría, cuenta, fecha y nota.
- **Más**: tu perfil, tus cuentas, tus categorías (puedes agregar o borrar
  las tuyas), y copias de seguridad de tus datos.

## Paso 1 — Publícala en internet (una sola vez)

Para poder "instalarla" como app en Android, Chrome necesita que la app viva
en una dirección https:// (no basta con abrir el archivo directo en el
teléfono). Esto solo lo haces **una vez**. Dos formas fáciles, gratis:

### Opción A: Netlify Drop (la más rápida, sin instalar nada)

1. Descomprime esta carpeta en tu computadora.
2. Entra a **https://app.netlify.com/drop** desde tu computadora.
3. Arrastra la carpeta completa (con todos sus archivos) a la página.
4. En segundos te da un enlace como `https://algo-al-azar.netlify.app`.
5. Opcional: crea una cuenta gratis en Netlify para que ese enlace no
   desaparezca y puedas actualizarlo después.

### Opción B: GitHub Pages (si ya usas GitHub)

1. Crea un repositorio nuevo (puede ser privado) y sube todos estos
   archivos a la raíz del repositorio.
2. Ve a **Settings → Pages**, y en "Source" elige la rama `main` y la
   carpeta `/root`.
3. Guarda. GitHub te da un enlace como
   `https://tu-usuario.github.io/tu-repositorio/`.

Cualquiera de las dos opciones funciona igual de bien. Guarda el enlace que
te den, lo vas a usar en tu teléfono.

## Paso 2 — Instálala en tu Samsung S26 Ultra

1. Abre **Chrome** en tu teléfono y entra al enlace del Paso 1.
2. Toca el menú **⋮** (arriba a la derecha).
3. Toca **"Instalar app"** o **"Añadir a pantalla de inicio"**.
4. Confirma. Verás el ícono de "Mi Dinero" en tu pantalla de inicio, como
   cualquier otra app — abre en pantalla completa, sin la barra de Chrome.

Desde ese momento la app funciona **sin internet**, incluso en modo avión.

## Tus datos y las copias de seguridad

Todo se guarda en el almacenamiento local de tu teléfono (nunca se sube a
ningún servidor). Esto tiene una consecuencia importante: si borras los
datos del navegador/app desde los ajustes de Android, o desinstalas la app,
perderás tu historial. Por eso:

- Ve seguido a **Más → Exportar copia de seguridad** para descargar un
  archivo `.json` con todo tu historial. Guárdalo donde prefieras (Drive,
  correo, etc.).
- Si algún día cambias de teléfono o necesitas restaurar, usa
  **Más → Importar copia de seguridad** con ese mismo archivo.

## Actualizar la app más adelante

Si en el futuro me pides cambios y te mando una versión nueva de estos
archivos: vuelve a subirlos al mismo lugar donde la publicaste (mismo sitio
de Netlify o mismo repositorio de GitHub), y sube por uno el número de
`CACHE_NAME` dentro de `sw.js` (por ejemplo de `mi-dinero-v1` a
`mi-dinero-v2`). Eso le avisa a tu teléfono que hay una versión nueva para
descargar. Tus datos (que viven aparte, en el almacenamiento local) no se
tocan al actualizar.

## Estructura de archivos

```
index.html               La pantalla y estructura de la app
styles.css                Todo el diseño visual
app.js                     Toda la lógica: cuentas, categorías, cálculos, gráficas
manifest.webmanifest      Metadatos para poder "instalar" la app
sw.js                       Hace que funcione sin internet
icon.svg / icon-*.png     Ícono de la app
LEEME.md                   Este archivo
```

---

Hecha a la medida a partir del diseño que subiste — cualquier ajuste
(colores, categorías por defecto, más cuentas, otra moneda, etc.) dime y lo
actualizo.
