const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    addItemToCategory,
    updateItem,
    deleteItem,
    fetchAllItemCategories
} = require('../controllers/categoryController');

router.use(protect);

// Category CRUD routes
router.route('/')
    .get(getCategories)
    .post(createCategory);

router.route('/:id')
    .put(updateCategory)
    .delete(deleteCategory);

// Item management routes
router.route('/:id/items')
    .post(addItemToCategory);

router.route('/:catId/items/:itemId')
    .put(updateItem)
    .delete(deleteItem);

// Fetch all items from all categories
router.route('/items/all')
    .get(fetchAllItemCategories);

module.exports = router;
