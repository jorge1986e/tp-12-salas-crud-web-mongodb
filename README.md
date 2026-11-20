# Trabajo práctico 12 - Cambio parcial y eliminación de reservas

Reservas de salas de estudio (Express 5 + EJS) con persistencia en MongoDB Atlas mediante Mongoose. Sobre el TP 11, se agregan dos pantallas web:

- **Cambiar solamente el estado** (`/reservas/:id/estado`): usa `servicio.actualizar`, el mismo servicio que `PATCH /api/reservas/:id`.
- **Eliminar con confirmación** (`/reservas/:id/eliminar`): usa `servicio.eliminar`, el mismo servicio que `DELETE /api/reservas/:id`.

Ni los controladores llaman a la propia API por HTTP ni escriben operaciones de MongoDB: todo pasa por el servicio. La edición completa de siete campos (TP 11) sigue funcionando. No hay autenticación, sesiones, roles, borrado lógico ni filtros HTML.

## 1. Origen de la copia

Copia funcional del TP 11 terminado (`tp-11-salas-web-completa-mongodb`), renombrada `tp-12-salas-crud-web-mongodb`. No se copiaron historial Git, `node_modules` ni `.env` privado. Se conservaron fuentes, vistas, `public`, scripts, manifiesto, lockfile, herramientas, conexión y DNS autorizados. No se borró ninguna funcionalidad anterior (edición completa web, API con filtro, orden y páginas, PUT, PATCH y DELETE de la API, creación y lectura web).

## 2. Versiones

| Elemento | Versión |
| --- | --- |
| Node.js | >=22.13.0 (ver el tuyo con `node -v`) |
| express | ^5.2.1 |
| ejs | ^6.0.1 |
| express-ejs-layouts | ^2.5.1 |
| mongoose | ^9.11.4 |
| morgan | ^1.12.1 |
| eslint / prettier | ^10.12.0 / ^3.9.10 |

El proyecto usa módulos CommonJS. No se agregaron paquetes nuevos.

## 3. Instalación y arranque

1. Atlas Free (M0), base `reservas_salas_u12`, colección `reservas` (Mongoose la crea al guardar la primera reserva). Usuario con lectura y escritura sobre esa base y la IP permitida en _Network Access_.
2. Instalar y preparar el entorno:

```
npm ci
cp .env.example .env
```

3. En `.env` reemplazar `USUARIO`, `CLAVE` y `HOST` por los datos reales de Atlas y conservar la base `reservas_salas_u12` y `?retryWrites=true&w=majority`. **El `.env` no se entrega** (está en `.gitignore`). Variables: `PORT`, `NODE_ENV` y `MONGODB_URI`.
4. Verificar antes de iniciar:

```
npm run check
node --env-file=.env scripts/comprobar-conexion.js
npm run start:local        # node --env-file=.env src/index.js
```

**DNS.** En `src/config/base-datos.js` se conserva la configuración autorizada de la unidad 7: `dns.setServers(["8.8.8.8", "1.1.1.1"])`, una sola vez. No cambia el DNS del sistema ni la autenticación.

El arranque espera la conexión a MongoDB y recién entonces escucha el puerto. No se insertan datos al iniciar ni se borra la entrega anterior.

Otros comandos: `npm run crear` y `npm run listar` (terminal), `npm run format` y `npm run check`.

## 4. Estructura

