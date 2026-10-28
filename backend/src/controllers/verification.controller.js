const { getProviderConnection } = require('../config/database');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// ========= Optional dependencies (safe require) =========
let fcmService = null;
try {
  fcmService = require('../services/fcmService');
} catch (e) {
  logger.warn('fcmService not loaded in verification.controller');
}

let AdminNotification = null;
try {
  AdminNotification = require('../models/AdminNotification');
} catch (e) {
  logger.warn('AdminNotification model not loaded');
}

let AuditLog = null;
try {
  AuditLog = require('../models/AuditLog');
} catch (e) {
  logger.warn('AuditLog model not loaded');
}

// ================== COLLECTION HELPERS ==================
const getVerificationCollection = () => {
  const providerConn = getProviderConnection();
  return providerConn.db.collection('provider_verifications');
};

const getProviderCollection = () => {
  const providerConn = getProviderConnection();
  return providerConn.db.collection('providers');
};

// ================== DOCUMENT EXTRACTION ==================
/**
 * Extract documents from verification record in a NORMALIZED format.
 * Supports both legacy formats AND the current actual DB structure:
 *   documents: { selfie, panCard, aadhaarFront, aadhaarBack } (strings)
 *   cloudinaryIds: { selfie, panCard, aadhaarFront, aadhaarBack }
 */
const extractDocuments = (verification) => {
  const docs = {
    selfie: null,
    panCard: null,
    aadhaarFront: null,
    aadhaarBack: null,
  };

  if (!verification || !verification.documents) return docs;

  const d = verification.documents;
  const cids = verification.cloudinaryIds || {};
  const submittedAt = verification.submittedAt || verification.createdAt || new Date();

  const normalize = (field, publicIdField) => {
    const value = d[field];
    if (!value) return null;

    if (typeof value === 'string') {
      return {
        url: value,
        publicId: cids[publicIdField] || null,
        uploadedAt: submittedAt,
      };
    }
    if (typeof value === 'object' && value.url) {
      return {
        url: value.url,
        publicId: value.publicId || cids[publicIdField] || null,
        uploadedAt: value.uploadedAt || submittedAt,
      };
    }
    return null;
  };

  docs.selfie = normalize('selfie', 'selfie');
  docs.panCard = normalize('panCard', 'panCard') || normalize('pan', 'pan');
  docs.aadhaarFront = normalize('aadhaarFront', 'aadhaarFront');
  docs.aadhaarBack = normalize('aadhaarBack', 'aadhaarBack');

  // Legacy fallback: single aadhaarCard => map to aadhaarFront
  if (!docs.aadhaarFront && d.aadhaarCard) {
    docs.aadhaarFront = normalize('aadhaarCard', 'aadhaarCard');
  }

  return docs;
};

// ================== PROVIDER DETAILS ==================
const getProviderDetails = async (providerIdOrObj) => {
  try {
    const providersCollection = getProviderCollection();
    let provider = null;

    const id = providerIdOrObj?.toString ? providerIdOrObj.toString() : providerIdOrObj;

    if (mongoose.Types.ObjectId.isValid(id)) {
      provider = await providersCollection.findOne({
        _id: new mongoose.Types.ObjectId(id),
      });
    }
    if (!provider && typeof id === 'string') {
      provider = await providersCollection.findOne({ providerId: id });
    }

    if (!provider) return null;

    return {
      _id: provider._id,
      providerId: provider.providerId || provider._id.toString(),
      name: provider.name || 'Unknown',
      email: provider.email || 'N/A',
      phone: provider.phone || 'N/A',
      profession: provider.profession || 'N/A',
      categoryName: provider.categoryName || null,
      city: provider.city || null,
      gender: provider.gender || null,
      profilePicture:
        provider.profilePicture ||
        provider.profileImage ||
        provider.profilePhoto ||
        null,
      verificationStatus: provider.verificationStatus || 'pending',
      isVerified: !!provider.isVerified,
      isActive: provider.isActive !== false,
      fcmToken: provider.fcmToken || null,
    };
  } catch (error) {
    logger.error('Error fetching provider:', error);
    return null;
  }
};

