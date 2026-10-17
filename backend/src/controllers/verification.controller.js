const { getProviderConnection } = require('../config/database');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Helper to get the correct collection
const getVerificationCollection = () => {
  const providerConn = getProviderConnection();
  return providerConn.db.collection('provider_verifications');
};

const getProviderCollection = () => {
  const providerConn = getProviderConnection();
  return providerConn.db.collection('providers');
};

// Helper function to extract document URLs - FIXED FOR YOUR DATA STRUCTURE
const extractDocuments = (verification) => {
  console.log('🔍 Extracting documents from:', verification.documents);
  
  const docs = {
    selfie: null,
    aadhaarCard: null,
    panCard: null,
  };

  if (!verification.documents) {
    return docs;
  }

  // Your structure: documents.selfie is a STRING URL directly
  // documents.selfie: "https://res.cloudinary.com/..."
  
  // Handle selfie
  if (verification.documents.selfie) {
    if (typeof verification.documents.selfie === 'string') {
      // Direct URL string
      docs.selfie = {
        url: verification.documents.selfie,
        publicId: verification.cloudinaryIds?.selfie || null,
        uploadedAt: verification.submittedAt || verification.createdAt || new Date().toISOString(),
      };
    } else if (verification.documents.selfie.url) {
      // Object with url property
      docs.selfie = {
        url: verification.documents.selfie.url,
        publicId: verification.documents.selfie.publicId || verification.cloudinaryIds?.selfie || null,
        uploadedAt: verification.documents.selfie.uploadedAt || verification.submittedAt || verification.createdAt,
      };
    }
  }

  // Handle aadhaarCard (or aadhaar)
  if (verification.documents.aadhaarCard) {
    if (typeof verification.documents.aadhaarCard === 'string') {
      docs.aadhaarCard = {
        url: verification.documents.aadhaarCard,
        publicId: verification.cloudinaryIds?.aadhaarCard || null,
        uploadedAt: verification.submittedAt || verification.createdAt || new Date().toISOString(),
      };
    } else if (verification.documents.aadhaarCard.url) {
      docs.aadhaarCard = {
        url: verification.documents.aadhaarCard.url,
        publicId: verification.documents.aadhaarCard.publicId || verification.cloudinaryIds?.aadhaarCard || null,
        uploadedAt: verification.documents.aadhaarCard.uploadedAt || verification.submittedAt || verification.createdAt,
      };
    }
  } else if (verification.documents.aadhaar) {
    if (typeof verification.documents.aadhaar === 'string') {
      docs.aadhaarCard = {
        url: verification.documents.aadhaar,
        publicId: verification.cloudinaryIds?.aadhaar || null,
        uploadedAt: verification.submittedAt || verification.createdAt || new Date().toISOString(),
      };
    } else if (verification.documents.aadhaar.url) {
      docs.aadhaarCard = {
        url: verification.documents.aadhaar.url,
        publicId: verification.documents.aadhaar.publicId || verification.cloudinaryIds?.aadhaar || null,
        uploadedAt: verification.documents.aadhaar.uploadedAt || verification.submittedAt || verification.createdAt,
      };
    }
  }

  // Handle panCard (or pan)
  if (verification.documents.panCard) {
    if (typeof verification.documents.panCard === 'string') {
      docs.panCard = {
        url: verification.documents.panCard,
        publicId: verification.cloudinaryIds?.panCard || null,
        uploadedAt: verification.submittedAt || verification.createdAt || new Date().toISOString(),
      };
    } else if (verification.documents.panCard.url) {
      docs.panCard = {
        url: verification.documents.panCard.url,
        publicId: verification.documents.panCard.publicId || verification.cloudinaryIds?.panCard || null,
        uploadedAt: verification.documents.panCard.uploadedAt || verification.submittedAt || verification.createdAt,
      };
    }
  } else if (verification.documents.pan) {
    if (typeof verification.documents.pan === 'string') {
      docs.panCard = {
        url: verification.documents.pan,
        publicId: verification.cloudinaryIds?.pan || null,
        uploadedAt: verification.submittedAt || verification.createdAt || new Date().toISOString(),
      };
    } else if (verification.documents.pan.url) {
      docs.panCard = {
        url: verification.documents.pan.url,
        publicId: verification.documents.pan.publicId || verification.cloudinaryIds?.pan || null,
        uploadedAt: verification.documents.pan.uploadedAt || verification.submittedAt || verification.createdAt,
      };
    }
  }

  console.log('✅ Extracted documents:', docs);
  return docs;
};

