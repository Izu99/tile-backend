const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const {
    getSuppliers,
    getSupplier,
    createSupplier,
    updateSupplier,
    deleteSupplier,
} = require('../controllers/supplierController');

// Validation rules
const supplierValidation = [
    body('name').trim().notEmpty().withMessage('Supplier name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
];

// Routes
router.route('/')
    .get(protect, getSuppliers)
    .post(protect, supplierValidation, validate, createSupplier);

router.route('/:id')
    .get(protect, getSupplier)
    .put(protect, supplierValidation, validate, updateSupplier)
    .delete(protect, deleteSupplier);

module.exports = router;
