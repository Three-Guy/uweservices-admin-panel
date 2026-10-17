const mongoose = require('mongoose');
const { getAdminConnection } = require('../config/database');

// Polygon coordinate schema
const coordinateSchema = new mongoose.Schema({
  lat: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: [-90, 'Latitude must be between -90 and 90'],
    max: [90, 'Latitude must be between -90 and 90'],
  },
  lng: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: [-180, 'Longitude must be between -180 and 180'],
    max: [180, 'Longitude must be between -180 and 180'],
  },
}, { _id: false });

const zoneSchema = new mongoose.Schema({
  zoneName: {
    type: String,
    required: [true, 'Zone name is required'],
    trim: true,
    minlength: [2, 'Zone name must be at least 2 characters'],
    maxlength: [100, 'Zone name cannot exceed 100 characters'],
  },
  city: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    required: [true, 'City is required'],
  },
  polygonCoordinates: {
    type: [coordinateSchema],
    required: [true, 'Polygon coordinates are required'],
    validate: {
      validator: function(coords) {
        return coords && coords.length >= 3;
      },
      message: 'A polygon must have at least 3 coordinates',
    },
  },
  // GeoJSON format for MongoDB geospatial queries
  geoJSON: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon',
    },
    coordinates: {
      type: [[[Number]]],
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
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

// Indexes
zoneSchema.index({ city: 1 });
zoneSchema.index({ isActive: 1 });
zoneSchema.index({ isDeleted: 1 });
zoneSchema.index({ zoneName: 1, city: 1 }, { unique: true });
zoneSchema.index({ createdAt: -1 });
zoneSchema.index({ geoJSON: '2dsphere' }); // For geospatial queries

// Virtual for id
zoneSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Virtual for cityId
zoneSchema.virtual('cityId').get(function() {
  if (this.city) {
    return typeof this.city === 'object' ? this.city._id.toString() : this.city.toString();
  }
  return null;
});

// Pre-save middleware to create GeoJSON from polygon coordinates
zoneSchema.pre('save', function(next) {
  if (this.isModified('polygonCoordinates') && this.polygonCoordinates.length >= 3) {
    // Convert to GeoJSON format (array of [lng, lat] pairs)
    // GeoJSON requires the first and last point to be the same to close the polygon
    const coordinates = this.polygonCoordinates.map(coord => [coord.lng, coord.lat]);
    
    // Close the polygon by adding the first point at the end if not already closed
    const firstPoint = coordinates[0];
    const lastPoint = coordinates[coordinates.length - 1];
    
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      coordinates.push([...firstPoint]);
    }
    
    this.geoJSON = {
      type: 'Polygon',
      coordinates: [coordinates],
    };
  }
  next();
});

// Pre-save middleware to format zone name
zoneSchema.pre('save', function(next) {
  if (this.isModified('zoneName')) {
    // Capitalize first letter of each word
    this.zoneName = this.zoneName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  next();
});

// Static method to find zone containing a point
zoneSchema.statics.findZoneContainingPoint = async function(lat, lng) {
  // First try using MongoDB geospatial query
  try {
    const zone = await this.findOne({
      isActive: true,
      isDeleted: { $ne: true },
      geoJSON: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat], // GeoJSON uses [lng, lat]
          },
        },
      },
    }).populate('city');
    
    if (zone) {
      return zone;
    }
  } catch (error) {
    console.error('Geospatial query failed, falling back to point-in-polygon:', error.message);
  }
  
  // Fallback to manual point-in-polygon check
  const { isPointInPolygon } = require('../utils/geoUtils');
  
  const zones = await this.find({
    isActive: true,
    isDeleted: { $ne: true },
  }).populate('city');
  
  for (const zone of zones) {
    if (zone.polygonCoordinates && zone.polygonCoordinates.length >= 3) {
      if (isPointInPolygon(lat, lng, zone.polygonCoordinates)) {
        return zone;
      }
    }
  }
  
  return null;
};

// Static method to get zones with provider count
zoneSchema.statics.getZonesWithProviderCount = async function(filter = {}) {
  const zones = await this.find({ ...filter, isDeleted: { $ne: true } })
    .populate('city', 'cityName state country')
    .sort({ createdAt: -1 })
    .lean();
  
  // Add id field and provider count (placeholder - implement when provider model is available)
  return zones.map(zone => ({
    ...zone,
    id: zone._id.toString(),
    cityId: zone.city?._id?.toString() || zone.city?.toString(),
    providersCount: 0, // TODO: Get actual provider count
  }));
};

// Use admin connection
let Zone;
try {
  const connection = getAdminConnection();
  if (connection) {
    Zone = connection.model('Zone', zoneSchema);
  } else {
    Zone = mongoose.model('Zone', zoneSchema);
  }
} catch (error) {
  console.error('Error creating Zone model:', error);
  Zone = mongoose.model('Zone', zoneSchema);
}

module.exports = Zone;