// ================== AUDIT / NOTIFICATIONS ==================
const createAuditLog = async ({ action, adminId, adminEmail, targetId, metadata }) => {
  if (!AuditLog) return;
  try {
    await AuditLog.create({
      action,
      performedBy: adminId,
      performedByEmail: adminEmail,
      targetType: 'Verification',
      targetId,
      metadata,
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error('Audit log error:', err.message);
  }
};

const createAdminNotification = async ({ title, message, type, metadata }) => {
  if (!AdminNotification) return;
  try {
    await AdminNotification.create({
      title,
      message,
      type,
      metadata,
      isRead: false,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.error('Admin notification error:', err.message);
  }
};

const sendProviderFCM = async (fcmToken, title, body, data = {}) => {
  if (!fcmService || !fcmToken) return;
  try {
    await fcmService.sendToToken(fcmToken, {
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    });
  } catch (err) {
    logger.error('FCM send error:', err.message);
  }
};

// ================== TRANSFORMER ==================
const transformVerification = async (v) => {
  const documents = extractDocuments(v);
  let providerDetails = null;
  if (v.provider) providerDetails = await getProviderDetails(v.provider);
  else if (v.providerId) providerDetails = await getProviderDetails(v.providerId);

  return {
    _id: v._id,
    verificationId: v.verificationId || v._id.toString().slice(-8).toUpperCase(),
    provider: providerDetails || {
      _id: v.provider || v.providerId || 'unknown',
      providerId: 'N/A',
      name: 'Unknown Provider',
      email: 'N/A',
      phone: 'N/A',
      profession: 'N/A',
      profilePicture: null,
    },
    documents,
    documentNumbers: v.documentNumbers || { panNumber: '', aadhaarNumber: '' },
    status: v.status || 'pending',
    reviewedBy: v.reviewedBy || null,
    reviewedAt: v.reviewedAt || null,
    rejectionReason: v.rejectionReason || '',
    notes: v.notes || '',
    attempts: v.attempts || 1,
    statusHistory: v.statusHistory || [],
    submittedAt: v.submittedAt || v.createdAt,
    createdAt: v.createdAt || v.submittedAt,
    updatedAt: v.updatedAt,
  };
};

// ================== ROUTES ==================

// GET all verifications (with filters, search, pagination, sort)
exports.getAllVerifications = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate,
    } = req.query;

    const verificationCollection = getVerificationCollection();
    const query = {};

    if (status && status !== 'all') {
      if (status === 'pending') {
        query.status = { $in: ['pending', 'under_review'] };
      } else {
        query.status = status;
      }
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search by verificationId directly in Mongo
    if (search && /^[A-Z]{3}\d+$/i.test(search)) {
      query.verificationId = { $regex: search, $options: 'i' };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const total = await verificationCollection.countDocuments(query);
    const verifications = await verificationCollection
      .find(query)
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    let transformed = await Promise.all(verifications.map(transformVerification));

    // Secondary search filter (name, email, phone, providerId)
    if (search && !/^[A-Z]{3}\d+$/i.test(search)) {
      const s = search.toLowerCase();
      transformed = transformed.filter(
        (v) =>
          v.provider?.name?.toLowerCase().includes(s) ||
          v.provider?.email?.toLowerCase().includes(s) ||
          v.provider?.phone?.includes(search) ||
          v.provider?.providerId?.toLowerCase().includes(s) ||
          v.verificationId?.toLowerCase().includes(s)
      );
    }

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        verifications: transformed,
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
    logger.error('Error fetching verifications:', error);
    next(error);
  }
};

// GET pending verifications
exports.getPendingVerifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const verificationCollection = getVerificationCollection();

    const query = { status: { $in: ['pending', 'under_review'] } };
    const total = await verificationCollection.countDocuments(query);

    const verifications = await verificationCollection
      .find(query)
      .sort({ submittedAt: -1, createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    const transformed = await Promise.all(verifications.map(transformVerification));
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        verifications: transformed,
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

// GET verification by ID
exports.getVerificationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const verificationCollection = getVerificationCollection();

    let verification = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      verification = await verificationCollection.findOne({
        _id: new mongoose.Types.ObjectId(id),
      });
    }
    if (!verification) {
      verification = await verificationCollection.findOne({ verificationId: id });
    }

    if (!verification) throw ApiError.notFound('Verification not found');

    const transformed = await transformVerification(verification);

    res.json({
      success: true,
      data: { verification: transformed },
    });
  } catch (error) {
    next(error);
  }
};

// GET verifications by provider ID (all history for one provider)
exports.getVerificationsByProvider = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const verificationCollection = getVerificationCollection();

    const query = {};
    if (mongoose.Types.ObjectId.isValid(providerId)) {
      query.provider = new mongoose.Types.ObjectId(providerId);
    } else {
      // Try provider's providerId field (e.g. PEL37) by resolving to _id
      const providersCollection = getProviderCollection();
      const p = await providersCollection.findOne({ providerId });
      if (p) query.provider = p._id;
    }

    const verifications = await verificationCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const transformed = await Promise.all(verifications.map(transformVerification));

    res.json({
      success: true,
      data: {
        verifications: transformed,
        total: transformed.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Shared core: apply status change
const applyStatusChange = async ({
  verificationCollection,
  providersCollection,
  verification,
  newStatus,
  admin,
  notes,
  rejectionReason,
}) => {
  const now = new Date();
  const adminId = admin?.adminId || admin?._id || admin?.id;
  const adminEmail = admin?.email || 'unknown';
  const adminName = admin?.name || adminEmail;

  const historyEntry = {
    status: newStatus,
    changedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
    changedByName: adminName,
    reason: rejectionReason || '',
    notes: notes || '',
    changedAt: now,
  };

  const verificationUpdate = {
    status: newStatus,
    reviewedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
    reviewedAt: now,
    updatedAt: now,
  };
  if (notes !== undefined) verificationUpdate.notes = notes || '';
  if (newStatus === 'rejected') {
    verificationUpdate.rejectionReason = rejectionReason || 'No reason provided';
  } else if (newStatus === 'approved') {
    verificationUpdate.rejectionReason = '';
  }

  await verificationCollection.updateOne(
    { _id: verification._id },
    {
      $set: verificationUpdate,
      $push: { statusHistory: historyEntry },
    }
  );

  // ================== Sync Provider ==================
  if (verification.provider) {
    const providerUpdate = { updatedAt: now };
    const providerObjId = new mongoose.Types.ObjectId(verification.provider);

    if (newStatus === 'approved') {
      providerUpdate.verificationStatus = 'approved';
      providerUpdate.isVerified = true;
      providerUpdate.verifiedAt = now;
      providerUpdate.verifiedBy = adminId ? String(adminId) : null;
      providerUpdate.rejectionReason = '';

      // Sync selfie as profile picture
      const docs = extractDocuments(verification);
      if (docs.selfie?.url) {
        providerUpdate.profilePicture = docs.selfie.url;
        providerUpdate.selfieImage = {
          url: docs.selfie.url,
          publicId: docs.selfie.publicId,
          uploadedAt: docs.selfie.uploadedAt || now,
        };
      }
    } else if (newStatus === 'rejected') {
      providerUpdate.verificationStatus = 'rejected';
      providerUpdate.isVerified = false;
      providerUpdate.rejectedAt = now;
      providerUpdate.rejectedBy = adminId ? String(adminId) : null;
      providerUpdate.rejectionReason = rejectionReason || 'No reason provided';
      providerUpdate.isAvailable = false;
      providerUpdate.isAcceptingJobs = false;
    } else if (newStatus === 'pending' || newStatus === 'under_review') {
      providerUpdate.verificationStatus = 'pending';
      providerUpdate.isVerified = false;
    } else if (newStatus === 'resubmission_required') {
      providerUpdate.verificationStatus = 'incomplete';
      providerUpdate.isVerified = false;
      providerUpdate.rejectionReason = rejectionReason || 'Please resubmit documents';
    }

    await providersCollection.updateOne({ _id: providerObjId }, { $set: providerUpdate });
  }
};

// POST approve
exports.approveVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const verificationCollection = getVerificationCollection();
    const providersCollection = getProviderCollection();

    if (!mongoose.Types.ObjectId.isValid(id))
      throw ApiError.badRequest('Invalid verification ID');

    const verification = await verificationCollection.findOne({
      _id: new mongoose.Types.ObjectId(id),
    });
    if (!verification) throw ApiError.notFound('Verification not found');
    if (verification.status === 'approved')
      throw ApiError.badRequest('Verification already approved');

    await applyStatusChange({
      verificationCollection,
      providersCollection,
      verification,
      newStatus: 'approved',
      admin: req.admin,
      notes,
    });

    // Fetch provider for FCM
    const provider = verification.provider
      ? await providersCollection.findOne({
          _id: new mongoose.Types.ObjectId(verification.provider),
        })
      : null;

    // FCM to provider
    if (provider?.fcmToken) {
      await sendProviderFCM(
        provider.fcmToken,
        '✅ Verification Approved',
        'Congratulations! Your account has been verified. You can now start accepting jobs.',
        {
          type: 'verification_approved',
          verificationId: id,
          status: 'approved',
        }
      );
    }

    // Admin notification
    await createAdminNotification({
      title: 'Verification Approved',
      message: `Provider ${provider?.name || 'Unknown'} (${provider?.providerId || ''}) has been approved.`,
      type: 'verification_approved',
      metadata: { verificationId: id, providerId: verification.provider },
    });

    // Audit log
    await createAuditLog({
      action: 'VERIFICATION_APPROVED',
      adminId: req.admin?.adminId || req.admin?._id,
      adminEmail: req.admin?.email,
      targetId: id,
      metadata: { notes },
    });

    // Socket emit
    const io = req.app.get('io');
    if (io) {
      io.emit('verification:updated', {
        verificationId: id,
        status: 'approved',
        providerId: verification.provider,
      });
      io.to('admins').emit('verification:approved', {
        verificationId: id,
        providerId: verification.provider,
      });
    }

    logger.info(`Verification approved: ${id} by ${req.admin?.email}`);

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

// POST reject
exports.rejectVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason, notes } = req.body;

    if (!rejectionReason || !rejectionReason.trim())
      throw ApiError.badRequest('Rejection reason is required');

    const verificationCollection = getVerificationCollection();
    const providersCollection = getProviderCollection();

    if (!mongoose.Types.ObjectId.isValid(id))
      throw ApiError.badRequest('Invalid verification ID');

    const verification = await verificationCollection.findOne({
      _id: new mongoose.Types.ObjectId(id),
    });
    if (!verification) throw ApiError.notFound('Verification not found');
    if (verification.status === 'rejected')
      throw ApiError.badRequest('Verification already rejected');

    await applyStatusChange({
      verificationCollection,
      providersCollection,
      verification,
      newStatus: 'rejected',
      admin: req.admin,
      notes,
      rejectionReason,
    });

    const provider = verification.provider
      ? await providersCollection.findOne({
          _id: new mongoose.Types.ObjectId(verification.provider),
        })
      : null;

    if (provider?.fcmToken) {
      await sendProviderFCM(
        provider.fcmToken,
        '❌ Verification Rejected',
        `Your verification was rejected. Reason: ${rejectionReason}`,
        {
          type: 'verification_rejected',
          verificationId: id,
          status: 'rejected',
          rejectionReason,
        }
      );
    }

    await createAdminNotification({
      title: 'Verification Rejected',
      message: `Provider ${provider?.name || 'Unknown'} (${provider?.providerId || ''}) rejected. Reason: ${rejectionReason}`,
      type: 'verification_rejected',
      metadata: { verificationId: id, providerId: verification.provider, rejectionReason },
    });

    await createAuditLog({
      action: 'VERIFICATION_REJECTED',
      adminId: req.admin?.adminId || req.admin?._id,
      adminEmail: req.admin?.email,
      targetId: id,
      metadata: { rejectionReason, notes },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('verification:updated', {
        verificationId: id,
        status: 'rejected',
        providerId: verification.provider,
        rejectionReason,
      });
      io.to('admins').emit('verification:rejected', {
        verificationId: id,
        providerId: verification.provider,
        rejectionReason,
      });
    }

    logger.info(`Verification rejected: ${id} by ${req.admin?.email}`);

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

// POST request resubmission
exports.requestResubmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    if (!reason) throw ApiError.badRequest('Reason is required');

    const verificationCollection = getVerificationCollection();
    const providersCollection = getProviderCollection();

    if (!mongoose.Types.ObjectId.isValid(id))
      throw ApiError.badRequest('Invalid verification ID');

    const verification = await verificationCollection.findOne({
      _id: new mongoose.Types.ObjectId(id),
    });
    if (!verification) throw ApiError.notFound('Verification not found');

    await applyStatusChange({
      verificationCollection,
      providersCollection,
      verification,
      newStatus: 'resubmission_required',
      admin: req.admin,
      notes,
      rejectionReason: reason,
    });

    const provider = verification.provider
      ? await providersCollection.findOne({
          _id: new mongoose.Types.ObjectId(verification.provider),
        })
      : null;

    if (provider?.fcmToken) {
      await sendProviderFCM(
        provider.fcmToken,
        '📝 Resubmission Required',
        `Please resubmit your documents. ${reason}`,
        {
          type: 'verification_resubmission',
          verificationId: id,
          reason,
        }
      );
    }

    await createAuditLog({
      action: 'VERIFICATION_RESUBMISSION_REQUESTED',
      adminId: req.admin?.adminId || req.admin?._id,
      adminEmail: req.admin?.email,
      targetId: id,
      metadata: { reason, notes },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('verification:updated', {
        verificationId: id,
        status: 'resubmission_required',
        providerId: verification.provider,
      });
    }

    res.json({
      success: true,
      message: 'Resubmission requested successfully',
      data: { _id: id, status: 'resubmission_required' },
    });
  } catch (error) {
    next(error);
  }
};

// POST mark as under review
exports.markUnderReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const verificationCollection = getVerificationCollection();
    const providersCollection = getProviderCollection();

    if (!mongoose.Types.ObjectId.isValid(id))
      throw ApiError.badRequest('Invalid verification ID');

    const verification = await verificationCollection.findOne({
      _id: new mongoose.Types.ObjectId(id),
    });
    if (!verification) throw ApiError.notFound('Verification not found');

    await applyStatusChange({
      verificationCollection,
      providersCollection,
      verification,
      newStatus: 'under_review',
      admin: req.admin,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('verification:updated', {
        verificationId: id,
        status: 'under_review',
        providerId: verification.provider,
      });
    }

    res.json({
      success: true,
      message: 'Verification marked as under review',
      data: { _id: id, status: 'under_review' },
    });
  } catch (error) {
    next(error);
  }
};

// POST bulk approve
exports.bulkApprove = async (req, res, next) => {
  try {
    const { verificationIds, notes } = req.body;
    if (!Array.isArray(verificationIds) || verificationIds.length === 0) {
      throw ApiError.badRequest('verificationIds array is required');
    }

    const verificationCollection = getVerificationCollection();
    const providersCollection = getProviderCollection();

    const results = { approved: [], failed: [] };

    for (const id of verificationIds) {
      try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          results.failed.push({ id, error: 'Invalid ID' });
          continue;
        }
        const verification = await verificationCollection.findOne({
          _id: new mongoose.Types.ObjectId(id),
        });
        if (!verification) {
          results.failed.push({ id, error: 'Not found' });
          continue;
        }
        if (verification.status === 'approved') {
          results.failed.push({ id, error: 'Already approved' });
          continue;
        }
        await applyStatusChange({
          verificationCollection,
          providersCollection,
          verification,
          newStatus: 'approved',
          admin: req.admin,
          notes,
        });

        // FCM
        if (verification.provider) {
          const provider = await providersCollection.findOne({
            _id: new mongoose.Types.ObjectId(verification.provider),
          });
          if (provider?.fcmToken) {
            await sendProviderFCM(
              provider.fcmToken,
              '✅ Verification Approved',
              'Your account has been verified.',
              { type: 'verification_approved', verificationId: id }
            );
          }
        }
        results.approved.push(id);
      } catch (err) {
        results.failed.push({ id, error: err.message });
      }
    }

    await createAuditLog({
      action: 'VERIFICATION_BULK_APPROVED',
      adminId: req.admin?.adminId || req.admin?._id,
      adminEmail: req.admin?.email,
      targetId: 'bulk',
      metadata: { count: results.approved.length, failed: results.failed.length },
    });

    const io = req.app.get('io');
    if (io) io.emit('verification:bulk_updated', { approved: results.approved });

    res.json({
      success: true,
      message: `${results.approved.length} verifications approved, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// POST bulk reject
exports.bulkReject = async (req, res, next) => {
  try {
    const { verificationIds, rejectionReason } = req.body;
    if (!Array.isArray(verificationIds) || verificationIds.length === 0) {
      throw ApiError.badRequest('verificationIds array is required');
    }
    if (!rejectionReason) throw ApiError.badRequest('Rejection reason required');

    const verificationCollection = getVerificationCollection();
    const providersCollection = getProviderCollection();

    const results = { rejected: [], failed: [] };

    for (const id of verificationIds) {
      try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          results.failed.push({ id, error: 'Invalid ID' });
          continue;
        }
        const verification = await verificationCollection.findOne({
          _id: new mongoose.Types.ObjectId(id),
        });
        if (!verification) {
          results.failed.push({ id, error: 'Not found' });
          continue;
        }
        if (verification.status === 'rejected') {
          results.failed.push({ id, error: 'Already rejected' });
          continue;
        }
        await applyStatusChange({
          verificationCollection,
          providersCollection,
          verification,
          newStatus: 'rejected',
          admin: req.admin,
          rejectionReason,
        });

        if (verification.provider) {
          const provider = await providersCollection.findOne({
            _id: new mongoose.Types.ObjectId(verification.provider),
          });
          if (provider?.fcmToken) {
            await sendProviderFCM(
              provider.fcmToken,
              '❌ Verification Rejected',
              `Your verification was rejected. Reason: ${rejectionReason}`,
              { type: 'verification_rejected', verificationId: id, rejectionReason }
            );
          }
        }
        results.rejected.push(id);
      } catch (err) {
        results.failed.push({ id, error: err.message });
      }
    }

    await createAuditLog({
      action: 'VERIFICATION_BULK_REJECTED',
      adminId: req.admin?.adminId || req.admin?._id,
      adminEmail: req.admin?.email,
      targetId: 'bulk',
      metadata: { count: results.rejected.length, failed: results.failed.length, rejectionReason },
    });

    const io = req.app.get('io');
    if (io) io.emit('verification:bulk_updated', { rejected: results.rejected });

    res.json({
      success: true,
      message: `${results.rejected.length} verifications rejected, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// GET stats
exports.getVerificationStats = async (req, res, next) => {
  try {
    const verificationCollection = getVerificationCollection();

    const [pending, underReview, approved, rejected, resubmission, total, todayCount, weekCount] =
      await Promise.all([
        verificationCollection.countDocuments({ status: 'pending' }),
        verificationCollection.countDocuments({ status: 'under_review' }),
        verificationCollection.countDocuments({ status: 'approved' }),
        verificationCollection.countDocuments({ status: 'rejected' }),
        verificationCollection.countDocuments({ status: 'resubmission_required' }),
        verificationCollection.countDocuments({}),
        verificationCollection.countDocuments({
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        }),
        verificationCollection.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
      ]);

    res.json({
      success: true,
      data: {
        pending,
        underReview,
        approved,
        rejected,
        resubmission,
        total,
        todayCount,
        weekCount,
        pendingTotal: pending + underReview,
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE verification (admin only)
exports.deleteVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const verificationCollection = getVerificationCollection();

    if (!mongoose.Types.ObjectId.isValid(id))
      throw ApiError.badRequest('Invalid verification ID');

    const result = await verificationCollection.deleteOne({
      _id: new mongoose.Types.ObjectId(id),
    });

    if (result.deletedCount === 0) throw ApiError.notFound('Verification not found');

    await createAuditLog({
      action: 'VERIFICATION_DELETED',
      adminId: req.admin?.adminId || req.admin?._id,
      adminEmail: req.admin?.email,
      targetId: id,
      metadata: {},
    });

    const io = req.app.get('io');
    if (io) io.emit('verification:deleted', { verificationId: id });

    res.json({
      success: true,
      message: 'Verification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// DEBUG endpoint
exports.debugVerifications = async (req, res, next) => {
  try {
    const providerConn = getProviderConnection();
    const collections = await providerConn.db.listCollections().toArray();
    const pvCollection = providerConn.db.collection('provider_verifications');
    const pvData = await pvCollection.find({}).limit(5).toArray();

    res.json({
      success: true,
      data: {
        collections: collections.map((c) => c.name),
        provider_verifications: {
          count: await pvCollection.countDocuments(),
          sample: pvData,
          extractedDocuments: pvData.length > 0 ? extractDocuments(pvData[0]) : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};