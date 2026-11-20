const express = require("express");

const { prepararAreaReservas } = require("../middleware/reservas");

// Caminos relativos: el router se monta en /reservas desde app.js.
function crearRouterReservas(controladorReservas, validarReserva) {
  const router = express.Router();

  router.use(prepararAreaReservas);

  router.get("/", controladorReservas.listarReservas);
  // "/nueva" va antes de "/:id", si no Express la tomaría como un id.
  router.get("/nueva", controladorReservas.mostrarNuevaReserva);

  // "/:id/editar" va antes de "/:id" (más específica). Solo reemplazo completo.
  // mostrarReserva no tiene que validar, solo mostrar. Validar y guardar se hace en POST.
  router.get("/:id/editar", controladorReservas.mostrarEditarReserva);

  router.post("/:id/editar", controladorReservas.guardarEdicionReserva);
  // POST para guardar la edición de la reserva.
  // controladorReservas.guardarEdicionReserva se encargará de validar y guardar los cambios.

  // Cambio parcial (solo estado) y eliminación con confirmación.
  // El GET solo muestra; únicamente el POST escribe.
  router.get("/:id/estado", controladorReservas.mostrarEstadoReserva);
  router.post("/:id/estado", controladorReservas.guardarEstadoReserva);

  router.get("/:id/eliminar", controladorReservas.mostrarConfirmacionEliminar);
  router.post("/:id/eliminar", controladorReservas.eliminarReserva);

  router.get("/:id", controladorReservas.mostrarDetalleReserva);
  router.post("/", validarReserva, controladorReservas.crearReserva);

  return router;
}

module.exports = { crearRouterReservas };