```
src/
├── index.js                  # arranque: entorno -> conexión -> listen -> cierre ordenado
├── app.js                    # Express, middleware, routers, 404 y errores
├── config/                   # entorno.js, base-datos.js
├── modelos/reserva.js        # esquema Mongoose
├── servicios/reservas-mongo.js   # listar, contar, obtenerPorId, crear, reemplazar,
│                                 # actualizar, eliminar y consultar (sin cambios)
├── controladores/reservas.js     # NUEVO: mostrarEstadoReserva, guardarEstadoReserva,
│                                 # mostrarConfirmacionEliminar y eliminarReserva
├── rutas/reservas.js             # NUEVO: GET/POST /reservas/:id/estado y /eliminar
├── middleware/cambios-reservas.js # NUEVO: validarFormularioEstado y confirmacionEliminacionValida
├── middleware/errores.js         # NUEVO: vuelve a "estado" si Mongoose rechaza el guardado
views/reservas/estado.ejs         # NUEVO: select con el estado actual
views/reservas/eliminar.ejs       # NUEVO: confirmación de eliminación
views/reservas/detalle.ejs       # acciones: Editar reserva, Cambiar estado, Eliminar reserva
scripts/, views/, public/
```

No se agregó otra estructura de carpetas, ni una validación genérica de parches, ni dependencias nuevas. Se sigue el patrón de las clases: `consultar` en el servicio y `listarApi` en el controlador. `listar` se conserva para el HTML y `contar` para `/estado`.

## 5. Cambio de estado y eliminación web (TP 12)

### Rutas

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/reservas/:id/estado` | Select con el estado actual (200) |
| POST | `/reservas/:id/estado` | Cambia solo `estado` con `servicio.actualizar` y responde **303** a `/reservas/:id` |
| GET | `/reservas/:id/eliminar` | Pantalla de confirmación (200). Solo lee: no elimina |
| POST | `/reservas/:id/eliminar` | Elimina con `servicio.eliminar` y responde **303** a `/reservas` |

### Campos admitidos

- **Estado (web):** un único campo de texto `estado` con `pendiente` o `confirmada`. Se rechazan (400 HTML) vacío, valores inventados, campos extra (por ejemplo `personas=5`), `estado` repetido y cuerpo vacío.
- **Eliminar (web):** solamente `confirmar=si`. Ausente, distinto de `si`, repetido o con campos extra: 400 HTML y el documento queda intacto.

Los seis campos `estudiante`, `email`, `sala`, `fecha`, `turno`, `personas` y el ID se conservan al cambiar el estado: se llama a `actualizar(id, { estado })`, nunca a `reemplazar` ni se envían campos vacíos.

**Destino del 303 del estado:** el detalle `/reservas/:id`. **Destino del 303 de eliminar:** el listado `/reservas` (no el detalle, que ya no existe).

**Cancelar** (en ambas pantallas) es un enlace de lectura al detalle: no escribe nada.

### Errores

| Caso | Respuesta |
| --- | --- |
| ID con formato inválido (GET o POST) | 400 HTML |
| ID válido que no existe (GET o POST), incluso al repetir una eliminación | 404 HTML |
| Estado inválido, vacío, extra o repetido | 400, vista `estado` con explicación, id y valor recibido; documento intacto |
| Mongoose rechaza el guardado del estado | El manejador general vuelve a `estado` (400) con `res.locals.cambioEstado`, antes de la rama de creación |
| Eliminar sin `confirmar=si` | 400 y no se elimina |
| Reserva eliminada mientras el formulario estaba abierto | 404; no se recrea (`upsert: false` y `deleteOne`) |

### Diferencia entre POST web y PATCH/DELETE de la API

| | Web | API |
| --- | --- | --- |
| Cambiar estado | `POST /reservas/:id/estado` (formulario `x-www-form-urlencoded`, solo `estado`) | `PATCH /api/reservas/:id` (JSON, `personas` y/o `estado`) |
| Eliminar | `POST /reservas/:id/eliminar` (`confirmar=si`) | `DELETE /api/reservas/:id` (sin cuerpo) |
| Éxito | 303 con `Location` (a `/reservas/:id` o `/reservas`) | 200 con JSON / 204 sin cuerpo |
| Error | HTML: 400 y 404 | JSON: 400 y 404 |

Los navegadores solo envían GET y POST en formularios, por eso la web usa POST. La API no se redefine: PATCH mantiene `personas` y `estado` (personas entero de 1 a 6). El `confirmar=si` oculto evita errores accidentales, pero **no autentica ni protege contra CSRF**; no se implementa autenticación en este TP.

## 5 bis. Edición web por reemplazo completo (TP 11, se mantiene)

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/reservas/:id/editar` | Formulario con los siete campos precargados (200) |
| POST | `/reservas/:id/editar` | Reemplaza el documento y responde **303** a `/reservas/:id` |
| PUT (API) | `/api/reservas/:id` | Mismo `servicio.reemplazar`; 200 JSON |

