const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const {
    getJobCosts,
    getJobCost,
    createJobCost,
    updateJobCost,
    completeProject,
    reopenProject,
    deleteJobCost,
    getOtherExpenses,
    addOtherExpense,
    updateOtherExpense,
    deleteOtherExpense,
} = require('../controllers/jobCostController');

const jobCostValidation = [
    body('customerName').trim().notEmpty().withMessage('Customer name is required'),
    body('projectTitle').trim().notEmpty().withMessage('Project title is required'),
    body('invoiceDate').isISO8601().withMessage('Valid invoice date is required'),
];

router.route('/')
    .get(protect, getJobCosts)
    .post(protect, jobCostValidation, validate, createJobCost);

router.route('/:id')
    .get(protect, getJobCost)
    .put(protect, updateJobCost)
    .delete(protect, deleteJobCost);

router.route('/:id/complete')
    .patch(protect, completeProject);

router.route('/:id/reopen')
    .patch(protect, reopenProject);

// Other Expenses routes
router.route('/:jobCostId/other-expenses')
    .get(protect, getOtherExpenses)
    .post(protect, addOtherExpense);

router.route('/:jobCostId/other-expenses/:expenseId')
    .put(protect, updateOtherExpense)
    .delete(protect, deleteOtherExpense);

module.exports = router;
