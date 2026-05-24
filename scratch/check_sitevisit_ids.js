const mongoose = require('mongoose');
require('dotenv').config();
const SiteVisit = require('../models/SiteVisit');
const companyId = '69660bcc2b1ffc22e563133a';

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected.');

    const siteVisits = await SiteVisit.find({ companyId }).sort({ id: -1 }).limit(20).lean();
    console.log('SAMPLE IDs:', siteVisits.map(d => d.id));

    const counterDoc = await SiteVisit.collection.findOne({ _id: `counter_${companyId}` });
    console.log('COUNTER DOC:', counterDoc);

    const maxSeq = await SiteVisit.getMaxSiteVisitSequence(companyId);
    console.log('MAX SEQUENCE FROM AGGREGATE:', maxSeq);

    const directCounter = await SiteVisit.collection.findOneAndUpdate(
      { _id: `counter_${companyId}` },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: 'after', projection: { sequence: 1 } }
    );
    console.log('DIRECT FINDONEANDUPDATE RESULT:', directCounter);

    const nextId = await SiteVisit.generateSiteVisitId(companyId);
    console.log('GENERATED NEXT ID:', nextId);

    await mongoose.disconnect();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