**Campos editables (siete):** `estudiante`, `email`, `sala`, `fecha`, `turno`, `personas`, `estado`. El `id` se toma solo de la ruta; no es un campo del formulario.

**Reglas:** textos obligatorios; email con `@`; sala entre las tres opciones; turno `Mañana`/`Tarde`/`Noche`; `personas` entero de 1 a 6 (se comprueba que no esté vacío antes de `Number`, y luego finitud, entero y rango); `estado` `pendiente` o `confirmada`. Se rechazan campos extra, `_id` y operadores. El formulario siempre envía los siete campos; los omitidos no se completan con los valores anteriores.

**Destino del 303:** el detalle `/reservas/:id` (las acciones se ofrecen desde el detalle; el listado solo tiene "Ver detalle").

**Errores:**

| Caso | Respuesta |
| --- | --- |
| ID con formato inválido (GET o POST) | 400 HTML |
| ID válido que no existe | 404 HTML |
| Entrada inválida | 400, vista `editar` con explicación, id y textos recibidos; no redirige y el documento queda intacto |
| Mongoose rechaza el guardado | El manejador general vuelve a `editar` (400) usando `res.locals.edicion`, antes de la rama de creación |
| Error inesperado | 500 con mensaje seguro; la API sigue respondiendo JSON |

La vista compartida `no-encontrado` muestra el código real (400, 404 o 500) y no afirma siempre 404.

**Cancelar** es un enlace al detalle: no envía el formulario y no escribe nada.

## 6. Contrato de `GET /api/reservas` (heredado del TP 10)

### Parámetros (todos opcionales)

| Parámetro | Valores | Predeterminado |
| --- | --- | --- |
| `sala` | Texto no vacío; igualdad exacta luego de `trim` (no es búsqueda por fragmentos) | sin filtro |
| `orden` | `estudiante`, `personas-asc`, `personas-desc` | `estudiante` |
| `pagina` | Entero de 1 a 1000 | `1` |
| `limite` | Entero de 1 a 20 | `2` |

Cualquier otro parámetro (por ejemplo `select`), un parámetro repetido, un valor vacío, no entero o fuera de rango responde **400** JSON sin escribir datos. El cliente no puede elegir campos ni operadores: `select`, `sort` y `skip` los arma el servidor.

### Orden de resolución

1. **Filtro:** `filtro = {}` y, si llegó `sala`, `filtro.sala = sala.trim()`.
2. **Orden:** el servicio traduce la opción a un objeto de sort con una lista cerrada y agrega `_id` ascendente para desempatar:
   `estudiante → { estudiante: 1, _id: 1 }`, `personas-asc → { personas: 1, _id: 1 }`, `personas-desc → { personas: -1, _id: 1 }`.
3. **Páginas:** el controlador exige un único texto por parámetro, convierte con `Number` y comprueba `Number.isInteger` y los rangos. El servicio calcula `salto = (pagina - 1) * limite`, cuenta con `countDocuments(filtro)` y busca con ese mismo filtro encadenando `sort`, `skip`, `limit` y `lean`.
4. **Campos:** `select("estudiante email sala fecha turno personas estado")`. Se conserva `_id` solo para construir `id`; no se expone `_id` ni `__v`.

### Respuesta exitosa (200)