// Get provider details by ID
const getProviderDetails = async (providerId) => {
  try {
    const providersCollection = getProviderCollection();
    
    let provider = null;
    
    // Try to find by ObjectId
    if (mongoose.Types.ObjectId.isValid(providerId)) {
      provider = await providersCollection.findOne({ 
        _id: new mongoose.Types.ObjectId(providerId) 
      });
    }
    
    // Try to find by providerId string
    if (!provider && typeof providerId === 'string') {
      provider = await providersCollection.findOne({ providerId: providerId });
    }
    
    if (provider) {
      return {
        _id: provider._id,
        providerId: provider.providerId || provider._id.toString(),
        name: provider.name || 'Unknown',
        email: provider.email || 'N/A',
        phone: provider.phone || 'N/A',
        profession: provider.profession || provider.service || 'N/A',
        profileImage: provider.profileImage || provider.profilePhoto || null,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching provider:', error);
    return null;
  }
};

// Get all verifications
exports.getAllVerifications = async (req, res, next) => {
  try {
    console.log('\n📋 ═══════════════════════════════════════');
    console.log('📋 Fetching all verifications from provider_verifications...');
    console.log('📋 ═══════════════════════════════════════');
    
    const { 
      page = 1, 
      limit = 20, 
      status, 
      search 
    } = req.query;

    const verificationCollection = getVerificationCollection();

    // Build query
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }

    // Count total
    const total = await verificationCollection.countDocuments(query);
    console.log('📊 Total verifications in provider_verifications:', total);

    // Fetch verifications
    const verifications = await verificationCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    console.log('📥 Fetched verifications:', verifications.length);

    // Transform verifications and populate provider details
    const transformedVerifications = await Promise.all(
      verifications.map(async (v) => {
        // Extract documents
        const documents = extractDocuments(v);
        
        // Get provider details
        let providerDetails = null;
        if (v.provider) {
          providerDetails = await getProviderDetails(v.provider);
        } else if (v.providerId) {
          providerDetails = await getProviderDetails(v.providerId);
        }
        
        const result = {
          _id: v._id,
          verificationId: v.verificationId || v._id.toString().slice(-8).toUpperCase(),
          provider: providerDetails || {
            _id: v.provider || v.providerId || 'unknown',
            providerId: 'N/A',
            name: v.providerName || 'Unknown Provider',
            email: v.providerEmail || 'N/A',
            phone: v.providerPhone || 'N/A',
            profession: v.profession || 'N/A',
            profileImage: null,
          },
          documents,
          status: v.status || v.verificationStatus || 'pending',
          reviewedBy: v.reviewedBy,
          reviewedAt: v.reviewedAt,
          rejectionReason: v.rejectionReason || v.reason || '',
          notes: v.notes || v.adminNotes || '',
          attempts: v.attempts || 1,
          createdAt: v.createdAt || v.submittedAt || new Date().toISOString(),
          updatedAt: v.updatedAt || new Date().toISOString(),
        };
        
        return result;
      })
    );

    // Calculate pagination
    const totalPages = Math.ceil(total / parseInt(limit));

    // Filter by search if provided
    let filteredVerifications = transformedVerifications;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredVerifications = transformedVerifications.filter(v => 
        v.provider?.name?.toLowerCase().includes(searchLower) ||
        v.provider?.email?.toLowerCase().includes(searchLower) ||
        v.provider?.phone?.includes(search) ||
        v.verificationId?.toLowerCase().includes(searchLower)
      );
    }

    console.log('✅ Returning verifications:', filteredVerifications.length);
    console.log('📄 First verification documents:', filteredVerifications[0]?.documents);

    res.json({
      success: true,
      data: {
        verifications: filteredVerifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error fetching verifications:', error);
    logger.error('Error fetching verifications:', error);
    next(error);
  }
};

// Get pending verifications
exports.getPendingVerifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const verificationCollection = getVerificationCollection();

    const query = { 
      status: { $in: ['pending', 'submitted', 'under_review'] } 
    };
    
    const total = await verificationCollection.countDocuments(query);
    
    const verifications = await verificationCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    const transformedVerifications = await Promise.all(
      verifications.map(async (v) => {
        const documents = extractDocuments(v);
        
        let providerDetails = null;
        if (v.provider) {
          providerDetails = await getProviderDetails(v.provider);
        }
        
        return {
          _id: v._id,
          verificationId: v.verificationId || v._id.toString().slice(-8).toUpperCase(),
          provider: providerDetails || { name: 'Unknown', email: 'N/A', phone: 'N/A' },
          documents,
          status: v.status || 'pending',
          createdAt: v.createdAt || v.submittedAt,
          updatedAt: v.updatedAt,
        };
      })
    );

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        verifications: transformedVerifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching pending verifications:', error);
    next(error);
  }
};

// Get verification by ID
exports.getVerificationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const verificationCollection = getVerificationCollection();

    let verification = null;
    
    if (mongoose.Types.ObjectId.isValid(id)) {
      verification = await verificationCollection.findOne({ 
        _id: new mongoose.Types.ObjectId(id) 
      });
    }

    if (!verification) {
      throw ApiError.notFound('Verification not found');
    }

    const documents = extractDocuments(verification);
    
    let providerDetails = null;
    if (verification.provider) {
      providerDetails = await getProviderDetails(verification.provider);
    }

    const transformedVerification = {
      _id: verification._id,
      verificationId: verification.verificationId || verification._id.toString().slice(-8).toUpperCase(),
      provider: providerDetails || { name: 'Unknown', email: 'N/A', phone: 'N/A' },
      documents,
      status: verification.status || 'pending',
      reviewedBy: verification.reviewedBy,
      reviewedAt: verification.reviewedAt,
      rejectionReason: verification.rejectionReason || '',
      notes: verification.notes || verification.adminNotes || '',
      attempts: verification.attempts || 1,
      createdAt: verification.createdAt || verification.submittedAt,
      updatedAt: verification.updatedAt,
    };

    res.json({
      success: true,
      data: {
        verification: transformedVerification,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Approve verification
exports.approveVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    console.log('✅ Approving verification:', id);

    const verificationCollection = getVerificationCollection();
    const providersCollection = getProviderCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid verification ID');
    }

    const verification = await verificationCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    if (!verification) {
      throw ApiError.notFound('Verification not found');
    }

    if (verification.status === 'approved') {
      throw ApiError.badRequest('Verification already approved');
    }

    // Update verification
    await verificationCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          status: 'approved',
          reviewedBy: req.admin.adminId,
          reviewedAt: new Date(),
          notes: notes || '',
          updatedAt: new Date(),
        }
      }
    );

    // Update provider status
    if (verification.provider) {
      await providersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(verification.provider) },
        {
          $set: {
            verificationStatus: 'approved',
            isVerified: true,
            verifiedAt: new Date(),
            verifiedBy: req.admin.adminId,
          }
        }
      );
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('verification-updated', {
        verificationId: id,
        status: 'approved',
      });
    }

    logger.info(`Verification approved: ${id} by ${req.admin.email}`);

    res.json({
      success: true,
      message: 'Verification approved successfully',
      data: {
        verification: {
          _id: id,
          status: 'approved',
          reviewedAt: new Date(),
        },
      },
    });
  } catch (error) {
    logger.error('Error approving verification:', error);
    next(error);
  }
};

