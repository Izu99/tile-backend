const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const {
    getMaterialSales,
    getMaterialSale,
    createMaterialSale,
    updateMaterialSale,
    addPayment,
    updateStatus,
    deleteMaterialSale,
    searchCustomerByPhone,
} = require('../controllers/materialSaleController');

const materialSaleValidation = [
    body('customerName').trim().notEmpty().withMessage('Customer name is required'),
    body('saleDate').isISO8601().withMessage('Valid sale date is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
];

router.route('/')
    .get(protect, getMaterialSales)
    .post(protect, materialSaleValidation, validate, createMaterialSale);

router.route('/:id')
    .get(protect, getMaterialSale)
    .put(protect, updateMaterialSale)
    .delete(protect, deleteMaterialSale);

router.post('/:id/payments', protect, addPayment);
router.patch('/:id/status', protect, updateStatus);
router.get('/search-customer', protect, searchCustomerByPhone);

module.exports = router;