```json
{
  "datos": [
    {
      "id": "…",
      "estudiante": "Ana Ejemplo",
      "email": "ana@example.com",
      "sala": "Sala Norte",
      "fecha": "2026-10-28",
      "turno": "Mañana",
      "personas": 2,
      "estado": "pendiente"
    }
  ],
  "pagina": 1,
  "limite": 2,
  "total": 4,
  "paginas": 2
}
```

`total` cuenta todas las coincidencias y `paginas` es `Math.ceil(total / limite)`. Una página fuera de resultados responde **200** con `datos` vacío; no se ajusta a la última ni da 404. Sin coincidencias: `datos: []`, `total: 0`, `paginas: 0`.

`GET /api/reservas/:id` no cambia. El HTML conserva su arreglo (`listar`) y `/estado` el total global (`contar`).

## 7. Datos de ejercicio

Si la base está vacía, crear desde el formulario `/reservas/nueva` (estado inicial `pendiente`): Ana Ejemplo (`ana@example.com`, Sala Norte, 2026-11-11, Mañana, 2 personas) y Bruno Ejemplo (`bruno@example.com`, Sala Sur, 2026-11-11, Tarde, 3 personas). La fecha es ilustrativa. Guardar `ID_ANA` e `ID_BRUNO` (Bruno se destina a las pruebas de eliminación web) y no duplicar si ya existen. Para probar `DELETE` de la API por separado, crear un tercer registro ficticio (`ID_DESCARTABLE`) y confirmarlo con GET antes de borrarlo. No vaciar la base.

Para las pruebas de consulta heredadas (sección 8) se usan además los datos del TP 10, que se cargan por `POST /api/reservas`.

Con la base vacía, enviar seis `POST /api/reservas` separados (Body > raw > JSON, `Content-Type: application/json`). El primero:

```json
{
  "estudiante": "Ana Ejemplo",
  "email": "ana@example.com",
  "sala": "Sala Norte",
  "fecha": "2026-10-28",
  "turno": "Mañana",
  "personas": 2
}
```

Esperar 201, copiar el `id` y revisar `Location`; el estado queda `pendiente` (no se envía). Las otras cinco, con la misma fecha y turno:

| estudiante | email | sala | personas |
| --- | --- | --- | --- |
| Bruno Ejemplo | bruno@example.com | Sala Norte | 1 |
| Carla Ejemplo | carla@example.com | Sala Norte | 2 |
| Diego Ejemplo | diego@example.com | Sala Norte | 3 |
| Elena Ejemplo | elena@example.com | Sala Sur | 1 |
| Fabian Ejemplo | fabian@example.com | Sala Multimedia | 4 |

Guardar los seis `id` y comprobar cada `GET /api/reservas/:id`. Si los datos ya existen, no repetir los `POST`. Todos los datos son ficticios.

## 8. Pruebas heredadas del TP 10 en Postman


| Caso | Resultado esperado |
| --- | --- |
| Sin Params activos | 200, 2 reservas, `pagina` 1, `limite` 2, `total` 6, `paginas` 3 |
| `sala=Sala Norte` (sin paginar) | 200, 2 reservas, `total` 4 |
| `sala=Sala Norte`, `pagina=3`, `limite=2` | 200, `datos` vacío, `total` 4, `paginas` 2 |
| `sala=Sala Inexistente` | 200, `datos` vacío, `total` 0, `paginas` 0 |
| `pagina=0` o `pagina=1.5` | 400 |
| `limite=21` | 400 |
| `pagina` o `limite` repetidos | 400 |
| `sala` vacía o repetida | 400 |
| `orden=otro` o `select=email` | 400 |

Con las cantidades verificadas, probar `POST`, `PUT`, `PATCH` y `DELETE` heredados del TP 09 sobre datos de ejercicio. Si una escritura cambia la cantidad, registrar el nuevo total (ya no son seis). El formulario de alta conserva la redirección 302 al crear y el 400 con valores conservados al fallar. Los rechazos de consulta no escriben datos.

