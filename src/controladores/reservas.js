// Lee parámetros, llama al servicio y responde (render, JSON, 404, redirect).
// Express 5 captura los errores de funciones async y los envía al middleware de errores.
const {
  validarFormularioEdicion,
  validarFormularioEstado,
  confirmacionEliminacionValida,
} = require("../middleware/cambios-reservas");

function crearControladorReservas(servicioReservas) {
  function mostrarInicio(req, res) {
    res.render("inicio", { titulo: "Salas de estudio" });
  }

  async function mostrarEstado(req, res) {
    const cantidad = await servicioReservas.contar();

    res.json({
      servicio: "activo",
      reservas: cantidad,
      solicitudId: res.locals.solicitudId,
    });
  }

  // ---------- Sitio HTML ----------

  async function listarReservas(req, res) {
    const reservas = await servicioReservas.listar();

    res.render("reservas/lista", {
      titulo: "Reservas",
      reservas,
    });
  }

  function mostrarNuevaReserva(req, res) {
    const { salasPermitidas, turnosPermitidos } =
      servicioReservas.obtenerOpciones();

    res.render("reservas/nueva", {
      titulo: "Nueva reserva",
      salasPermitidas,
      turnosPermitidos,
      valores: {},
      errores: [],
    });
  }

  async function mostrarDetalleReserva(req, res) {
    // El id llega como texto: no se convierte con Number.
    const reserva = await servicioReservas.obtenerPorId(req.params.id);

    if (!reserva) {
      return res.status(404).render("no-encontrado", {
        titulo: "Reserva no encontrada",
        mensaje: "La reserva solicitada no existe.",
      });
    }

    return res.render("reservas/detalle", {
      titulo: "Detalle de reserva",
      reserva,
    });
  }

  // Contexto común de la vista de edición (siempre con el id de la ruta).
  function datosVistaEdicion(id, valores, errores) {
    const { salasPermitidas, turnosPermitidos } =
      servicioReservas.obtenerOpciones();

    return {
      titulo: "Editar reserva",
      id,
      valores,
      salasPermitidas,
      turnosPermitidos,
      errores,
    };
  }

  // GET /reservas/:id/editar: precarga los siete campos editables.
  // ID inválido -> el servicio lanza ID_INVALIDO (400 HTML en el manejador).
  async function mostrarEditarReserva(req, res) {
    const reserva = await servicioReservas.obtenerPorId(req.params.id);

    if (!reserva) {
      return res.status(404).render("no-encontrado", {
        titulo: "Reserva no encontrada",
        mensaje: "La reserva solicitada no existe.",
      });
    }

    const valores = {
      estudiante: reserva.estudiante,
      email: reserva.email,
      sala: reserva.sala,
      fecha: reserva.fecha,
      turno: reserva.turno,
      personas: String(reserva.personas),
      estado: reserva.estado,
    };

    return res.render(
      "reservas/editar",
      datosVistaEdicion(reserva.id, valores, []),
    );
  }

  // POST /reservas/:id/editar: reemplazo completo con servicio.reemplazar.
  async function guardarEdicionReserva(req, res) {
    // El id sale de la ruta; nunca del cuerpo.
    const id = req.params.id;
    const { datos, valores, errores } = validarFormularioEdicion(
      req.body,
      servicioReservas.obtenerOpciones(),
    );

    if (errores.length > 0) {
      return res
        .status(400)
        .render("reservas/editar", datosVistaEdicion(id, valores, errores));
    }

    // Contexto por si Mongoose rechaza el guardado: el manejador general
    // vuelve a mostrar esta misma vista con los textos recibidos.
    res.locals.edicion = datosVistaEdicion(id, valores, []);

    const reserva = await servicioReservas.reemplazar(id, datos);

    if (!reserva) {
      return res.status(404).render("no-encontrado", {
        titulo: "Reserva no encontrada",
        mensaje: "La reserva solicitada no existe.",
      });
    }

    // 303 See Other: el navegador pide el detalle con GET.
    return res.redirect(303, `/reservas/${reserva.id}`);
  }

  // Contexto común de la vista de cambio de estado (siempre con el id de la ruta).
  function datosVistaEstado(id, valores, errores) {
    return {
      titulo: "Cambiar estado de la reserva",
      id,
      valores,
      errores,
    };
  }

  // GET /reservas/:id/estado: muestra el estado actual en un select.
  // ID inválido -> el servicio lanza ID_INVALIDO (400 HTML en el manejador).
  async function mostrarEstadoReserva(req, res) {
    const reserva = await servicioReservas.obtenerPorId(req.params.id);

    if (!reserva) {
      return res.status(404).render("no-encontrado", {
        titulo: "Reserva no encontrada",
        mensaje: "La reserva solicitada no existe.",
      });
    }

    return res.render(
      "reservas/estado",
      datosVistaEstado(reserva.id, { estado: reserva.estado }, []),
    );
  }

  // POST /reservas/:id/estado: cambia solo el estado con servicio.actualizar.
  // No usa reemplazar: los otros seis campos y el id no se tocan.
  async function guardarEstadoReserva(req, res) {
    const id = req.params.id;
    const { datos, valores, errores } = validarFormularioEstado(req.body);

    if (errores.length > 0) {
      return res
        .status(400)
        .render("reservas/estado", datosVistaEstado(id, valores, errores));
    }

    // Contexto por si Mongoose rechaza el guardado: el manejador general
    // vuelve a mostrar esta misma vista con el texto recibido.
    res.locals.cambioEstado = datosVistaEstado(id, valores, []);

    const reserva = await servicioReservas.actualizar(id, datos);

    if (!reserva) {
      return res.status(404).render("no-encontrado", {
        titulo: "Reserva no encontrada",
        mensaje: "La reserva solicitada no existe.",
      });
    }

    // 303 See Other: el navegador pide el detalle con GET.
    return res.redirect(303, `/reservas/${reserva.id}`);
  }

  // GET /reservas/:id/eliminar: solo lee y pide confirmación. No borra nada.
  async function mostrarConfirmacionEliminar(req, res) {
    const reserva = await servicioReservas.obtenerPorId(req.params.id);

    if (!reserva) {
      return res.status(404).render("no-encontrado", {
        titulo: "Reserva no encontrada",
        mensaje: "La reserva solicitada no existe.",
      });
    }

    return res.render("reservas/eliminar", {
      titulo: "Eliminar reserva",
      reserva,
    });
  }

  // POST /reservas/:id/eliminar: exige solamente confirmar=si.
  async function eliminarReserva(req, res) {
    if (!confirmacionEliminacionValida(req.body)) {
      return res.status(400).render("no-encontrado", {
        titulo: "Solicitud inválida",
        mensaje:
          "Para eliminar la reserva hay que confirmar desde la pantalla de confirmación. No se eliminó nada.",
        codigo: 400,
      });
    }

    // Mismo servicio que DELETE /api/reservas/:id.
    const eliminada = await servicioReservas.eliminar(req.params.id);

    if (!eliminada) {
      return res.status(404).render("no-encontrado", {
        titulo: "Reserva no encontrada",
        mensaje: "La reserva no existe (quizás ya se eliminó).",
      });
    }

    // 303 al listado: el detalle de la reserva eliminada ya no existe.
    return res.redirect(303, "/reservas");
  }

  async function crearReserva(req, res) {
    // Se espera la escritura antes de redirigir.
    await servicioReservas.crear(req.reservaValidada);
    res.redirect("/reservas");
  }

  // ---------- API JSON ----------
  //
  async function listarApi(req, res) {
    const permitidos = ["sala", "orden", "pagina", "limite"];

    for (const campo of Object.keys(req.query)) {
      if (!permitidos.includes(campo)) {
        return res.status(400).json({ error: "Parámetro no permitido." });
      }
    }

    const sala = req.query.sala;

    // Si "sala" aparece repetido en la URL, Express puede
    // representarlo como un arreglo. No se acepta ese formato.
    if (sala !== undefined) {
      if (Array.isArray(sala)) {
        return res.status(400).json({
          error: "El parámetro 'sala' debe aparecer una sola vez.",
        });
      }

      if (typeof sala !== "string" || sala.trim() === "") {
        return res
          .status(400)
          .json({ error: "El texto de sala debe tener contenido." });
      }
    }

    let orden = "estudiante";

    if (req.query.orden !== undefined) {
      orden = req.query.orden;

      if (Array.isArray(orden)) {
        return res.status(400).json({
          error: "El parámetro 'orden' debe aparecer una sola vez.",
        });
      }

      if (
        orden !== "estudiante" &&
        orden !== "personas-asc" &&
        orden !== "personas-desc"
      ) {
        return res.status(400).json({ error: "Orden no permitido." });
      }
    }

    let pagina = 1;

    if (req.query.pagina !== undefined) {
      if (Array.isArray(req.query.pagina)) {
        return res.status(400).json({
          error: "El parámetro 'pagina' debe aparecer una sola vez.",
        });
      }

      pagina = Number(req.query.pagina);

      if (!Number.isInteger(pagina) || pagina < 1 || pagina > 1000) {
        return res.status(400).json({
          error: "El parámetro 'pagina' debe ser un entero entre 1 y 1000.",
        });
      }
    }

    let limite = 2;

    if (req.query.limite !== undefined) {
      if (Array.isArray(req.query.limite)) {
        return res.status(400).json({
          error: "El parámetro limite debe aparecer una sola vez.",
        });
      }

      limite = Number(req.query.limite);

      if (!Number.isInteger(limite) || limite < 1 || limite > 20) {
        return res.status(400).json({
          error: "Limite fuera del rango permitido.",
        });
      }
    }

    const resultado = await servicioReservas.consultar(
      sala,
      orden,
      pagina,
      limite,
    );

    return res.json(resultado);
  }

  //-------------------------------//

  async function obtenerApi(req, res) {
    const reserva = await servicioReservas.obtenerPorId(req.params.id);

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }

    return res.json(reserva);
  }

  async function crearApi(req, res) {
    const reserva = await servicioReservas.crear(req.reservaValidada);

    // 201 y Location se envían después de guardar.
    res.status(201).location(`/api/reservas/${reserva.id}`).json(reserva);
  }

  async function reemplazarApi(req, res) {
    // Solo se envían los siete campos ya validados, nunca req.body completo.
    const reserva = await servicioReservas.reemplazar(
      req.params.id,
      req.cambiosValidos,
    );

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }

    return res.json(reserva);
  }

  async function actualizarApi(req, res) {
    const reserva = await servicioReservas.actualizar(
      req.params.id,
      req.cambiosValidos,
    );

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }

    return res.json(reserva);
  }

  async function eliminarApi(req, res) {
    const eliminada = await servicioReservas.eliminar(req.params.id);

    if (!eliminada) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }

    // 204: sin cuerpo.
    return res.status(204).end();
  }

  return {
    mostrarInicio,
    mostrarEstado,
    listarReservas,
    mostrarNuevaReserva,
    mostrarDetalleReserva,
    mostrarEditarReserva,
    guardarEdicionReserva,
    mostrarEstadoReserva,
    guardarEstadoReserva,
    mostrarConfirmacionEliminar,
    eliminarReserva,
    crearReserva,
    listarApi,
    obtenerApi,
    crearApi,
    reemplazarApi,
    actualizarApi,
    eliminarApi,
  };
}

module.exports = { crearControladorReservas };
