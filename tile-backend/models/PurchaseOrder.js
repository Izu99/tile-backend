const mongoose = require('mongoose');

// PO Item subdocument
const POItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    unit: {
        type: String,
        required: true,
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0,
    },
});

// Virtual for total amount
POItemSchema.virtual('totalAmount').get(function () {
    return this.quantity * this.unitPrice;
});

const PurchaseOrderSchema = new mongoose.Schema(
    {
        poId: {
            type: String,
            required: true,
            unique: true,
        },
        quotationId: {
            type: String,
            default: '',
        },
        customerName: {
            type: String,
            required: [true, 'Please add a customer name'],
        },
        supplier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Supplier',
            required: [true, 'Please add a supplier'],
        },
        orderDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        expectedDelivery: {
            type: Date,
            required: [true, 'Please provide an expected delivery date'],
        },
        status: {
            type: String,
            enum: ['Draft', 'Ordered', 'Delivered', 'Paid', 'Cancelled'],
            default: 'Draft',
        },
        items: [POItemSchema],
        invoiceImagePath: {
            type: String,
        },
        notes: {
            type: String,
        },
        deliveryVerification: {
            type: Array,
            default: [],
        },
        deliveryVerifiedAt: {
            type: Date,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual for total amount
PurchaseOrderSchema.virtual('totalAmount').get(function () {
    if (!this.items || !Array.isArray(this.items) || this.items.length === 0) {
        return 0;
    }

    return this.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
});

// Create indexes
PurchaseOrderSchema.index({ user: 1, status: 1, orderDate: -1 });
PurchaseOrderSchema.index({ user: 1, orderDate: -1 });
PurchaseOrderSchema.index({ user: 1 });
PurchaseOrderSchema.index({ quotationId: 1 });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
