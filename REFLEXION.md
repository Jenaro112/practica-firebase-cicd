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

---

## 4. Estado Final de Entrega
* ✅ Batería de pruebas locales y de seguridad superada al 100%.
* ✅ Pipelines de CI/CD de preview y producción validados.
* ✅ Aplicación completamente endurecida y funcional en producción.

---
---

# Práctica · Clase 2 (lunes) · SQL con Firebase SQL Connect
**Programación Avanzada - 2026**  
**Alumno:** Jenaro Galdini  
**Repositorio:** [https://github.com/Jenaro112/practica-firebase-cicd](https://github.com/Jenaro112/practica-firebase-cicd)  
**URL de Producción:** [https://practica-cicd-jenaro.web.app](https://practica-cicd-jenaro.web.app)  

## 1. Entregables

| # | Entregable | Valor / Enlace |
|---|---|---|
| **1** | Repo con `dataconnect/` completo (L1–L5) | [https://github.com/Jenaro112/practica-firebase-cicd/tree/main/dataconnect](https://github.com/Jenaro112/practica-firebase-cicd/tree/main/dataconnect) |
| **2** | Salida de `npm run atacar` antes y después | Ver sección 3 |
| **3** | PR mergeado con el cambio de CSP (L6) | [PR #2: Clase 2 · SQL Connect + CSP](https://github.com/Jenaro112/practica-firebase-cicd/pull/2) |
| **4** | Producción con inscripción funcionando (L7) | [https://practica-cicd-jenaro.web.app/cursos](https://practica-cicd-jenaro.web.app/cursos) |
| **5** | Respuestas a la reflexión | Sección 4 |

## 2. Qué se implementó

| TODO | Archivo | Solución |
|---|---|---|
| **L1** | `dataconnect/schema/schema.gql` | `Matricula @table(key: ["alumno", "curso"])` con `alumno: Alumno!`, `curso: Curso!` (FK `alumnoId`, `cursoId`) y `fecha: Timestamp! @default(expr: "request.time")` |
| **L2** | `dataconnect/cursos/mutations.gql` | `Inscribirme($cursoId)` · `@auth(level: USER)` · `matricula_upsert(data: { alumnoId_expr: "auth.uid", cursoId: $cursoId })` |
| **L3** | `dataconnect/cursos/queries.gql` | `MisInscripciones` · `@auth(level: USER)` · `alumno(key: { id_expr: "auth.uid" }) { nombre matriculas: matriculas_on_alumno { fecha curso { id titulo nivel horas } } }` |
| **L4** | `dataconnect/cursos/queries.gql` | `ListAlumnos` pasó de `PUBLIC` a `NO_ACCESS` |
| **L5** | `dataconnect/cursos/mutations.gql` | `DarmeDeBaja($cursoId)` · `@auth(level: USER)` · `matricula_delete(key: { alumnoId_expr: "auth.uid", cursoId: $cursoId })` |
| **L6** | `firebase.json` | `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasedataconnect.googleapis.com` |
| **L7** | CLI | `npx firebase deploy --only dataconnect` + `npx firebase dataconnect:execute dataconnect/seed_data.gql` |

**Insert vs upsert (L2).** `matricula_insert` falla la segunda vez porque viola la clave primaria
`(alumnoId, cursoId)`. `matricula_upsert` hace `INSERT ... ON CONFLICT DO UPDATE`: si la fila ya
existe la actualiza, así que repetir la operación no falla ni duplica (es idempotente). Se puede
repetir sin miedo (doble click, reintento de red).

**Restricciones adicionales propuestas (L1, destacado).**
- La clave compuesta ya genera un índice único sobre `(alumnoId, cursoId)`. Conviene además un
  índice sobre `cursoId` solo (`@index(fields: ["curso"])`) para consultas del tipo "inscriptos de
  un curso", que no pueden usar el índice compuesto porque `cursoId` no es su primera columna.
- **Cupo:** `Curso.cupo` hoy no se controla. Se podría hacer `Inscribirme` como
  `@transaction` con un paso previo que cuente las matrículas del curso y un `@check` que aborte si
  `count >= cupo`. Así la regla queda del lado del servidor y no del cliente.
- `Curso.horas` y `Curso.cupo` deberían ser `> 0` (un `CHECK` en PostgreSQL).

## 3. Salidas de `npm run atacar`

### Antes de corregir (repo de la cátedra, sin L1–L5 y con `ListAlumnos` PUBLIC)

```text
Auditoría de SQL Connect · proyecto practica-cicd-jenaro · emuladores locales

✔ ListCursos responde sin login (7 cursos) — público por diseño
✘ ListAlumnos devuelve datos personales SIN login
    Ejemplo filtrado: {"email":"ana@ejemplo.test","id":"seed-uid-ana","nombre":"Ana Ficticia"}
… Inscribirme todavía no existe (TODO L2)
    operation "Inscribirme" not found
… No se pudo inscribir al usuario A: no se pueden probar los controles de aislamiento
    operation "Inscribirme" not found

❌ 1 vulnerabilidad(es) · 2 pendiente(s)
```

**Lectura:** la auditoría encontró la fuga de datos personales (`ListAlumnos` PUBLIC devolvía
id, nombre y email de cualquier alumno sin login). No pudo probar idempotencia ni aislamiento entre
usuarios porque `Inscribirme`, `MisInscripciones` y `DarmeDeBaja` todavía no existían.

### Después de corregir

```text
Auditoría de SQL Connect · proyecto practica-cicd-jenaro · emuladores locales

✔ ListCursos responde sin login (7 cursos) — público por diseño
✔ ListAlumnos rechazada para un cliente
    unauthorized: you are not authorized to perform this operation
    (debugDetails: "@auth(level: NO_ACCESS) always reject non-admin requests")
✔ Inscribirme rechazada sin login
    unauthenticated: this operation requires a signed-in user
    (debugDetails: "@auth(level: USER) requires a signed-in user")
✔ Inscribirme es idempotente (repetir no falla)
✔ MisInscripciones solo devuelve lo del usuario que llama
✔ B no puede dar de baja a A

✅ Todos los controles pasaron
```

## 4. Preguntas de reflexión

**1. ¿Por qué ninguna operación de este conector recibe el id del alumno como variable? ¿Qué es IDOR y cómo lo evita `auth.uid`?**  
Todo lo que manda el cliente lo puede elegir el atacante: el bundle es público y cualquiera puede
llamar a la API con un script. Si `MisInscripciones` recibiera `$alumnoId` y filtrara por eso,
alcanzaría con cambiar el valor para leer las inscripciones de otra persona (o, en
`Inscribirme`/`DarmeDeBaja`, para escribir en nombre de otra). Eso es **IDOR (Insecure Direct Object
Reference)**: el servidor usa un identificador que viene del cliente sin verificar que el usuario
tenga permiso sobre ese objeto. Con `auth.uid` la identidad sale del token de Firebase Auth, que el
servidor valida (firma y vencimiento). El cliente no lo puede falsificar ni cambiar, así que cada
operación queda limitada a las filas del usuario que llama.

**2. `ListCursos` es PUBLIC y `ListAlumnos` terminó en NO_ACCESS. ¿Qué criterio usaste? ¿Cómo haría el "panel de admin" para listar alumnos?**  
El criterio es **mínimo privilegio según el tipo de dato**. El catálogo es información que el negocio
quiere mostrar a cualquiera, incluso sin cuenta, así que `PUBLIC` es lo correcto. `ListAlumnos`
devuelve datos personales (nombre y email) de todos los alumnos. `USER` no alcanza porque cualquiera
puede registrarse en 10 segundos, y ningún usuario común necesita ver a los demás. Por eso
`NO_ACCESS`: ningún cliente la puede ejecutar.
El panel de admin no debería correr con los permisos del navegador. Opciones:
- Ejecutarla desde un entorno de confianza con credenciales de administrador (Admin SDK en una Cloud
  Function / backend propio, o `firebase dataconnect:execute`), que no pasa por `@auth`.
- Si tiene que ser desde el cliente: asignar un *custom claim* `admin: true` con el Admin SDK y
  declarar la operación con `@auth(expr: "auth.token.admin == true")`. Así solo la ejecuta quien tenga
  ese claim, que únicamente puede otorgar el servidor. Idealmente con paginación y sin exponer
  más campos de los necesarios.

**3. ¿Qué ventaja tiene una clave primaria compuesta en `Matricula` frente a validar duplicados en el código del cliente?**  
La validación en el cliente se puede saltear (llamando a la API directo) y además tiene una
condición de carrera: dos requests simultáneos pueden ver "no está inscripto" y crear las dos filas.
La clave compuesta `(alumnoId, cursoId)` es una restricción de PostgreSQL: la garantiza la base de
datos, de forma atómica, para cualquier camino de escritura (app, script, admin, migración). Además
no hace falta un UUID artificial: la identidad de una matrícula *es* el par alumno-curso, y viene
con su índice único, que acelera las búsquedas. Una clave UUID propia permitiría duplicados salvo que
se agregara aparte un `UNIQUE(alumnoId, cursoId)`.

**4. La configuración de Firebase (apiKey, etc.) es pública. ¿Por qué eso no compromete la base de datos? ¿Qué capa faltaría para frenar a alguien que usa esa config desde un script?**  
La `apiKey` no es una credencial de acceso: solo identifica al proyecto ante los servicios de Google.
No da permisos. Lo que protege los datos es (1) la autenticación (el token de Auth que identifica
*quién* llama) y (2) la autorización declarada en cada operación (`@auth`). Además el cliente solo
puede ejecutar operaciones predefinidas, nunca SQL arbitrario. Con la config pública, un atacante
puede hacer exactamente lo mismo que un usuario legítimo, y nada más (justamente lo que prueba
`npm run atacar`).
Lo que falta es verificar *desde dónde* se llama: **App Check**. Con reCAPTCHA Enterprise (web) o
Play Integrity / App Attest (mobile), la app obtiene una atestación de que es la app real. Con el
*enforcement* activado, SQL Connect rechaza requests sin un token de App Check válido. Así se frena
el uso desde scripts o bots, aunque tengan la config.

**5. Comparado con una API REST propia (Express + pg), ¿qué te da SQL Connect y qué perdés?**  
*Lo que da:* no hay servidor que mantener ni escalar. La inyección SQL queda cerrada por diseño
(operaciones predefinidas y parametrizadas). La autorización se declara junto a cada operación. Las
migraciones del esquema salen generadas (`dataconnect:sql:diff`), se genera un SDK tipado, hay
emuladores locales y se integra nativamente con Firebase Auth. Además es PostgreSQL real
(relaciones, transacciones, índices).
*Lo que se pierde:* flexibilidad. La lógica de negocio compleja (cupos con reglas raras, pagos,
mails, llamadas a terceros) no entra fácil en GraphQL declarativo y termina en Cloud Functions.
También se pierde control fino del SQL y de las optimizaciones, y hay *vendor lock-in* con Google
Cloud. El modelo de costos depende de Cloud SQL (en Spark la prueba dura 90 días). Debuggear y
observar es más difícil, y los patrones de autorización están limitados a lo que permite `@auth`
(con Express se puede programar cualquier regla).
Frente a **Firestore Rules**, en SQL Connect la autorización vive por *operación* y no por
documento: en Firestore el cliente arma consultas libres y las reglas validan cada documento leído o
escrito, mientras que acá el cliente no puede inventar consultas. Las reglas de Firestore son más
expresivas para validar *datos* (`request.resource.data`). SQL Connect gana en modelo relacional e
integridad referencial.

**6. ¿Por qué no alcanzó con la CSP de la clase 1 y por qué conviene listar dominios exactos en `connect-src`?**  
En la clase 1 la app no hacía requests a terceros, así que `connect-src 'self'` era suficiente.
Ahora el navegador hace `fetch` a Firebase Auth (`identitytoolkit.googleapis.com` para login y
registro, `securetoken.googleapis.com` para refrescar el token) y a SQL Connect
(`firebasedataconnect.googleapis.com`). Con `'self'` solo, el navegador bloquea esas conexiones
(`Refused to connect`) y la app no carga el catálogo ni permite iniciar sesión.
Hay que listar dominios exactos y no `https://*.googleapis.com` porque ese comodín habilita cientos
de APIs de Google, incluidas algunas donde un atacante puede tener su propio proyecto y recibir datos
(por ejemplo, Cloud Storage en `storage.googleapis.com`). Si alguien lograra inyectar un script (XSS),
`connect-src` es la última barrera contra la exfiltración de datos. Con un comodín amplio podría
mandar tokens o datos personales a un endpoint de Google que controle. Con la lista exacta, solo se
puede hablar con los servicios que la app realmente usa (mínimo privilegio también en la red).

---
---

## Práctica 4 · Firestore

**Programación Avanzada - 2026** · Reseñas de cursos en tiempo real con Cloud Firestore  
**Alumno:** Jenaro Galdini  

### Entregables

| # | Entregable | Valor / Enlace |
|---|---|---|
| **1** | `lib/resenas.ts`, `app/components/ResenasCurso.tsx`, `firestore.rules`, `firestore.indexes.json`, `tests/` | [Repositorio](https://github.com/Jenaro112/practica-firebase-cicd) |
| **2** | Salida de `npm run test:reglas` y prueba de "hacerlo fallar" | Ver abajo |
| **3** | Actualización en tiempo real entre dos navegadores | _PENDIENTE: capturas o video_ |
| **4** | PR mergeado con reglas, índice y CSP | _PENDIENTE: URL del PR_ |
| **5** | Respuestas a la reflexión | Ver abajo |

### Qué se implementó

| Paso | Archivo | Detalle |
|---|---|---|
| 1 | `lib/resenas.ts` | `firestore()` reutiliza la app de `lib/firebase.ts` y en desarrollo se conecta al emulador (`127.0.0.1:8080`). |
| 2 | `app/components/ResenasCurso.tsx` + `CatalogoSql.tsx` | Cada tarjeta del catálogo tiene "Ver reseñas": el listener solo existe mientras la sección está abierta. |
| 3 | `guardarResena` / `borrarResena` | Id del documento = UID; `serverTimestamp()` al crear; `{ merge: true }` sin `creadaEn` al editar. |
| 4 | `escucharResenas` | `onSnapshot` con `orderBy("creadaEn","desc")` + `limit(20)`, cancelado en el `return` del `useEffect`. Con `includeMetadataChanges` se muestra el estado **"enviando…"** (`hasPendingWrites`) hasta que el servidor confirma. |
| 4b | `escucharMiResena` | Lectura por id de la reseña propia: el formulario sabe si crear o editar aunque la reseña no esté entre las 20 últimas o el filtro "solo 5" la oculte (si no, mandaría un `serverTimestamp` nuevo y la regla de update lo rechazaría). |
| 5 | `resumenDe` | `getAggregateFromServer` con `count()` y `average("puntaje")`; se recalcula cuando cambia la lista. |
| 6 | `firestore.rules` | Identidad (`esDuenio`), lista blanca de campos, tipos y rangos, fecha del servidor e inmutable, cursos de solo lectura, resto cerrado. **Límites extra:** `texto` y `autor` no pueden estar vacíos, y `creadaEn` tiene que ser `timestamp`. |
| 7 | `tests/reglas.test.mjs` | Los 8 casos del enunciado + 7 propios: edición ajena, borrado ajeno, borrado sin login, tipos/tamaños (puntaje `"5"`, texto > 500, autor > 80 o vacío, límites exactos 500/80 aceptados), campo faltante, campo extra al editar, otras colecciones cerradas. |
| 8 | `firestore.indexes.json` | Índice compuesto `resenas`: `puntaje ASC` + `creadaEn DESC`. |
| 9 | `firebase.json` | Clave `firestore` (rules + indexes), emulador en el puerto 8080 y `https://firestore.googleapis.com` en `connect-src`. |

### Salida de `npm run test:reglas`

```text
> practica-firebase-cicd@1.0.0 test:reglas
> firebase emulators:exec --only firestore "node --test tests/"

i  emulators: Starting emulators: firestore
✔  firestore: Firestore Emulator was started in standard edition.
i  Running script: node --test tests/
✔ cualquiera puede leer reseñas, incluso sin login (447.060708ms)
✔ Ana puede crear SU reseña (77.689041ms)
✔ Ana NO puede crear una reseña a nombre de Bruno (23.05775ms)
✔ sin login no se puede escribir (16.264958ms)
✔ puntaje fuera de rango o con decimales se rechaza (27.891958ms)
✔ no se pueden agregar campos extra (p. ej. destacada: true) (17.569166ms)
✔ la fecha de creación la pone el servidor y no se puede cambiar (38.1905ms)
✔ el cliente no puede escribir el documento del curso (15.9085ms)
✔ Bruno NO puede editar la reseña de Ana (22.974375ms)
✔ Bruno NO puede borrar la reseña de Ana, pero Ana sí puede borrar la suya (30.321083ms)
✔ sin login no se puede borrar (23.314458ms)
✔ tipos y tamaños: puntaje como texto, texto > 500, autor > 80 o vacío se rechazan (40.747875ms)
✔ faltar un campo obligatorio se rechaza (14.429334ms)
✔ una edición no puede agregar campos extra (23.170041ms)
✔ cualquier otra colección está cerrada (24.969792ms)
ℹ tests 15
ℹ pass 15
ℹ fail 0
ℹ duration_ms 1065.928042
✔  Script exited successfully (code 0)
```

Entre los tests el SDK imprime líneas `PERMISSION_DENIED: false for 'create' @ L37 ...` (omitidas
arriba): son los rechazos esperados de los `assertFails`, e indican en qué línea de
`firestore.rules` se cortó la evaluación.

### Prueba de "hacerlo fallar" (`puntaje <= 5` → `puntaje <= 6`)

```text
$ sed -i '' 's/d.puntaje <= 5/d.puntaje <= 6/' firestore.rules && npm run test:reglas

✔ cualquiera puede leer reseñas, incluso sin login (412.258208ms)
✔ Ana puede crear SU reseña (80.089166ms)
✔ Ana NO puede crear una reseña a nombre de Bruno (22.353125ms)
✔ sin login no se puede escribir (17.400167ms)
✖ puntaje fuera de rango o con decimales se rechaza (18.648459ms)
✔ no se pueden agregar campos extra (p. ej. destacada: true) (19.65075ms)
✔ la fecha de creación la pone el servidor y no se puede cambiar (39.070667ms)
✔ el cliente no puede escribir el documento del curso (15.059ms)
✔ Bruno NO puede editar la reseña de Ana (20.6215ms)
✔ Bruno NO puede borrar la reseña de Ana, pero Ana sí puede borrar la suya (28.965708ms)
✔ sin login no se puede borrar (24.75525ms)
✔ tipos y tamaños: puntaje como texto, texto > 500, autor > 80 o vacío se rechazan (41.710334ms)
✔ faltar un campo obligatorio se rechaza (14.793875ms)
✔ una edición no puede agregar campos extra (22.957041ms)
✔ cualquier otra colección está cerrada (26.700667ms)
ℹ tests 15
ℹ pass 14
ℹ fail 1

✖ failing tests:

test at tests/reglas.test.mjs:56:1
✖ puntaje fuera de rango o con decimales se rechaza (18.648459ms)
  Error: Expected request to fail, but it succeeded.
      at async TestContext.<anonymous> (tests/reglas.test.mjs:59:3)
⚠  Script exited unsuccessfully (code 1)
```

Con la regla debilitada, `setDoc(..., { puntaje: 6 })` (línea 59 del test) **se aceptó** y
`assertFails` lo detectó: el test prueba de verdad el límite superior del rango. Solo falló ese test,
lo que confirma que cada caso cubre una regla distinta. Después se volvió a `puntaje <= 5` y la suite
quedó otra vez en 15/15.

### Índices: emulador vs. producción

El emulador de Firestore **no exige índices compuestos**: la consulta `where("puntaje", "==", 5)` +
`orderBy("creadaEn", "desc")` funciona en desarrollo aunque el índice no exista. En producción la
misma consulta falla con `FAILED_PRECONDITION` ("The query requires an index"). Los índices de un
solo campo se crean automáticamente, pero los que combinan igualdad sobre un campo y orden sobre
otro hay que declararlos. Por eso el índice vive en `firestore.indexes.json` y se despliega con
`firebase deploy --only firestore:indexes`: queda versionado, pasa por revisión en el PR y cualquier
entorno nuevo se puede reproducir sin clicks en la consola.

### Preguntas de reflexión

**1. ¿Por qué el id del documento es el UID? ¿Qué tendrías que agregar si usaras ids aleatorios con `addDoc`?**  
Porque convierte la regla de negocio "una reseña por persona y curso" en una propiedad de la
estructura. La ruta `cursos/{cursoId}/resenas/{uid}` solo admite un documento por usuario, así que
escribir de nuevo actualiza la misma reseña en lugar de duplicarla, sin consultas previas ni
condiciones de carrera. Además la regla de identidad queda trivial: `request.auth.uid == uid`
compara la ruta con el token.  
Con ids aleatorios habría que:
- guardar el autor en un campo (`autorUid`) y exigir en las reglas
  `request.resource.data.autorUid == request.auth.uid` al crear, y
  `resource.data.autorUid == request.auth.uid` (además de que no cambie) al editar y borrar;
- impedir duplicados, que las reglas no pueden hacer por sí solas porque no pueden consultar "¿ya
  existe otra reseña de este usuario?". Se necesitaría un documento índice (`cursos/{id}/autores/{uid}`)
  escrito en un `batch`, con una regla que use `existsAfter()`/`getAfter()`, o una Cloud Function o
  transacción del lado del servidor;
- en el cliente, buscar la reseña propia con `where("autorUid", "==", uid)` (otra consulta) para
  editarla.

**2. La reseña guarda una copia del nombre del autor. ¿Qué ganás y qué perdés? ¿Cómo resolverías el cambio de nombre?**  
*Gano:* mostrar la lista cuesta solo las lecturas de las reseñas (máximo 20). Sin la copia, habría
que leer además el perfil de cada autor: hasta 20 lecturas extra por visita, más latencia y más
código. En Firestore no hay JOINs: la desnormalización es la forma idiomática de modelar lecturas
frecuentes.  
*Pierdo:* consistencia. Si alguien cambia su nombre, sus reseñas viejas muestran el anterior, y el
dato vive en N lugares.  
*Cómo resolverlo:*
- Una **Cloud Function** que, ante un cambio de nombre (trigger sobre `usuarios/{uid}` o tras
  `updateProfile`), recorra las reseñas del usuario con una consulta de *collection group*
  (`collectionGroup("resenas")` filtrando por id de documento = uid) y las actualice en lotes
  (`BulkWriter`), con privilegios de admin. Es consistencia eventual, pero automática.
- Alternativa en el cliente: al cambiar el nombre, actualizar las propias reseñas con `merge`, ya que
  las reglas permiten editar `autor`. Es más frágil (si se cierra la pestaña queda a medias).
- O aceptarlo como decisión de producto: el nombre de la reseña es "como firmaste en ese momento".

**3. ¿Qué diferencia hay entre `resource.data` y `request.resource.data`? Ejemplo.**  
`resource.data` es el documento **tal como está guardado** antes de la operación (no existe en un
`create`). `request.resource.data` es el documento **como quedaría** si se permite la escritura. En un
`update` con `merge` incluye los campos que no se mandaron, tomados del documento actual. Comparar
los dos permite expresar invariantes entre el antes y el después. Ejemplo, la regla de edición:
```
allow update: if esDuenio(uid)
  && resenaValida()                                                  // el resultado es válido
  && request.resource.data.creadaEn == resource.data.creadaEn;       // la fecha no cambió
```
Otro ejemplo: limitar cuánto puede cambiar el puntaje por edición:
`(request.resource.data.puntaje - resource.data.puntaje) <= 2`.

**4. ¿Por qué la creación exige `creadaEn == request.time` en lugar de confiar en la fecha del cliente?**  
Porque todo lo que viene del cliente lo controla el usuario: el reloj del dispositivo puede estar mal
y, sobre todo, cualquiera puede llamar al SDK desde la consola con `creadaEn: new Date(2020,0,1)`
para que su reseña parezca antigua o aparezca siempre primera en la lista (que se ordena por fecha).
`request.time` es la hora del servidor en el momento de evaluar la regla, y `serverTimestamp()` se
resuelve justamente a ese valor. Exigir la igualdad obliga a usar `serverTimestamp()` y hace la
fecha inviolable. Es el mismo principio que `auth.uid` en SQL Connect: **los datos que importan para
la seguridad o la integridad los pone el servidor, no el cliente.**

**5. ¿Qué limitación tiene `getAggregateFromServer` y cómo afecta la experiencia? ¿Alternativas?**  
No admite listeners ni funciona offline: es una consulta puntual. El promedio y la cantidad no se
actualizan solos cuando otra persona publica, y el componente tiene que volver a pedirlos (acá, cuando
cambia la lista recibida por `onSnapshot`). Eso cuesta una lectura extra en cada cambio y puede mostrar
un resumen desfasado unos instantes respecto de la lista, o directamente desactualizado si la reseña
nueva no entra en las 20 últimas. Sin conexión no hay resumen.  
Alternativas:
- **Calcularlo en el cliente** a partir de las reseñas cargadas. Es gratis y en tiempo real, pero
  incorrecto si hay más de 20.
- **Mantener un resumen desnormalizado** en `cursos/{cursoId}` (`cantidad`, `suma`, `promedio`),
  actualizado por una **Cloud Function** en cada alta, edición o baja de reseña (o con transacciones y
  `increment()`). El cliente lo escucha con `onSnapshot` y obtiene un promedio en tiempo real a costo de
  una sola lectura. Es lo que se hará en la Práctica 5, y por eso las reglas ya prohíben al cliente
  escribir `cursos/{cursoId}`.
- Recalcular periódicamente (por ejemplo, una función programada) si no hace falta precisión inmediata.

**6. Para inscripciones con cupo máximo, ¿Firestore o SQL Connect?**  
**SQL Connect.** El cupo es una restricción de integridad sobre un *conjunto* de filas ("no más de N
matrículas para este curso"), y eso es justo lo que un motor relacional resuelve bien:
- En la clase 2, `Matricula` tiene clave compuesta `(alumnoId, cursoId)` y claves foráneas: PostgreSQL
  garantiza que no haya duplicados ni inscripciones a cursos o alumnos inexistentes. En Firestore no
  hay claves foráneas: `cursos/{id}/resenas` existe aunque el curso no exista.
- El cupo se puede validar en una `@transaction` que cuente las matrículas y aborte si se superó, con
  aislamiento transaccional del lado del servidor. Las reglas de Firestore **no pueden contar
  documentos** de una colección: habría que mantener un contador desnormalizado en el curso, actualizarlo
  en la misma transacción o `batch` que la inscripción y validar con `getAfter()` que
  `inscriptos <= cupo`. Es posible, pero frágil y con más superficie de error, y bajo mucha concurrencia
  sobre un mismo documento Firestore limita las escrituras sostenidas por documento.
- Las consultas típicas ("mis inscripciones con los datos del curso", "inscriptos por curso") son
  JOINs naturales en SQL. En Firestore obligan a duplicar datos o a hacer varias lecturas.

Firestore es la mejor opción para las reseñas: tiempo real nativo con `onSnapshot`, compensación de
latencia, cuota gratuita permanente y un modelo en el que "una reseña por persona" sale de la
estructura de la ruta. Para el cupo, la integridad pesa más que el tiempo real.