// Reject verification
exports.rejectVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      throw ApiError.badRequest('Rejection reason is required');
    }

    console.log('❌ Rejecting verification:', id);

    const verificationCollection = getVerificationCollection();
    const providersCollection = getProviderCollection();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid verification ID');
    }

    const verification = await verificationCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    if (!verification) {
      throw ApiError.notFound('Verification not found');
    }

    if (verification.status === 'rejected') {
      throw ApiError.badRequest('Verification already rejected');
    }

    // Update verification
    await verificationCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          status: 'rejected',
          reviewedBy: req.admin.adminId,
          reviewedAt: new Date(),
          rejectionReason: rejectionReason,
          updatedAt: new Date(),
        }
      }
    );

    // Update provider status
    if (verification.provider) {
      await providersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(verification.provider) },
        {
          $set: {
            verificationStatus: 'rejected',
            isVerified: false,
            rejectedAt: new Date(),
            rejectedBy: req.admin.adminId,
            rejectionReason: rejectionReason,
          }
        }
      );
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('verification-updated', {
        verificationId: id,
        status: 'rejected',
      });
    }

    logger.info(`Verification rejected: ${id} by ${req.admin.email}`);

    res.json({
      success: true,
      message: 'Verification rejected successfully',
      data: {
        verification: {
          _id: id,
          status: 'rejected',
          rejectionReason,
          reviewedAt: new Date(),
        },
      },
    });
  } catch (error) {
    logger.error('Error rejecting verification:', error);
    next(error);
  }
};

