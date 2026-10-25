// src/models/AuditLog.js
const mongoose = require('mongoose');
const { getAdminConnection } = require('../config/database');

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },

    performedBy: {
      id: String,
      name: String,
      email: String,
      role: String,
    },

    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    previousState: { type: mongoose.Schema.Types.Mixed, default: null },
    newState: { type: mongoose.Schema.Types.Mixed, default: null },

    ipAddress: String,
    userAgent: String,
    reason: String,

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

let AuditLogModel = null;

function getAuditLogModel() {
  if (AuditLogModel) return AuditLogModel;
  const conn = getAdminConnection();
  if (!conn) throw new Error('Admin DB connection not ready');
  AuditLogModel = conn.models.AuditLog || conn.model('AuditLog', auditLogSchema, 'auditlogs');
  return AuditLogModel;
}

module.exports = { getAuditLogModel, auditLogSchema };