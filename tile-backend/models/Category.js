const mongoose = require('mongoose');

const ItemTemplateSchema = new mongoose.Schema({
    itemName: {
        type: String,
        required: [true, 'Please add item name'],
    },
    baseUnit: {
        type: String,
        required: [true, 'Please add base unit'],
    },
    packagingUnit: {
        type: String,
        default: null,
    },
    sqftPerUnit: {
        type: Number,
        required: [true, 'Please add sqft per unit'],
        default: 0,
    },
    isService: {
        type: Boolean,
        default: false,
    },
    pricingType: {
        type: String,
        enum: ['fixed', 'variable'],
        default: null,
    }
});

const CategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add category name'],
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        items: [ItemTemplateSchema]
    },
    {
        timestamps: true,
    }
);

// Prevent duplicate category names for the same company
CategorySchema.index({ name: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model('Category', CategorySchema);
