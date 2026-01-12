// const mongoose = require('mongoose');

// // Payment Record subdocument
// const PaymentRecordSchema = new mongoose.Schema({
//     amount: {
//         type: Number,
//         required: true,
//         min: 0,
//     },
//     date: {
//         type: Date,
//         required: true,
//         default: Date.now,
//     },
//     description: {
//         type: String,
//         default: '',
//     },
// });

// // Direct Cost subdocument for tracking actual project costs
// const DirectCostSchema = new mongoose.Schema({
//     category: {
//         type: String,
//         required: true,
//         enum: ['materials', 'labor', 'equipment', 'subcontractors', 'transportation', 'other'],
//     },
//     description: {
//         type: String,
//         required: true,
//     },
//     amount: {
//         type: Number,
//         required: true,
//         min: 0,
//     },
//     date: {
//         type: Date,
//         required: true,
//         default: Date.now,
//     },
//     vendor: {
//         type: String,
//         default: '',
//     },
// });

// // Item Description subdocument
// const ItemDescriptionSchema = new mongoose.Schema({
//     category: {
//         type: String,
//         required: true,
//     },
//     name: {
//         type: String,
//         required: true,
//     },
//     costPrice: {
//         type: Number,
//         required: false,
//         min: 0,
//     },
//     sellingPrice: {
//         type: Number,
//         required: true,
//         min: 0,
//     },
//     unit: {
//         type: String,
//         required: false,
//         default: 'units',
//     },
//     categoryId: {
//         type: String,
//         required: false,
//     },
//     productName: {
//         type: String,
//         required: false,
//     },
// });

// // Invoice Line Item subdocument
// const InvoiceLineItemSchema = new mongoose.Schema({
//     item: {
//         type: ItemDescriptionSchema,
//         required: true,
//     },
//     quantity: {
//         type: Number,
//         required: true,
//         min: 0,
//     },
//     customDescription: {
//         type: String,
//     },
//     isOriginalQuotationItem: {
//         type: Boolean,
//         default: true,
//     },
// });

// // Virtual for line item amount
// InvoiceLineItemSchema.virtual('amount').get(function () {
//     return this.quantity * this.item.sellingPrice;
// });

// const QuotationDocumentSchema = new mongoose.Schema(
//     {
//         documentNumber: {
//             type: String,
//             required: true,
//         },
//         type: {
//             type: String,
//             enum: ['quotation', 'invoice'],
//             default: 'quotation',
//         },
//         status: {
//             type: String,
//             enum: ['pending', 'approved', 'partial', 'paid', 'closed', 'converted', 'invoiced'],
//             default: 'pending',
//             validate: {
//                 validator: function(status) {
//                     // For updates, we might not have the full document context
//                     // Allow all statuses during updates, validate in pre-save hook instead
//                     return true;
//                 }
//             }
//         },
//         customerName: {
//             type: String,
//             required: [true, 'Please add a customer name'],
//         },
//         customerPhone: {
//             type: String,
//             default: '',
//         },
//         customerAddress: {
//             type: String,
//             default: '',
//         },
//         projectTitle: {
//             type: String,
//             default: '',
//         },
//         paymentTerms: {
//             type: Number,
//             required: true,
//             default: 30,
//             min: 1,
//         },
//         intendedInvoiceDate: {
//             type: Date,
//         },
//         intendedPaymentDueDate: {
//             type: Date,
//         },
//         invoiceDate: {
//             type: Date,
//             required: true,
//             default: Date.now,
//         },
//         dueDate: {
//             type: Date,
//             required: true,
//         },
//         lineItems: [InvoiceLineItemSchema],
//         paymentHistory: [PaymentRecordSchema],
//         directCosts: [DirectCostSchema], // Track actual project costs for profitability analysis
//         actualCompletionDate: {
//             type: Date,
//         }, // When project was actually completed (different from due date)
//         projectStatus: {
//             type: String,
//             enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
//             default: 'planning',
//         }, // Overall project status (separate from document status)
//         user: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User',
//             required: true,
//         },
//     },
//     {
//         timestamps: true,
//         toJSON: { virtuals: true },
//         toObject: { virtuals: true },
//     }
// );

// // Virtual for subtotal
// QuotationDocumentSchema.virtual('subtotal').get(function () {
//     if (!this.lineItems || !Array.isArray(this.lineItems) || this.lineItems.length === 0) {
//         return 0;
//     }

//     return this.lineItems.reduce(
//         (sum, item) => sum + (item.quantity || 0) * ((item.item && item.item.sellingPrice) || 0),
//         0
//     );
// });

// // Virtual for total payments
// QuotationDocumentSchema.virtual('totalPayments').get(function () {
//     if (!this.paymentHistory || !Array.isArray(this.paymentHistory) || this.paymentHistory.length === 0) {
//         return 0;
//     }

