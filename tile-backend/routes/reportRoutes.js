const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getProjectReport,
    getInvoiceReport,
    getDashboardSummary,
    getMaterialSalesReport,
    addDirectCost,
    updateProjectStatus,
} = require('../controllers/reportController');

// Lightweight mock endpoint for frontend development (no DB required)
router.get('/mock', (req, res) => {
    return res.json({
        success: true,
        message: 'Mock report data',
        data: {
            rows: [
                { id: 'INV-1001', customerName: 'ABC Constructions', date: '2025-12-01', totalAmount: 15000, amountDue: 5000, status: 'partial' },
                { id: 'INV-1002', customerName: 'XYZ Developers', date: '2025-12-05', totalAmount: 25000, amountDue: 0, status: 'paid' },
                { id: 'MS-2001', customerName: 'Home Owner', date: '2025-12-10', totalAmount: 5000, amountDue: 5000, status: 'pending' },
            ],
            summary: {
                totalRows: 3,
                totalOutstanding: 10000,
            }
        }
    });
});

router.get('/projects', protect, getProjectReport);
router.get('/invoices', protect, getInvoiceReport);
router.get('/material-sales', protect, getMaterialSalesReport);
router.get('/dashboard', protect, getDashboardSummary);
router.post('/:documentId/costs', protect, addDirectCost);
router.patch('/:documentId/project-status', protect, updateProjectStatus);

module.exports = router;
