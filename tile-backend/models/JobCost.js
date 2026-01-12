const mongoose = require('mongoose');

// Invoice Item subdocument
const InvoiceItemSchema = new mongoose.Schema({
    category: {
        type: String,
        required: false,
        default: 'General',
    },
    name: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    costPrice: {
        type: Number,
        required: false,
        default: 0,
    },
    unit: {
        type: String,
        default: '',
    },
    sellingPrice: {
        type: Number,
        required: true,
        // min: 0 removed to allow negative values for discounts/adjustments
    },
});

// Virtuals for invoice item
InvoiceItemSchema.virtual('totalCostPrice').get(function () {
    return this.quantity * this.costPrice;
});

InvoiceItemSchema.virtual('totalSellingPrice').get(function () {
    return this.quantity * this.sellingPrice;
});

InvoiceItemSchema.virtual('profit').get(function () {
    // For deductions (negative selling price like site visits), always calculate profit
    if (this.sellingPrice < 0) {
        return (this.sellingPrice - (this.costPrice || 0)) * this.quantity;
    }
    // For regular items, only calculate profit if cost price is available and > 0
    if (this.costPrice == null || this.costPrice === 0) {
        return 0;
    }
    return (this.sellingPrice - this.costPrice) * this.quantity;
});

// PO Item Cost subdocument
const POItemCostSchema = new mongoose.Schema({
    poId: {
        type: String,
        required: true,
    },
    supplierName: {
        type: String,
        default: '',
    },
    itemName: {
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
        default: '',
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    orderDate: {
        type: Date,
        default: Date.now,
    },
    status: {
        type: String,
        default: 'Draft',
    },
    purchaseOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
    },
    invoiceImagePath: {
        type: String,
        default: '',
    },
});

// Virtual for total cost
POItemCostSchema.virtual('totalCost').get(function () {
    return this.quantity * this.unitCost;
});

// Other Expense subdocument
const OtherExpenseSchema = new mongoose.Schema({
    description: {
        type: String,
        required: false,
        default: '',
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    category: {
        type: String,
        default: 'General',
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

const JobCostSchema = new mongoose.Schema(
    {
        // Unified ID: numeric part of document number (e.g., "010")
        // Unique per user (compound index below)
        documentId: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['quotation', 'invoice'],
            default: 'quotation',
        },
        invoiceId: {
            type: String,
            default: null,
            // Removed unique constraint - multiple JobCosts can have null invoiceId initially
        },
        quotationId: {
            type: String,
            default: '',
        },
        customerName: {
            type: String,
            required: [true, 'Please add a customer name'],
        },
        customerPhone: {
            type: String,
            default: '',
        },
        projectTitle: {
            type: String,
            required: [true, 'Please add a project title'],
        },
        invoiceDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        invoiceItems: [InvoiceItemSchema],
        purchaseOrderItems: [POItemCostSchema],
        otherExpenses: [OtherExpenseSchema],
        materialCost: {
            type: Number,
            default: 0,
        },
        netProfit: {
            type: Number,
            default: 0,
        },
        completed: {
            type: Boolean,
            default: false,
        },
        customerInvoiceStatus: {
            type: String,
            default: 'pending',
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
        autoIndex: false // 🚨 CRITICAL: Prevents Mongoose from recreating old indexes
    }
);

// Virtual for total revenue
JobCostSchema.virtual('totalRevenue').get(function () {
    return this.invoiceItems.reduce(
        (sum, item) => sum + item.quantity * item.sellingPrice,
        0
    );
});

// Removed virtual for materialCost as it's now a real field

JobCostSchema.virtual('purchaseOrderCost').get(function () {
    return this.purchaseOrderItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
    );
});

// Virtual for other expenses cost
JobCostSchema.virtual('otherExpensesCost').get(function () {
    return this.otherExpenses.reduce((sum, item) => sum + item.amount, 0);
});

// Virtual for total cost (Material Cost + Other Expenses)
JobCostSchema.virtual('totalCost').get(function () {
    return (this.materialCost || 0) + this.otherExpensesCost;
});

// Virtual for profit (Sum of Item Profits - Other Expenses)
// This ensures we don't count revenue as profit for items without cost prices.
JobCostSchema.virtual('profit').get(function () {
    const totalItemProfit = (this.invoiceItems || []).reduce((sum, item) => sum + (item.profit || 0), 0);
    return totalItemProfit - this.otherExpensesCost;
});

// Virtual for profit margin
JobCostSchema.virtual('profitMargin').get(function () {
    return this.totalRevenue > 0 ? (this.profit / this.totalRevenue) * 100 : 0;
});

// Virtual for display document ID with prefix (QUO-010 or INV-010)
JobCostSchema.virtual('displayDocumentId').get(function () {
    const prefix = this.type === 'invoice' ? 'INV' : 'QUO';
    return `${prefix}-${this.documentId}`;
});

// Pre-save middleware to calculate materialCost and netProfit
JobCostSchema.pre('save', function (next) {
    // Calculate total revenue from invoiceItems
    const totalRev = (this.invoiceItems || []).reduce((sum, item) => {
        return sum + (item.quantity || 0) * (item.sellingPrice || 0);
    }, 0);

    // Calculate materialCost from invoiceItems
    this.materialCost = (this.invoiceItems || []).reduce((total, item) => {
        return total + ((item.costPrice || 0) * (item.quantity || 0));
    }, 0);

    const totalOtherExpenses = (this.otherExpenses || []).reduce((total, exp) => {
        return total + (exp.amount || 0);
    }, 0);

    // Calculate Net Profit based on Item Profits
    // This matches the Virtual logic: Uncosted items contribute 0 to profit
    const totalItemProfit = (this.invoiceItems || []).reduce((sum, item) => {
        // Logic duplicated from InvoiceItem.profit virtual for persistence
        if (item.sellingPrice < 0) {
            // Deductions always contribute
            return sum + ((item.sellingPrice - (item.costPrice || 0)) * (item.quantity || 0));
        }
        if ((item.costPrice || 0) <= 0) {
            return sum; // Skip items without valid cost price
        }
        return sum + ((item.sellingPrice - item.costPrice) * (item.quantity || 0));
    }, 0);

    this.netProfit = totalItemProfit - totalOtherExpenses;

    next();
});

// Create indexes
JobCostSchema.index({ user: 1, quotationId: 1 });
JobCostSchema.index({ user: 1, invoiceDate: -1 });
// Unique index for documentId per user (allows same numbers for different companies)
JobCostSchema.index({ documentId: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('JobCost', JobCostSchema);