//     return this.paymentHistory.reduce((sum, payment) => sum + (payment.amount || 0), 0);
// });

// // Virtual for amount due
// QuotationDocumentSchema.virtual('amountDue').get(function () {
//     return this.subtotal - this.totalPayments;
// });

// // Virtual for total direct costs
// QuotationDocumentSchema.virtual('totalDirectCosts').get(function () {
//     if (!this.directCosts || !Array.isArray(this.directCosts) || this.directCosts.length === 0) {
//         return 0;
//     }

//     return this.directCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);
// });

// // Virtual for net profit (income - direct costs)
// QuotationDocumentSchema.virtual('netProfit').get(function () {
//     return this.subtotal - this.totalDirectCosts;
// });

// // Virtual for profit margin percentage
// QuotationDocumentSchema.virtual('profitMargin').get(function () {
//     if (this.subtotal <= 0) return 0;
//     return ((this.netProfit / this.subtotal) * 100);
// });

// // Virtual for project completion date (actual or estimated)
// QuotationDocumentSchema.virtual('completionDate').get(function () {
//     return this.actualCompletionDate || this.dueDate;
// });

// // Pre-save hook to validate status based on document type
// QuotationDocumentSchema.pre('save', function(next) {
//     // Validate status based on document type
//     if (this.type === 'quotation') {
//         const validStatuses = ['pending', 'approved', 'invoiced', 'rejected'];
//         if (!validStatuses.includes(this.status)) {
//             const error = new Error(`Status '${this.status}' is not allowed for quotation documents. Valid statuses: ${validStatuses.join(', ')}`);
//             return next(error);
//         }
//     } else if (this.type === 'invoice') {
//         const validStatuses = ['pending', 'partial', 'paid', 'invoiced', 'converted'];
//         if (!validStatuses.includes(this.status)) {
//             const error = new Error(`Status '${this.status}' is not allowed for invoice documents. Valid statuses: ${validStatuses.join(', ')}`);
//             return next(error);
//         }
//     }
//     next();
// });

// // Pre-update hook to validate status changes during updates
// QuotationDocumentSchema.pre('findOneAndUpdate', async function(next) {
//     const update = this.getUpdate();

//     // If status is being updated, validate it
//     if (update.status) {
//         // Get the current document to check its type
//         const doc = await this.model.findOne(this.getQuery());

//         if (doc) {
//             if (doc.type === 'quotation') {
//                 const validStatuses = ['pending', 'approved', 'invoiced', 'rejected'];
//                 if (!validStatuses.includes(update.status)) {
//                     const error = new Error(`Status '${update.status}' is not allowed for quotation documents. Valid statuses: ${validStatuses.join(', ')}`);
//                     return next(error);
//                 }
//             } else if (doc.type === 'invoice') {
//                 const validStatuses = ['pending', 'partial', 'paid', 'invoiced', 'converted'];
//                 if (!validStatuses.includes(update.status)) {
//                     const error = new Error(`Status '${update.status}' is not allowed for invoice documents. Valid statuses: ${validStatuses.join(', ')}`);
//                     return next(error);
//                 }
//             }
//         }
//     }

//     next();
// });

// // Create indexes
// QuotationDocumentSchema.index({ documentNumber: 1, type: 1, user: 1 }, { unique: true });
// QuotationDocumentSchema.index({ type: 1, status: 1 });
// QuotationDocumentSchema.index({ invoiceDate: -1 });

// module.exports = mongoose.model('QuotationDocument', QuotationDocumentSchema);
const mongoose = require('mongoose');

// --- SUBDOCUMENTS ---

// Payment Record subdocument
const PaymentRecordSchema = new mongoose.Schema({
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    description: { type: String, default: '' },
});

// Direct Cost subdocument
const DirectCostSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: ['materials', 'labor', 'equipment', 'subcontractors', 'transportation', 'other'],
    },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    vendor: { type: String, default: '' },
});

// Item Description subdocument
const ItemDescriptionSchema = new mongoose.Schema({
    category: { type: String, required: false, default: '' },
    name: { type: String, required: true },
    costPrice: { type: Number, required: false, min: 0 },
    sellingPrice: {
        type: Number,
        required: true,
        validate: {
            validator: function (value) {
                // Allow negative values for site visit related items
                if (this.productName && this.productName.toLowerCase().includes('site visit')) {
                    return true; // Allow any value for site visit items
                }
                // For all other items, ensure non-negative
                return value >= 0;
            },
            message: function (props) {
                if (this.productName && this.productName.toLowerCase().includes('site visit')) {
                    return 'Site visit deduction price is invalid';
                }
                return 'Selling price must be non-negative for regular items';
            }
        }
    },
    unit: { type: String, required: false, default: 'units' },
    categoryId: { type: String, required: false },
    productName: { type: String, required: false },
});

