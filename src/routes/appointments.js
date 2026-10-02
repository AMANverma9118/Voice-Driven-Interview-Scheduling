const express = require('express');
const router = express.Router();
const {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment
} = require('../controllers/appointmentController');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(getAllAppointments));
router.get('/:id', wrap(getAppointmentById));
router.post('/', wrap(createAppointment));
router.put('/:id', wrap(updateAppointment));
router.delete('/:id', wrap(deleteAppointment));

module.exports = router; 