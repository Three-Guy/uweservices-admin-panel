const mongoose = require('mongoose');
const { getAdminConnection } = require('../config/database');

const citySchema = new mongoose.Schema({
  cityName: {
    type: String,
    required: [true, 'City name is required'],
    trim: true,
    minlength: [2, 'City name must be at least 2 characters'],
    maxlength: [100, 'City name cannot exceed 100 characters'],
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
    default: 'India',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
citySchema.index({ cityName: 1, state: 1 }, { unique: true });
citySchema.index({ isActive: 1 });
citySchema.index({ state: 1 });
citySchema.index({ createdAt: -1 });

// Virtual for zones count (will be populated manually)
citySchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Pre-save middleware to format city name
citySchema.pre('save', function(next) {
  if (this.isModified('cityName')) {
    // Capitalize first letter of each word
    this.cityName = this.cityName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  next();
});

// Static method to get city with zones count
citySchema.statics.getCitiesWithZonesCount = async function(filter = {}) {
  const Zone = require('./Zone');
  
  const cities = await this.find(filter).sort({ createdAt: -1 }).lean();
  
  // Get zones count for each city
  const citiesWithCount = await Promise.all(
    cities.map(async (city) => {
      const zonesCount = await Zone.countDocuments({ city: city._id, isDeleted: { $ne: true } });
      return {
        ...city,
        id: city._id.toString(),
        zonesCount,
      };
    })
  );
  
  return citiesWithCount;
};

// Instance method to check if city can be deleted
citySchema.methods.canDelete = async function() {
  const Zone = require('./Zone');
  const zonesCount = await Zone.countDocuments({ city: this._id });
  return zonesCount === 0;
};

// Use admin connection
let City;
try {
  const connection = getAdminConnection();
  if (connection) {
    City = connection.model('City', citySchema);
  } else {
    City = mongoose.model('City', citySchema);
  }
} catch (error) {
  console.error('Error creating City model:', error);
  City = mongoose.model('City', citySchema);
}

module.exports = City;