// Invoice Line Item subdocument
const InvoiceLineItemSchema = new mongoose.Schema({
    item: { type: ItemDescriptionSchema, required: true },
    quantity: { type: Number, required: true, min: 0 },
    customDescription: { type: String },
    isOriginalQuotationItem: { type: Boolean, default: true },
});

// --- MAIN SCHEMA ---

const QuotationDocumentSchema = new mongoose.Schema(
    {
        // documentNumber එකේ "QUO-" කෑල්ල නැතුව අංකය විතරක් සේව් කරන්න (උදා: "001")
        // එතකොට අංක පනින්නේ නැතිව පිළිවෙලට තියාගන්න ලේසියි.
        documentNumber: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['quotation', 'invoice'],
            default: 'quotation',
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'partial', 'paid', 'converted', 'rejected'],
            default: 'pending',
        },
        customerName: { type: String, required: [true, 'Please add a customer name'] },
        customerPhone: { type: String, default: '' },
        customerAddress: { type: String, default: '' },
        projectTitle: { type: String, default: '' },
        paymentTerms: { type: Number, required: true, default: 30, min: 1 },
        invoiceDate: { type: Date, required: true, default: Date.now },
        dueDate: { type: Date, required: true },

        lineItems: [InvoiceLineItemSchema],
        paymentHistory: [PaymentRecordSchema],
        directCosts: [DirectCostSchema],

        actualCompletionDate: { type: Date },
        projectStatus: {
            type: String,
            enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
            default: 'planning',
        },
        // Super admin විසින් ඇඩ් කරන Company එක හෝ User එක
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        linkedSiteVisitId: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// --- VIRTUALS (UI එකට පෙන්වන කොටස්) ---

// 1. Prefix එකත් එක්ක ලස්සනට ID එක පෙන්වන්න (QUO-001 හෝ INV-001)
QuotationDocumentSchema.virtual('displayDocumentNumber').get(function () {
    const prefix = this.type === 'invoice' ? 'INV' : 'QUO';
    return `${prefix}-${this.documentNumber}`;
});

QuotationDocumentSchema.virtual('subtotal').get(function () {
    if (!this.lineItems?.length) return 0;
    return this.lineItems.reduce((sum, item) => sum + (item.quantity * item.item.sellingPrice), 0);
});

QuotationDocumentSchema.virtual('totalPayments').get(function () {
    if (!this.paymentHistory?.length) return 0;
    return this.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
});

QuotationDocumentSchema.virtual('amountDue').get(function () {
    return this.subtotal - this.totalPayments;
});

QuotationDocumentSchema.virtual('netProfit').get(function () {
    const totalCosts = this.directCosts?.reduce((sum, cost) => sum + cost.amount, 0) || 0;
    return this.subtotal - totalCosts;
});

// --- INDEXES (වැදගත්ම කොටස) ---

// ❌ පරණ තනි indexes අයින් කරන්න (invoiceNumber, invoiceId)
// ✅ මේ index එකෙන් තමයි "INV-001" duplicate error එක විසඳන්නේ. 
// දැන් එකම අංකය Company දෙකකට වෙන වෙනම පාවිච්චි කරන්න පුළුවන්.
QuotationDocumentSchema.index({ documentNumber: 1, type: 1, user: 1 }, { unique: true });

// සර්ච් කිරීමට ලේසි වෙන්න අමතර indexes
QuotationDocumentSchema.index({ user: 1, type: 1, status: 1, invoiceDate: -1 });
QuotationDocumentSchema.index({ user: 1, type: 1, invoiceDate: -1 });
QuotationDocumentSchema.index({ user: 1, projectStatus: 1, invoiceDate: -1 });
QuotationDocumentSchema.index({ user: 1, invoiceDate: -1 });
QuotationDocumentSchema.index({ user: 1, createdAt: -1 }); // Default sort
QuotationDocumentSchema.index({ user: 1, customerName: 1 }); // Searching
QuotationDocumentSchema.index({ user: 1, projectTitle: 1 }); // Searching
QuotationDocumentSchema.index({ user: 1, documentNumber: 1 }); // Quick lookup

// --- PRE-SAVE HOOK ---
// Reset 'rejected' status to 'pending' when editing
QuotationDocumentSchema.pre('save', function (next) {
    // If the document is being modified and status is 'rejected', reset to 'pending'
    if (this.isModified() && this.status === 'rejected' && this.isNew === false) {
        this.status = 'pending';
    }
    next();
});

module.exports = mongoose.model('QuotationDocument', QuotationDocumentSchema);