// Get verification stats
exports.getVerificationStats = async (req, res, next) => {
  try {
    const verificationCollection = getVerificationCollection();
    
    const [pending, approved, rejected, total] = await Promise.all([
      verificationCollection.countDocuments({ status: { $in: ['pending', 'submitted', 'under_review'] } }),
      verificationCollection.countDocuments({ status: 'approved' }),
      verificationCollection.countDocuments({ status: 'rejected' }),
      verificationCollection.countDocuments(),
    ]);

    console.log('📊 Verification stats from provider_verifications:', { pending, approved, rejected, total });

    res.json({
      success: true,
      data: {
        pending,
        approved,
        rejected,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Debug endpoint - View raw data
exports.debugVerifications = async (req, res, next) => {
  try {
    const providerConn = getProviderConnection();
    
    // List all collections
    const collections = await providerConn.db.listCollections().toArray();
    console.log('\n📦 Collections:', collections.map(c => c.name));
    
    // Get raw data from provider_verifications
    const pvCollection = providerConn.db.collection('provider_verifications');
    const pvData = await pvCollection.find({}).limit(5).toArray();
    console.log('\n📄 provider_verifications sample:', JSON.stringify(pvData[0], null, 2));
    
    // Test document extraction
    if (pvData.length > 0) {
      const extractedDocs = extractDocuments(pvData[0]);
      console.log('✅ Extracted documents:', extractedDocs);
    }
    
    // Get providers sample
    const pCollection = providerConn.db.collection('providers');
    const pData = await pCollection.find({}).limit(3).toArray();
    
    res.json({
      success: true,
      data: {
        collections: collections.map(c => c.name),
        provider_verifications: {
          count: await pvCollection.countDocuments(),
          sample: pvData,
          extractedDocuments: pvData.length > 0 ? extractDocuments(pvData[0]) : null,
        },
        providers: {
          count: await pCollection.countDocuments(),
          sample: pData.map(p => ({
            _id: p._id,
            name: p.name,
            email: p.email,
            phone: p.phone,
            verificationStatus: p.verificationStatus,
          })),
        },
      },
    });
  } catch (error) {
    console.error('Debug error:', error);
    next(error);
  }
};