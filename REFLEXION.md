# Práctica · CI/CD con Firebase Hosting y Hardening de Headers HTTP
**Programación Avanzada - 2026**  
**Alumno:** Jenaro Galdini  
**Repositorio:** [https://github.com/Jenaro112/practica-firebase-cicd](https://github.com/Jenaro112/practica-firebase-cicd)  
**URL de Producción:** [https://practica-cicd-jenaro.web.app](https://practica-cicd-jenaro.web.app)  

---

## 1. Entregables

| # | Entregable | Valor / Enlace |
|---|---|---|
| **1** | **Link al repositorio** | [https://github.com/Jenaro112/practica-firebase-cicd](https://github.com/Jenaro112/practica-firebase-cicd) |
| **2** | **URL de producción (live)** | [https://practica-cicd-jenaro.web.app](https://practica-cicd-jenaro.web.app) |
| **3** | **Link al Pull Request mergeado** | [PR #1: feat: actualizar título de bienvenida](https://github.com/Jenaro112/practica-firebase-cicd/pull/1) |
| | **Comentario del Bot de Firebase** | [Comentario en PR #1](https://github.com/Jenaro112/practica-firebase-cicd/pull/1#issuecomment-6428931260) |
| | **URL de Preview Channel** | [https://practica-cicd-jenaro--pr1-feat-titulo-cfz10qof.web.app](https://practica-cicd-jenaro--pr1-feat-titulo-cfz10qof.web.app) |

---

## 2. Salidas de `check-headers.mjs`

### Medición Inicial en Producción (B1)
Antes de aplicar las configuraciones de seguridad en `firebase.json`:

```text
▶ HTML: https://practica-cicd-jenaro.web.app/
  status 200
  ✘ content-security-policy (falta)
  ✔ strict-transport-security: max-age=31556926; includeSubDomains; preload
  ✘ x-content-type-options (falta)
  ✘ x-frame-options (falta)
  ✘ referrer-policy (falta)
  ✘ permissions-policy (falta)
  · cache-control: max-age=3600

▶ Asset estático: /_next/static/chunks/1x6obpmlu1_c2.js
  ✘ cache-control: max-age=3600

❌ 6 control(es) pendiente(s).
```

*Diagnóstico inicial en securityheaders.com:* Calificación **F** (o **D** debido a HSTS provisto por defecto en dominios `.web.app`), con ausencia total de políticas de aislamiento de recursos, prevención de sniffing y frames.

---

### Medición Final en Producción (B5)
Luego de la configuración de hardening, CSP y estrategia de caché:

```text
▶ HTML: https://practica-cicd-jenaro.web.app/
  status 200
  ✔ content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://picsum.photos https://fastly.picsum.photos; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;
  ✔ strict-transport-security: max-age=31536000; includeSubDomains; preload
  ✔ x-content-type-options: nosniff
  ✔ x-frame-options: DENY
  ✔ referrer-policy: strict-origin-when-cross-origin
  ✔ permissions-policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
  · cache-control: public, max-age=0, must-revalidate

▶ Asset estático: /_next/static/chunks/1x6obpmlu1_c2.js
  ✔ cache-control: public, max-age=31536000, immutable

✅ Todos los controles pasaron.
```

---

## 3. Preguntas de Reflexión

### 1. ¿Por qué el preview tiene vencimiento? ¿Qué riesgos tendría un preview que no vence nunca?
* **Propósito del vencimiento (`expires`):** Los preview channels son entornos efímeros diseñados exclusivamente para validar cambios durante el ciclo de vida del Pull Request. Su ciclo de vida concluye naturalmente cuando el PR se aprueba y se mergea (o se descarta).
* **Riesgos de canales sin expiración:**
  1. **Superficie de ataque y Shadow IT:** Canales olvidados continúan exponiendo versiones preliminares, vulnerabilidades no parcheadas, dependencias deprecadas o información en desarrollo al público bajo subdominios de la organización.
  2. **Consumo de cuotas y costos operativos:** En planes escalados (Blaze), almacenar y servir cientos de versiones y previews acumula cuotas de almacenamiento y ancho de banda innecesarias.
  3. **Confusión para usuarios y stakeholders:** Enlaces viejos compartidos en Slack o tickets de Jira siguen respondiendo y pueden ser confundidos con versiones oficiales o estables.

---

### 2. ¿Qué diferencia hay entre desplegar y liberar? ¿Dónde aparece cada concepto en este flujo?
* **Desplegar (Deploy):** Es el acto puramente técnico de compilar, transferir y disponer los artefactos de software en la infraestructura de destino (servidor, CDN, buckets). El software ya corre allí, pero no necesariamente atiende el tráfico real de los usuarios finales.
  * *En este flujo:* Ocurre cuando el workflow de PR compila y sube los archivos al preview channel `pr1-feat-titulo` (o cuando se crea una versión interna en Firebase Hosting sin apuntarla a live).
* **Liberar (Release):** Es la decisión de negocio de dirigir el tráfico de los usuarios reales a esa versión específica para que esté efectivamente en uso.
  * *En este flujo:* Ocurre cuando se hace el merge a `main` y el pipeline publica en el canal `live`, o cuando se ejecuta `npx firebase hosting:clone <PROJECT_ID>:<CANAL> <PROJECT_ID>:live` o un Rollback desde la consola (donde se cambia el puntero de la versión activa sin necesidad de compilar nada nuevo).

---

### 3. ¿Por qué la clave de la service account va en un secreto y no en el repo? ¿Qué podría hacer alguien que la obtenga? ¿Cómo limitarías el daño?
* **Por qué debe ser secreta:** La clave JSON de una cuenta de servicio es una credencial de autenticación programática permanente que concede acceso a la API de Google Cloud sin requerir autenticación de dos factores (2FA). Subirla al repositorio (especialmente público) la expone inmediatamente a motores de búsqueda y scrapers automatizados.
* **Impacto si un atacante la obtiene:**
  * Modificar, reemplazar o defacear el sitio en producción (inyectando código malicioso, phishing, mineros de criptomonedas o stealers de credenciales para los visitantes).
  * Crear o eliminar sitios y canales de hosting dentro del proyecto.
  * Si la cuenta de servicio posee roles más amplios en Google Cloud (como `Editor` o `Owner`), un atacante podría crear instancias de Cloud Run, máquinas virtuales de Compute Engine, acceder a bases de datos en Firestore o agotar el presupuesto de facturación.
* **Estrategias para limitar el daño (Principio de Menor Privilegio):**
  1. **Roles mínimos (IAM):** Otorgar únicamente `roles/firebasehosting.admin` (o `roles/firebasehosting.viewer` y deployer sobre el recurso exacto) y jamás roles proyect-wide como `Owner` o `Editor`.
  2. **Workload Identity Federation:** Eliminar por completo el uso de claves JSON fijas. Mediante OIDC (OpenID Connect), GitHub Actions intercambia un token firmado de corta duración por un token temporal de Google Cloud con expiración de 1 hora.
  3. **Restricción por entorno y rotación:** Usar Secrets de Entorno (`production` environment en GitHub) que exijan revisiones previas y auditoría de logs mediante Google Cloud Audit Logs.

---

### 4. La CSP rompió la app: ¿por qué? ¿Qué opciones evaluaste y qué costo de seguridad tiene cada una?
* **Por qué se rompió:**
  1. **Scripts Inline de Next.js / RSC:** Al compilar Next.js en modo estático con App Router y Turbopack, el framework inyecta scripts inline (`<script id="_R_">` y `self.__next_f.push(...)`) en `out/cursos.html` para hidratar el estado y renderizar el árbol de componentes. Con `script-src 'self'`, el navegador bloquea inmediatamente estos scripts inline, por lo que React no hidrata y el componente interactivo `<FiltroCursos />` queda inerte.
  2. **Imágenes Externas con Redirección:** La portada usa `<img src="https://picsum.photos/..." />`. Al solicitar la imagen, Picsum responde con una redirección `302` hacia `https://fastly.picsum.photos/...`. Si `img-src` solo contiene `'self'`, la imagen no carga; e incluso si contiene solo `https://picsum.photos`, se bloquea al seguir el redirect a Fastly.
* **Opciones evaluadas y sus costos de seguridad:**
  * **Opción A: `script-src 'self' 'unsafe-inline'` (Adoptada para compatibilidad estática):**
    * *Ventaja:* Permite la hidratación completa de Next.js sin servidores dinámicos.
    * *Costo de seguridad:* Abre la puerta a ataques de Cross-Site Scripting (XSS) mediante inyección de scripts en línea si existiera alguna vulnerabilidad en la entrada de datos.
  * **Opción B: Hashes criptográficos (`'sha256-...'`):**
    * *Ventaja:* Máxima seguridad sin relajar a `unsafe-inline`. Solo se ejecutan los scripts inline cuyos hashes coincidan exactamente con los calculados.
    * *Costo:* Requiere un paso en el pipeline de CI/CD que parsee los archivos HTML en `out/`, extraiga el contenido de cada `<script>` inline, calcule su SHA-256 en base64 e inyecte los hashes en el header CSP de `firebase.json` antes de desplegar.
  * **Opción C: Nonces (`'nonce-...'`):**
    * *Inviable en export estático:* Los nonces criptográficos deben ser únicos por cada petición HTTP (request), lo cual requiere un servidor en tiempo de ejecución (Node.js/SSR o Cloud Run) que no existe en hosting estático puro.

---

### 5. Para cada header de B2, ¿qué ataque mitiga?
1. **`Strict-Transport-Security` (HSTS):**
   * *Ataque:* Man-in-the-Middle (MitM), SSL Striping y sniffing de tráfico en redes inseguras. Obliga al navegador a comunicarse siempre vía HTTPS, bloqueando accesos por HTTP plano antes de emitir la petición.
2. **`X-Content-Type-Options: nosniff`:**
   * *Ataque:* MIME-confusion attacks y drive-by download attacks. Impide que el navegador "adivine" el tipo de contenido (MIME sniffing) de un archivo ejecutable disfrazado como imagen o texto plano.
3. **`X-Frame-Options: DENY` (complementado con `frame-ancestors 'none'` en CSP):**
   * *Ataque:* Clickjacking (UI Redressing). Previene que un atacante cargue nuestra aplicación dentro de un `<iframe />`, `<frame />` u `<object />` transparente en un sitio malicioso para engañar al usuario y forzarlo a hacer clics no deseados.
4. **`Referrer-Policy: strict-origin-when-cross-origin`:**
   * *Ataque:* Fuga de información sensible en URLs (tokens, parámetros privados, identificadores). Envía la URL completa solo en peticiones internas del mismo origen y HTTPS, y únicamente el dominio en peticiones cross-origin seguras.
5. **`Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`:**
   * *Ataque:* Abuso o hijacking de APIs del hardware o sensores del dispositivo (acceso silencioso a cámara, micrófono, ubicación) por parte de scripts o librerías de terceros comprometidas.
6. **`Cross-Origin-Opener-Policy: same-origin` (COOP) y `Cross-Origin-Resource-Policy: same-origin` (CORP):**
   * *Ataque:* Ataques de canal lateral (Spectre) y filtraciones cross-origin en el árbol de navegación. Aísla el contexto de navegación en un proceso independiente.

---

### 6. ¿Por qué los assets de `/_next/static/` pueden cachearse un año y el HTML no?
* **Assets versionados con hash de contenido (`/_next/static/**`):**
  * Next.js genera nombres de archivo basados en el hash SHA del contenido (ejemplo: `1x6obpmlu1_c2.js`).
  * Si el código cambia, el nombre del archivo cambia automáticamente. Por lo tanto, un archivo con un nombre dado es **inmutable**: nunca va a cambiar su contenido mientras conserve ese nombre.
  * Se puede cachear agresivamente con `max-age=31536000, immutable` tanto en el navegador del usuario como en los nodos de borde (edge CDN), reduciendo la latencia a 0 ms y ahorrando ancho de banda.
* **El archivo HTML (`/` o `/cursos.html`):**
  * El HTML es el punto de entrada que enlaza a los assets versionados mediante `<script src="...">` y `<link href="...">`.
  * Si el HTML quedara cacheado por un año en el navegador del usuario, cuando hagamos un nuevo deploy o un rollback, el navegador seguiría mostrando la versión vieja en caché y nunca se enteraría del cambio hasta que expire el caché.
  * Por eso, el HTML debe servirse con `public, max-age=0, must-revalidate` (o `no-cache`): el CDN y el navegador consultan condicionalmente mediante ETags; si no cambió responden con `304 Not Modified` instantáneo, pero si hubo un deploy o rollback, entregan de inmediato el nuevo HTML.

---

### 7. Si la app necesitara SSR, ¿qué cambiaría en la arquitectura, en la CSP y en el costo?
1. **Arquitectura:**
   * En lugar de export estático servido directamente desde los buckets de Cloud Storage de Firebase Hosting, se requeriría un entorno de cómputo en ejecución continua o serverless (como **Firebase App Hosting**, **Cloud Run** o **Cloud Functions**).
   * Firebase Hosting actuaría como Reverse Proxy / CDN hacia la instancia de Node.js en Cloud Run.
2. **Content-Security-Policy (CSP):**
   * Con un servidor dinámico, **se puede eliminar por completo `'unsafe-inline'`** y adoptar una CSP de máxima seguridad con **Nonces**: por cada petición entrante, el servidor genera un número pseudoaleatorio criptográfico único (`crypto.randomUUID()`), lo inyecta en el header `script-src 'nonce-<TOKEN>'` y en los tags `<script nonce="<TOKEN>">` de ese render.
   * Esto anula los riesgos de XSS sin necesidad de mantener listas de hashes SHA.
3. **Costo:**
   * Firebase Hosting en modo estático opera dentro del plan **Spark gratuito** (cero costo, sin tarjeta de crédito).
   * Al requerir SSR (Cloud Run / App Hosting), es obligatorio pasar al plan **Blaze** (facturación por consumo), donde se factura CPU, memoria por tiempo de ejecución de las instancias, invocaciones y egress de red, además del riesgo de costos imprevistos ante picos de tráfico si no se configuran límites estrictos de concurrencia.
