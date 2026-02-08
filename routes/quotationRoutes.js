const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const {
    getQuotations,
    getQuotation,
    createQuotation,
    updateQuotation,
    convertToInvoice,
    updateStatus,
    addPayment,
    deleteQuotation,
} = require('../controllers/quotationController');

const quotationValidation = [
    body('customerName').trim().notEmpty().withMessage('Customer name is required'),
    body('invoiceDate').isISO8601().withMessage('Valid invoice date is required'),
    body('dueDate').isISO8601().withMessage('Valid due date is required'),
];

router.route('/')
    .get(protect, getQuotations)
    .post(protect, quotationValidation, validate, createQuotation);

router.route('/:id')
    .get(protect, getQuotation)
    .put(protect, updateQuotation)
    .delete(protect, deleteQuotation);

router.patch('/:id/convert-to-invoice', protect, convertToInvoice);
router.patch('/:id/status', protect, updateStatus);
router.post('/:id/payments', protect, addPayment);

module.exports = router;
