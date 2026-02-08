const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const {
    searchCustomer,
    createCustomer,
    getCustomers,
    updateCustomer,
    deleteCustomer,
} = require('../controllers/customerController');

const customerValidation = [
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
];

router.route('/')
    .get(protect, getCustomers)
    .post(protect, customerValidation, validate, createCustomer);

router.route('/:id')
    .put(protect, updateCustomer)
    .delete(protect, deleteCustomer);

// Search endpoint (must be before /:id route)
router.get('/search', protect, searchCustomer);

module.exports = router;