**Persistencia.** Reiniciar el servidor (Ctrl+C y `npm run start:local`) y comprobar que el mismo `id` responde 200 y que el total no se duplicó.

**Evidencia.** Los resultados observados se contrastan con los datos guardados en Atlas. Las capturas se adjuntan en la entrega, sin la URI privada ni datos personales reales.

## 9. Pruebas de la edición (navegador y Postman)

Reemplazar `ID_REAL` por un ID de la base. Todos los datos son ficticios.

| Caso | Pasos | Resultado esperado |
| --- | --- | --- |
| Abrir edición | Navegador: `/reservas/ID_REAL/editar` | Siete campos precargados |
| Guardar desde la web | Cambiar personas a 4 y estado a confirmada; Guardar | 303 y luego GET del detalle; `GET http://localhost:3000/api/reservas/ID_REAL` (Body none, Params vacío) devuelve el mismo ID, personas 4 y estado confirmada |
| Cancelar | Cambiar campos y pulsar Cancelar | Vuelve al detalle; el documento no cambia |
| Formulario inválido | Postman `POST http://localhost:3000/reservas/ID_REAL/editar`, Body > x-www-form-urlencoded con las siete filas, `personas=0` y los demás valores válidos | HTML 400, vista de edición con valores conservados; GET API conserva el último reemplazo válido |
| Reintento válido | Corregir `personas` y reenviar (Settings: desactivar _Automatically follow redirects_) | 303; abrir el `Location` |
| PUT completo | Postman `PUT http://localhost:3000/api/reservas/ID_REAL`, Body > raw > JSON con los siete campos (ver sección 12) | 200 JSON, mismo ID; la edición web muestra esos valores |
| PUT incompleto | Duplicar el PUT y omitir `estado` | 400; GET confirma que el documento está intacto |
| ID inválido | `/reservas/abc/editar` | HTML 400 |
| ID válido ausente | `/reservas/000000000000000000000000/editar` | HTML 404 (no se elimina nada) |
| Reiniciar | Ctrl+C y `npm run start:local`; leer el mismo ID | El último reemplazo válido persiste, sin repetir altas |
| Funcionalidades previas | Crear desde `/reservas/nueva`, listar, detalle, consultas API | Siguen funcionando |

## 9 bis. Pruebas del TP 12 (navegador y Postman)

Servidor iniciado (`npm run start:local`). Crear la colección **TP 12 - Reservas**. En los POST web, desactivar _Automatically follow redirects_ (Settings de la solicitud) para ver el 303 y su `Location`; luego abrirlo con GET. Params vacío. Todos los datos son ficticios.

**Cambio parcial por la API**

| Paso | Solicitud | Resultado esperado |
| --- | --- | --- |
| 1 | `GET http://localhost:3000/api/reservas/ID_ANA` (Body none) | 200. Guardar el JSON "antes" |
| 2 | `PATCH` a la misma URL, Body > raw > JSON (`Content-Type: application/json`): `{ "estado": "confirmada" }` | 200, mismo ID |
| 3 | GET de nuevo y abrir `/reservas/ID_ANA` en el navegador | Estado nuevo y los otros seis campos intactos |
| 4 | PATCH con `{}` y con `{"estado":"inventado"}` | 400 en ambos; GET confirma que no cambió nada |

**Cambio parcial por la web**

| Paso | Solicitud | Resultado esperado |
| --- | --- | --- |
| 1 | `POST http://localhost:3000/reservas/ID_ANA/estado`, Body > x-www-form-urlencoded, una fila `estado=pendiente` (quitar un `Content-Type` JSON manual de otras solicitudes) | 303 |
| 2 | `GET /api/reservas/ID_ANA` | Estado cambiado y seis campos conservados |
| 3 | `estado=inventado` | 400 HTML de la pantalla de estado, con el mismo ID y explicación |
| 4 | Cuerpo vacío; `estado=confirmada` + `personas=5`; `estado` duplicado (dos filas) | 400 en cada caso; GET API confirma documento intacto |

