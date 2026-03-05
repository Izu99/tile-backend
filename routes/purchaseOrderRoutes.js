const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
    getPurchaseOrders,
    getPurchaseOrder,
    createPurchaseOrder,
    updatePurchaseOrder,
    updatePurchaseOrderStatus,
    cancelPurchaseOrder,
    deletePurchaseOrder,
    uploadInvoiceImage,
    removeInvoiceImage, // NEW: Add remove invoice image import
    updateDeliveryVerification,
} = require('../controllers/purchaseOrderController');

// Validation rules
const purchaseOrderValidation = [
    body('customerName').trim().notEmpty().withMessage('Customer name is required'),
    body('supplier').notEmpty().withMessage('Supplier is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
];

// Routes
router.route('/')
    .get(protect, getPurchaseOrders)
    .post(protect, purchaseOrderValidation, validate, createPurchaseOrder);

router.route('/:id')
    .get(protect, getPurchaseOrder)
    .put(protect, updatePurchaseOrder)
    .delete(protect, deletePurchaseOrder);

router.patch('/:id/status', protect, updatePurchaseOrderStatus);

router.patch('/:id/cancel', protect, cancelPurchaseOrder);

router.put('/:id/delivery-verification', protect, updateDeliveryVerification);

router.post('/:id/invoice-image', protect, ...upload.single('invoice'), uploadInvoiceImage);

router.delete('/:id/invoice-image', protect, removeInvoiceImage); // NEW: Add remove invoice image route

module.exports = router;
