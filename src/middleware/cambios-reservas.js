// Validación de PUT y PATCH en la API. Solo responde 400 JSON o deja el
// resultado en req.cambiosValidos; no toca la base de datos.
const { esObjetoPlano, leerTexto } = require("./reservas");

const camposPut = [
  "estudiante",
  "email",
  "sala",
  "fecha",
  "turno",
  "personas",
  "estado",
];
const camposPatch = ["personas", "estado"];
const estadosPermitidos = ["pendiente", "confirmada"];

function rechazar(res, errores) {
  return res.status(400).json({
    error: "Los datos de la reserva no son válidos.",
    detalles: errores,
  });
}

// Personas llega como número o como texto numérico no vacío. Después se
// comprueban finitud, entero y rango. Booleanos, null, arreglos y objetos
// no son números.
function leerPersonas(valor) {
  if (typeof valor === "number") {
    return valor;
  }

  if (typeof valor === "string" && valor.trim() !== "") {
    return Number(valor.trim());
  }

  return NaN;
}

function personasValidas(personas) {
  return (
    Number.isFinite(personas) &&
    Number.isInteger(personas) &&
    personas >= 1 &&
    personas <= 6
  );
}

// Cuerpo ausente, arreglo o texto plano: req.body no es un objeto.
// Campos desconocidos, _id u operadores ($set, $inc...): no están en la lista.
function validarCuerpo(cuerpo, camposAdmitidos) {
  if (!esObjetoPlano(cuerpo)) {
    return ["Falta el cuerpo de la solicitud o no es un objeto JSON."];
  }

  return Object.keys(cuerpo)
    .filter((campo) => !camposAdmitidos.includes(campo))
    .map((campo) => `El campo ${campo} no se puede enviar en esta solicitud.`);
}

function validarEstado(estado) {
  return estadosPermitidos.includes(estado);
}

// PUT: exige los siete campos editables. No completa faltantes con defaults.
function crearValidadorReemplazo(servicioReservas) {
  return function validarReemplazo(req, res, next) {
    const { salasPermitidas, turnosPermitidos } =
      servicioReservas.obtenerOpciones();

    const errores = validarCuerpo(req.body, camposPut);

    if (errores.length > 0) {
      return rechazar(res, errores);
    }

    const cuerpo = req.body;

    for (const campo of camposPut) {
      if (!Object.hasOwn(cuerpo, campo)) {
        errores.push(`Falta el campo ${campo}.`);
      }
    }

    if (errores.length > 0) {
      return rechazar(res, errores);
    }

    const datos = {
      estudiante: leerTexto(cuerpo.estudiante),
      email: leerTexto(cuerpo.email),
      sala: leerTexto(cuerpo.sala),
      fecha: leerTexto(cuerpo.fecha),
      turno: leerTexto(cuerpo.turno),
      personas: leerPersonas(cuerpo.personas),
      estado: cuerpo.estado,
    };

    if (!datos.estudiante) {
      errores.push("El nombre del estudiante es obligatorio.");
    }

    if (!datos.email) {
      errores.push("El email es obligatorio.");
    } else if (!datos.email.includes("@")) {
      errores.push("El email debe contener un @.");
    }

    if (!salasPermitidas.includes(datos.sala)) {
      errores.push("Elegí una de las salas disponibles.");
    }

    if (!datos.fecha) {
      errores.push("La fecha es obligatoria.");
    }

    if (!turnosPermitidos.includes(datos.turno)) {
      errores.push("Elegí uno de los turnos disponibles.");
    }

    if (!personasValidas(datos.personas)) {
      errores.push(
        "La cantidad de personas debe ser un número entero entre 1 y 6.",
      );
    }

    if (!validarEstado(datos.estado)) {
      errores.push("El estado debe ser pendiente o confirmada.");
    }

    if (errores.length > 0) {
      return rechazar(res, errores);
    }

    req.cambiosValidos = datos;
    return next();
  };
}

// PATCH: solo personas y estado, con al menos uno presente.
function validarActualizacion(req, res, next) {
  const errores = validarCuerpo(req.body, camposPatch);

  if (errores.length > 0) {
    return rechazar(res, errores);
  }

  const cuerpo = req.body;
  const cambios = {};

  if (!camposPatch.some((campo) => Object.hasOwn(cuerpo, campo))) {
    return rechazar(res, ["Enviá personas, estado o ambos."]);
  }

  if (Object.hasOwn(cuerpo, "personas")) {
    const personas = leerPersonas(cuerpo.personas);

    if (personasValidas(personas)) {
      cambios.personas = personas;
    } else {
      errores.push(
        "La cantidad de personas debe ser un número entero entre 1 y 6.",
      );
    }
  }

  if (Object.hasOwn(cuerpo, "estado")) {
    if (validarEstado(cuerpo.estado)) {
      cambios.estado = cuerpo.estado;
    } else {
      errores.push("El estado debe ser pendiente o confirmada.");
    }
  }

  if (errores.length > 0) {
    return rechazar(res, errores);
  }

  req.cambiosValidos = cambios;
  return next();
}

