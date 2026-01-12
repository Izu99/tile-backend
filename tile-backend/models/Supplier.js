const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a supplier name'],
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'Please add a phone number'],
        },
        email: {
            type: String,
            default: '',
            lowercase: true,
        },
        address: {
            type: String,
            default: '',
        },
        categories: {
            type: [String],
            default: [],
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Create index for search
SupplierSchema.index({ name: 'text', categories: 'text' });

module.exports = mongoose.model('Supplier', SupplierSchema);
