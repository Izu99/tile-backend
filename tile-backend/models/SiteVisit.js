const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const inspectionSchema = new mongoose.Schema({
  skirting: { type: String, default: '' },
  floorPreparation: { type: String, default: '' },
  groundSetting: { type: String, default: '' },
  door: { type: String, default: '' },
  window: { type: String, default: '' },
  evenUneven: { type: String, default: '' },
  areaCondition: { type: String, default: '' },
});

const siteVisitSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  projectTitle: { type: String, required: true },
  contactNo: { type: String, required: true },
  location: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
  siteType: { type: String, required: true },
  charge: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'invoiced', 'paid', 'converted'],
    default: 'pending'
  },
  colorCode: { type: String, default: '' },
  thickness: { type: String, default: '' },
  floorCondition: [{ type: String }],
  targetArea: [{ type: String }],
  inspection: inspectionSchema,
  otherDetails: { type: String, default: '' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true
});

// Index for better query performance
siteVisitSchema.index({ companyId: 1, customerName: 1 });
siteVisitSchema.index({ status: 1 });
siteVisitSchema.index({ date: -1 });

// Add pagination plugin
siteVisitSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('SiteVisit', siteVisitSchema);