**Cancelar, confirmar y eliminar**

| Paso | Solicitud | Resultado esperado |
| --- | --- | --- |
| 1 | Navegador: `/reservas/ID_ANA/estado`, elegir otro estado y pulsar Cancelar | Vuelve al detalle; no se guarda |
| 2 | `GET /reservas/ID_BRUNO/eliminar` (Body none) y luego `GET /api/reservas/ID_BRUNO` | 200 y 200: el GET no borra |
| 3 | Navegador: Cancelar y recargar | La reserva sigue existiendo |
| 4 | `POST /reservas/ID_BRUNO/eliminar` sin filas; `confirmar=no`; `confirmar=si` + otra fila | 400 en los tres; GET API sigue 200 |
| 5 | `POST` con una fila `confirmar=si`; luego `GET /api/reservas/ID_BRUNO`; repetir el POST | 303 a `/reservas`; 404; 404. Ana sigue existiendo |
| 6 | `DELETE http://localhost:3000/api/reservas/ID_DESCARTABLE` (Body none) y repetirlo | 204 sin cuerpo; 404 |
| 7 | `GET /reservas/abc/estado`; ID válido ausente (`000000000000000000000000`); abrir una pantalla, borrar ese registro de prueba por la API y enviarla | 400; 404; 404 sin recrearlo |
| 8 | Ctrl+C, `npm run start:local` con la misma base | El cambio de Ana persiste y los borrados siguen ausentes. Repetir alta, listado, edición completa (PUT/web) y consultas API |

**Evidencias** (en la entrega, sin la URI privada ni secretos): JSON antes y después del mismo ID; seis campos conservados; 400 con documento intacto; cancelar sin escritura; GET de confirmación sin borrado; POST 303 y GET posterior 404; DELETE API 204; reinicio y edición completa todavía operativa.

## 10. Decisión de diseño: salas y reservas

Si incorporáramos información de las salas, **describirían a una sala** sus datos propios y estables: nombre, capacidad máxima, ubicación o piso, equipamiento (proyector, pizarra) y si está habilitada. **Describirían a una reserva** los datos de cada uso concreto: quién reserva (`estudiante`, `email`), `fecha`, `turno`, `personas` y `estado`.

Tendría sentido considerar una **referencia** (la reserva guarda el `_id` de la sala) porque los datos de la sala se comparten entre muchas reservas y cambian poco: se corrigen en un solo lugar, no se repiten y no quedan versiones contradictorias; además, la sala existe aunque no tenga reservas. Los datos **embebidos** (copiar el nombre y la capacidad dentro de cada reserva) serían útiles si quisiéramos conservar cómo era la sala al momento de reservar y leer todo con una sola consulta, a costa de duplicar y actualizar muchas copias. Hoy la sala es solo el texto `sala` validado por un enum. Es una evaluación conceptual: no se implementa otro modelo ni `populate`.

## 11. Calidad y seguridad

```
npm run format
npm run check
```

`format` y `check` se ejecutan sobre `src` y `scripts`. No se entregan `.env`, URI, `node_modules` ni datos personales reales. Los diagnósticos no imprimen la URI ni la clave. No hay autenticación, búsqueda aproximada, operadores libres, orden dinámico ni paginación en el HTML.

## 12. Ejemplo de PUT completo

```json
{
  "estudiante": "Ana Ejemplo",
  "email": "ana@example.com",
  "sala": "Sala Norte",
  "fecha": "2026-11-04",
  "turno": "Mañana",
  "personas": 3,
  "estado": "pendiente"
}
```

Content-Type `application/json`. Esperar 200 con el mismo ID. En el sitio HTML no hay filtros, orden ni paginación.
