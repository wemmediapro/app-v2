const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  type: {
    type: String,
    required: [true, 'Product type is required'],
    enum: ['Souvenir officiel', 'Vêtement officiel', 'Produit duty-free', 'Accessoire', 'Autre']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['souvenirs', 'fashion', 'duty-free', 'accessories', 'other']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  image: {
    type: String,
    required: [true, 'Image URL is required']
  },
  images: [{
    type: String
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  sku: {
    type: String,
    sparse: true,
    trim: true
  },
  weight: {
    type: Number,
    min: 0
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  }
}, {
  timestamps: true
});

// Indexes
productSchema.index({ category: 1, isAvailable: 1 });
productSchema.index({ type: 1 });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);