const camposFormularioEdicion = camposPut;

// Edición web (formulario): los valores llegan como texto. Devuelve los datos
// limpios para el servicio, los textos recibidos para volver a mostrarlos y
// la lista de errores. No toca la base de datos ni conoce req/res.
function validarFormularioEdicion(
  cuerpo,
  { salasPermitidas, turnosPermitidos },
) {
  const errores = [];
  const recibido = esObjetoPlano(cuerpo) ? cuerpo : {};

  if (!esObjetoPlano(cuerpo)) {
    errores.push(
      "Falta el cuerpo de la solicitud o no tiene un formato válido.",
    );
  }

  // Campos extra, _id u operadores: se rechazan.
  for (const campo of Object.keys(recibido)) {
    if (!camposFormularioEdicion.includes(campo)) {
      errores.push(`El campo ${campo} no se puede enviar en esta solicitud.`);
    }
  }

  // Los siete campos deben llegar: reemplazar no completa faltantes.
  for (const campo of camposFormularioEdicion) {
    if (typeof recibido[campo] !== "string") {
      errores.push(`Falta el campo ${campo}.`);
    }
  }

  // Textos recibidos, para volver a mostrar el formulario tal como se envió.
  const valores = {};
  for (const campo of camposFormularioEdicion) {
    valores[campo] = typeof recibido[campo] === "string" ? recibido[campo] : "";
  }

  const datos = {
    estudiante: leerTexto(recibido.estudiante),
    email: leerTexto(recibido.email),
    sala: leerTexto(recibido.sala),
    fecha: leerTexto(recibido.fecha),
    turno: leerTexto(recibido.turno),
    personas: leerPersonas(recibido.personas),
    estado: leerTexto(recibido.estado),
  };

  if (!datos.estudiante) {
    errores.push("El nombre del estudiante es obligatorio.");
  }

  if (!datos.email) {
    errores.push("El email es obligatorio.");
  } else if (!datos.email.includes("@")) {
    errores.push("El email debe contener un @.");
  }

  if (!salasPermitidas.includes(datos.sala)) {
    errores.push("Elegí una de las salas disponibles.");
  }

  if (!datos.fecha) {
    errores.push("La fecha es obligatoria.");
  }

  if (!turnosPermitidos.includes(datos.turno)) {
    errores.push("Elegí uno de los turnos disponibles.");
  }

  if (!personasValidas(datos.personas)) {
    errores.push(
      "La cantidad de personas debe ser un número entero entre 1 y 6.",
    );
  }

  if (!validarEstado(datos.estado)) {
    errores.push("El estado debe ser pendiente o confirmada.");
  }

  return { datos, valores, errores };
}

// Cambio de estado web: el formulario envía un único campo de texto "estado".
// Se rechazan vacío, valores inventados, campos extra y campos repetidos
// (con urlencoded un campo repetido llega como arreglo, no como texto).
function validarFormularioEstado(cuerpo) {
  const errores = [];
  const recibido = esObjetoPlano(cuerpo) ? cuerpo : {};

  for (const campo of Object.keys(recibido)) {
    if (campo !== "estado") {
      errores.push(`El campo ${campo} no se puede enviar en esta solicitud.`);
    }
  }

  const estado = recibido.estado;

  if (Array.isArray(estado)) {
    errores.push("El campo estado debe enviarse una sola vez.");
  } else if (typeof estado !== "string" || estado === "") {
    errores.push("Elegí un estado.");
  } else if (!validarEstado(estado)) {
    errores.push("El estado debe ser pendiente o confirmada.");
  }

  // Textos recibidos, para volver a mostrar el formulario tal como se envió.
  const valores = { estado: typeof estado === "string" ? estado : "" };

  return { datos: { estado }, valores, errores };
}

// Eliminación web: solo vale confirmar=si, sin campos extra ni repetidos.
function confirmacionEliminacionValida(cuerpo) {
  if (!esObjetoPlano(cuerpo)) {
    return false;
  }

  const campos = Object.keys(cuerpo);

  return (
    campos.length === 1 &&
    campos[0] === "confirmar" &&
    cuerpo.confirmar === "si"
  );
}

module.exports = {
  crearValidadorReemplazo,
  validarActualizacion,
  validarFormularioEdicion,
  validarFormularioEstado,
  confirmacionEliminacionValida,
};
