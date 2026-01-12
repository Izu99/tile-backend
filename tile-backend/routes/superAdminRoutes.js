const express = require('express');
const {
    getItemConfigs,
    getDashboardStats,
    getAllCompanies,
    createCompany,
    updateCompany,
    deleteCompany,
    getCompanyCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    addItemToCategory,
    updateItem,
    deleteItem
} = require('../controllers/superAdminController');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// protect all routes
router.use(protect);
router.use(authorize('super-admin'));

// Item Configurations
router.get('/item-configs', getItemConfigs);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Companies
router.route('/companies')
    .get(getAllCompanies)
    .post(createCompany);

router.route('/companies/:id')
    .put(updateCompany)
    .delete(deleteCompany);

// Categories
router.get('/companies/:companyId/categories', getCompanyCategories);
router.post('/categories', createCategory);

router.route('/categories/:id')
    .put(updateCategory)
    .delete(deleteCategory);

// Items
router.route('/categories/:id/items')
    .post(addItemToCategory);

router.route('/categories/:catId/items/:itemId')
    .put(updateItem)
    .delete(deleteItem);

module.exports = router;
