const mongoose = require('mongoose');

// Payment Record subdocument (reuse from QuotationDocument)
const PaymentRecordSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
    },
    description: {
        type: String,
        default: '',
    },
});

// Material Sale Item subdocument
const MaterialSaleItemSchema = new mongoose.Schema({
    categoryId: {
        type: String,
        default: '',
    },
    categoryName: {
        type: String,
        default: '',
    },
    itemId: {
        type: String,
        default: '',
    },
    category: {
        type: String,
        enum: ['Floor Tile', 'Wall Tile', 'Other'],
        default: 'Floor Tile',
    },
    colorCode: {
        type: String,
        default: '',
    },
    productName: {
        type: String,
        required: true,
    },
    plank: {
        type: Number,
        default: 0,
        min: 0,
    },
    sqftPerPlank: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalSqft: {
        type: Number,
        required: true,
        min: 0,
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    costPerSqft: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalCost: {
        type: Number,
        default: 0,
        min: 0,
    },
});

// Virtual for profit
MaterialSaleItemSchema.virtual('profit').get(function () {
    return this.amount - this.totalCost;
});

// Virtual for profit percentage
MaterialSaleItemSchema.virtual('profitPercentage').get(function () {
    if (this.totalCost > 0) {
        return ((this.amount - this.totalCost) / this.totalCost) * 100;
    }
    return 0;
});

const MaterialSaleSchema = new mongoose.Schema(
    {
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
        },
        saleDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        customerName: {
            type: String,
            required: [true, 'Please add a customer name'],
        },
        customerPhone: {
            type: String,
            default: '',
        },
        customerAddress: {
            type: String,
        },
        paymentTerms: {
            type: Number,
            required: true,
            default: 30,
            min: 1,
        },
        dueDate: {
            type: Date,
            required: true,
        },
        items: [MaterialSaleItemSchema],
        paymentHistory: [PaymentRecordSchema],
        status: {
            type: String,
            enum: ['pending', 'partial', 'paid', 'cancelled'],
            default: 'pending',
        },
        notes: {
            type: String,
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
MaterialSaleSchema.virtual('totalAmount').get(function () {
    return (this.items || []).reduce((sum, item) => sum + item.amount, 0);
});

// Virtual for total cost
MaterialSaleSchema.virtual('totalCost').get(function () {
    return (this.items || []).reduce((sum, item) => sum + item.totalCost, 0);
});

// Virtual for total profit
MaterialSaleSchema.virtual('totalProfit').get(function () {
    return this.totalAmount - this.totalCost;
});

// Virtual for profit percentage
MaterialSaleSchema.virtual('profitPercentage').get(function () {
    if (this.totalCost > 0) {
        return ((this.totalAmount - this.totalCost) / this.totalCost) * 100;
    }
    return 0;
});

// Virtual for total paid
MaterialSaleSchema.virtual('totalPaid').get(function () {
    return (this.paymentHistory || []).reduce((sum, payment) => sum + payment.amount, 0);
});

// Virtual for amount due
MaterialSaleSchema.virtual('amountDue').get(function () {
    return this.totalAmount - this.totalPaid;
});

// Create indexes

MaterialSaleSchema.index({ user: 1, status: 1, saleDate: -1 });
MaterialSaleSchema.index({ user: 1, saleDate: -1 });
MaterialSaleSchema.index({ user: 1, createdAt: -1 });
MaterialSaleSchema.index({ user: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('MaterialSale', MaterialSaleSchema);
