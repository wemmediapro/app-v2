const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String },
    translations: { type: mongoose.Schema.Types.Mixed },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    discountValue: { type: Number, required: true, min: 0 },
    productIds: [{ type: mongoose.Schema.Types.Mixed }],
    countries: [{ type: String, trim: true }],
    validFrom: { type: Date },
    validUntil: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

promotionSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });

function toPromoResponse(doc) {
  if (!doc) {
    return doc;
  }
  const d = doc.toObject ? doc.toObject() : doc;
  return {
    ...d,
    id: d._id?.toString(),
    validFrom: d.validFrom
      ? typeof d.validFrom === 'string'
        ? d.validFrom
        : d.validFrom.toISOString?.()?.slice(0, 10) || d.validFrom
      : '',
    validUntil: d.validUntil
      ? typeof d.validUntil === 'string'
        ? d.validUntil
        : d.validUntil.toISOString?.()?.slice(0, 10) || d.validUntil
      : '',
  };
}

module.exports = mongoose.model('Promotion', promotionSchema);
module.exports.toPromoResponse = toPromoResponse;
