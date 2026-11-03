import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Mail, Send, Save, Clock, Users, Briefcase, Globe, MapPin, Building2,
  AlertCircle, CheckCircle, Loader2, Image as ImageIcon,
  Tag, X, Smartphone, MessageSquare, Zap, Eye, Code,
  Palette, Monitor, Tablet, Sparkles, Copy,
  Bell, Search, Download, RotateCcw, Columns, Star, Paperclip, MoreVertical,
  Reply, Forward, Archive, Trash2, Printer, ChevronDown,
} from 'lucide-react';
import { apiClient } from '../../lib/api';

/* ═══════════════════════════════════════════════════════════════════
   THEME SYSTEM (6 themes, reads from localStorage)
   ═══════════════════════════════════════════════════════════════════ */
type ThemeName = 'light' | 'dark' | 'purple' | 'ocean' | 'forest' | 'sunset';

interface Theme {
  bgPage: string;
  bgCard: string;
  bgInput: string;
  bgHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryDark: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  gradHeader: string;
  ring: string;
}

const THEMES: Record<ThemeName, Theme> = {
  light: {
    bgPage: 'bg-gray-50', bgCard: 'bg-white', bgInput: 'bg-gray-50', bgHover: 'hover:bg-gray-100',
    textPrimary: 'text-gray-900', textSecondary: 'text-gray-600', textMuted: 'text-gray-400',
    border: 'border-gray-200', primary: '#6366f1', primaryDark: '#4f46e5',
    accent: '#ec4899', success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
    gradHeader: 'from-indigo-500 to-purple-600', ring: 'focus:ring-indigo-500',
  },
  dark: {
    bgPage: 'bg-gray-950', bgCard: 'bg-gray-900', bgInput: 'bg-gray-800', bgHover: 'hover:bg-gray-800',
    textPrimary: 'text-gray-100', textSecondary: 'text-gray-400', textMuted: 'text-gray-600',
    border: 'border-gray-800', primary: '#818cf8', primaryDark: '#6366f1',
    accent: '#f472b6', success: '#34d399', danger: '#f87171', warning: '#fbbf24',
    gradHeader: 'from-indigo-600 to-purple-700', ring: 'focus:ring-indigo-500',
  },
  purple: {
    bgPage: 'bg-[#0c0515]', bgCard: 'bg-[#1a0a2e]', bgInput: 'bg-[#25103d]', bgHover: 'hover:bg-[#25103d]',
    textPrimary: 'text-purple-100', textSecondary: 'text-purple-300', textMuted: 'text-purple-500',
    border: 'border-purple-800/50', primary: '#a855f7', primaryDark: '#9333ea',
    accent: '#ec4899', success: '#4ade80', danger: '#f87171', warning: '#fbbf24',
    gradHeader: 'from-purple-600 to-fuchsia-700', ring: 'focus:ring-purple-500',
  },
  ocean: {
    bgPage: 'bg-[#021526]', bgCard: 'bg-[#0a2540]', bgInput: 'bg-[#0d3156]', bgHover: 'hover:bg-[#0d3156]',
    textPrimary: 'text-cyan-100', textSecondary: 'text-cyan-300', textMuted: 'text-cyan-600',
    border: 'border-cyan-800/40', primary: '#06b6d4', primaryDark: '#0891b2',
    accent: '#0ea5e9', success: '#34d399', danger: '#f87171', warning: '#fbbf24',
    gradHeader: 'from-cyan-600 to-blue-700', ring: 'focus:ring-cyan-500',
  },
  forest: {
    bgPage: 'bg-[#052e16]', bgCard: 'bg-[#14532d]', bgInput: 'bg-[#166534]', bgHover: 'hover:bg-[#166534]',
    textPrimary: 'text-green-100', textSecondary: 'text-green-300', textMuted: 'text-green-600',
    border: 'border-green-800/40', primary: '#22c55e', primaryDark: '#16a34a',
    accent: '#84cc16', success: '#4ade80', danger: '#f87171', warning: '#fbbf24',
    gradHeader: 'from-green-600 to-emerald-700', ring: 'focus:ring-green-500',
  },
  sunset: {
    bgPage: 'bg-[#1c0a00]', bgCard: 'bg-[#3b1506]', bgInput: 'bg-[#4d1d08]', bgHover: 'hover:bg-[#4d1d08]',
    textPrimary: 'text-orange-100', textSecondary: 'text-orange-300', textMuted: 'text-orange-600',
    border: 'border-orange-800/40', primary: '#f97316', primaryDark: '#ea580c',
    accent: '#ef4444', success: '#4ade80', danger: '#f87171', warning: '#facc15',
    gradHeader: 'from-orange-600 to-red-700', ring: 'focus:ring-orange-500',
  },
};

function getTheme(): ThemeName {
  try {
    const s = localStorage.getItem('admin-theme') as ThemeName;
    if (s && THEMES[s]) return s;
  } catch {}
  return 'dark';
}

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
type Channel = 'email' | 'push' | 'sms' | 'in_app' | 'all';
type Priority = 'low' | 'normal' | 'high' | 'urgent';
type Audience = 'all' | 'all_users' | 'all_providers' | 'specific_users' | 'specific_providers' | 'by_city' | 'by_zone';
type EmailTemplate = 'welcome' | 'promo' | 'announcement' | 'alert' | 'newsletter' | 'invoice' | 'custom';
type PreviewMode = 'gmail' | 'mobile' | 'html' | 'split';

interface EmailBlock {
  heading?: string;
  subheading?: string;
  bodyText: string;
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  footerText?: string;
  brandColor: string;
  brandName: string;
  logoUrl?: string;
  signature?: string;
}

interface NotificationForm {
  title: string;
  body: string;
  subject: string;              // email subject
  type: Channel;
  priority: Priority;
  targetAudience: Audience;
  targetIds: string[];
  targetCities: string[];
  targetZones: string[];
  scheduledAt: string;
  actionUrl: string;
  imageUrl: string;
  tags: string[];
  /* email-specific */
  emailTemplate: EmailTemplate;
  emailBlock: EmailBlock;
  emailHtml: string;            // final generated HTML
  useCustomHtml: boolean;
}

interface City { _id: string; name?: string; cityName?: string; }
interface Zone { _id: string; name?: string; zoneName?: string; cityId: string; }

/* ═══════════════════════════════════════════════════════════════════
   DEFAULT STATE
   ═══════════════════════════════════════════════════════════════════ */
const DEFAULT_BLOCK: EmailBlock = {
  heading: 'Welcome to our platform! 🎉',
  subheading: 'We are thrilled to have you with us',
  bodyText: 'Thank you for joining us. We are committed to providing you with the best service experience. Click the button below to get started with your journey.',
  ctaText: 'Get Started',
  ctaUrl: 'https://example.com',
  imageUrl: '',
  footerText: 'You received this email because you signed up on our platform.',
  brandColor: '#6366f1',
  brandName: 'Your Brand',
  logoUrl: '',
  signature: 'The Team',
};

const INITIAL_FORM: NotificationForm = {
  title: '',
  body: '',
  subject: '',
  type: 'email',
  priority: 'normal',
  targetAudience: 'all',
  targetIds: [],
  targetCities: [],
  targetZones: [],
  scheduledAt: '',
  actionUrl: '',
  imageUrl: '',
  tags: [],
  emailTemplate: 'welcome',
  emailBlock: { ...DEFAULT_BLOCK },
  emailHtml: '',
  useCustomHtml: false,
};

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function escapeHtml(s = ''): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function escapeAttr(s = ''): string { return escapeHtml(s); }
function nl2br(s = ''): string { return s.replace(/\n/g, '<br/>'); }
function darken(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - Math.floor(255 * pct / 100));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.floor(255 * pct / 100));
  const b = Math.max(0, (n & 0xff) - Math.floor(255 * pct / 100));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
function lighten(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (n >> 16) + Math.floor(255 * pct / 100));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.floor(255 * pct / 100));
  const b = Math.min(255, (n & 0xff) + Math.floor(255 * pct / 100));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/* ═══════════════════════════════════════════════════════════════════
   PROFESSIONAL HTML EMAIL TEMPLATES (2026 modern design)
   All bulletproof — inline CSS, email-client-safe
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────── 1. WELCOME — Modern glassy hero with floating card ─────────── */
function buildWelcomeTemplate(b: EmailBlock): string {
  const c = b.brandColor;
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<title>${escapeHtml(b.heading || '')}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(b.subheading || b.heading || '')}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f1f5f9;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="640" style="max-width:640px;">
      <!-- Pre-header spacer -->
      <tr><td style="padding-bottom:16px;text-align:center;">
        <span style="color:#94a3b8;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;font-weight:600;">${escapeHtml(b.brandName)}</span>
      </td></tr>
      <!-- Main card -->
      <tr><td style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px -12px rgba(15,23,42,0.15),0 0 0 1px rgba(15,23,42,0.04);">
        <!-- Gradient hero -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr><td style="background:linear-gradient(135deg,${c} 0%,${darken(c, 20)} 50%,${darken(c, 35)} 100%);padding:56px 32px 72px;text-align:center;position:relative;">
            ${b.logoUrl ? `<img src="${escapeAttr(b.logoUrl)}" alt="${escapeAttr(b.brandName)}" width="72" height="72" style="width:72px;height:72px;border-radius:18px;margin-bottom:24px;box-shadow:0 10px 30px rgba(0,0,0,0.2);" />` : `<div style="width:72px;height:72px;border-radius:18px;background:rgba(255,255,255,0.2);margin:0 auto 24px;line-height:72px;font-size:32px;">✨</div>`}
            <div style="display:inline-block;background:rgba(255,255,255,0.18);color:#ffffff;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px;">Welcome aboard</div>
            <h1 style="margin:0 0 12px;color:#ffffff;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-0.6px;">${escapeHtml(b.heading || '')}</h1>
            ${b.subheading ? `<p style="margin:0;color:rgba(255,255,255,0.9);font-size:17px;line-height:1.5;max-width:460px;margin-left:auto;margin-right:auto;">${escapeHtml(b.subheading)}</p>` : ''}
          </td></tr>
        </table>
        <!-- Body card (overlaps hero) -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:-32px;">
          <tr><td style="padding:0 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#ffffff;border-radius:16px;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
              <tr><td style="padding:36px;">
                ${b.imageUrl ? `<img src="${escapeAttr(b.imageUrl)}" alt="" width="100%" style="width:100%;border-radius:12px;margin-bottom:28px;display:block;" />` : ''}
                <p style="margin:0 0 28px;color:#334155;font-size:16px;line-height:1.75;">${nl2br(escapeHtml(b.bodyText))}</p>
                ${b.ctaText && b.ctaUrl ? `
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;"><tr><td style="border-radius:12px;background:${c};">
                  <a href="${escapeAttr(b.ctaUrl)}" style="display:inline-block;padding:16px 40px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;border-radius:12px;box-shadow:0 10px 24px -8px ${c};">${escapeHtml(b.ctaText)} →</a>
                </td></tr></table>` : ''}
              </td></tr>
            </table>
          </td></tr>
        </table>
        <!-- Features strip -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:32px;">
          <tr><td style="padding:0 32px 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding:12px;width:33%;">
                  <div style="width:44px;height:44px;background:${lighten(c, 45)};border-radius:12px;margin:0 auto 8px;line-height:44px;font-size:20px;">⚡</div>
                  <p style="margin:0;color:#0f172a;font-size:13px;font-weight:700;">Fast</p>
                  <p style="margin:2px 0 0;color:#64748b;font-size:11px;">Lightning quick</p>
                </td>
                <td align="center" style="padding:12px;width:33%;">
                  <div style="width:44px;height:44px;background:${lighten(c, 45)};border-radius:12px;margin:0 auto 8px;line-height:44px;font-size:20px;">🔒</div>
                  <p style="margin:0;color:#0f172a;font-size:13px;font-weight:700;">Secure</p>
                  <p style="margin:2px 0 0;color:#64748b;font-size:11px;">Bank-level encryption</p>
                </td>
                <td align="center" style="padding:12px;width:33%;">
                  <div style="width:44px;height:44px;background:${lighten(c, 45)};border-radius:12px;margin:0 auto 8px;line-height:44px;font-size:20px;">💎</div>
                  <p style="margin:0;color:#0f172a;font-size:13px;font-weight:700;">Premium</p>
                  <p style="margin:2px 0 0;color:#64748b;font-size:11px;">Top-tier quality</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
        <!-- Divider -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr><td style="padding:0 32px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>
        </table>
        <!-- Signature -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr><td style="padding:28px 32px;">
            <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6;">Warm regards,<br/><strong style="color:#0f172a;font-size:15px;">${escapeHtml(b.signature || b.brandName)}</strong></p>
          </td></tr>
        </table>
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:24px 16px;text-align:center;">
        <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;line-height:1.6;">${escapeHtml(b.footerText || '')}</p>
        <p style="margin:0;color:#cbd5e1;font-size:11px;">© ${new Date().getFullYear()} ${escapeHtml(b.brandName)}. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/* ─────────── 2. PROMO — Bold neon gradient, sale-focused ─────────── */
function buildPromoTemplate(b: EmailBlock): string {
  const c = b.brandColor;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(b.heading || '')}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;"><tr><td align="center">
  <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 30px 60px -20px rgba(0,0,0,0.5);">
    <!-- Flash sale banner -->
    <tr><td style="background:linear-gradient(90deg,${c},#ec4899,#f59e0b);padding:14px;text-align:center;">
      <p style="margin:0;color:#ffffff;font-size:12px;font-weight:800;letter-spacing:2px;">⚡ FLASH SALE · LIMITED TIME ONLY ⚡</p>
    </td></tr>
    <!-- Hero -->
    <tr><td style="background:linear-gradient(135deg,${c} 0%,#ec4899 100%);padding:60px 40px 80px;text-align:center;position:relative;">
      <div style="display:inline-block;background:rgba(255,255,255,0.25);color:#fff;padding:8px 20px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:2px;margin-bottom:24px;backdrop-filter:blur(10px);">🎁 EXCLUSIVE OFFER</div>
      <h1 style="margin:0 0 16px;color:#ffffff;font-size:48px;font-weight:900;line-height:1.05;letter-spacing:-1.5px;text-shadow:0 4px 20px rgba(0,0,0,0.2);">${escapeHtml(b.heading || '')}</h1>
      ${b.subheading ? `<p style="margin:0;color:rgba(255,255,255,0.95);font-size:20px;font-weight:500;line-height:1.4;">${escapeHtml(b.subheading)}</p>` : ''}
    </td></tr>
    ${b.imageUrl ? `<tr><td style="padding:0;"><img src="${escapeAttr(b.imageUrl)}" alt="" width="620" style="width:100%;display:block;" /></td></tr>` : ''}
    <!-- Body -->
    <tr><td style="padding:48px 40px 24px;text-align:center;">
      <p style="margin:0;color:#1e293b;font-size:18px;line-height:1.7;font-weight:500;">${nl2br(escapeHtml(b.bodyText))}</p>
    </td></tr>
    ${b.ctaText && b.ctaUrl ? `
    <tr><td align="center" style="padding:16px 40px 48px;">
      <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:linear-gradient(135deg,${c},#ec4899);">
        <a href="${escapeAttr(b.ctaUrl)}" style="display:inline-block;padding:20px 56px;color:#ffffff;text-decoration:none;font-weight:800;font-size:18px;letter-spacing:0.5px;border-radius:999px;box-shadow:0 15px 35px -10px ${c};">${escapeHtml(b.ctaText)} →</a>
      </td></tr></table>
      <p style="margin:16px 0 0;color:#64748b;font-size:12px;">⏱️ Hurry! Offer ends soon</p>
    </td></tr>` : ''}
    <!-- Trust badges -->
    <tr><td style="padding:0 40px 32px;">
      <table width="100%" style="background:#f8fafc;border-radius:16px;padding:20px;"><tr>
        <td align="center" style="width:33%;"><p style="margin:0;color:#059669;font-size:20px;">✓</p><p style="margin:4px 0 0;color:#334155;font-size:12px;font-weight:600;">Free Shipping</p></td>
        <td align="center" style="width:33%;"><p style="margin:0;color:#059669;font-size:20px;">✓</p><p style="margin:4px 0 0;color:#334155;font-size:12px;font-weight:600;">30-Day Returns</p></td>
        <td align="center" style="width:33%;"><p style="margin:0;color:#059669;font-size:20px;">✓</p><p style="margin:4px 0 0;color:#334155;font-size:12px;font-weight:600;">Secure Checkout</p></td>
      </tr></table>
    </td></tr>
    <!-- Footer -->
    <tr><td style="background:#0f172a;padding:32px 40px;text-align:center;">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">${escapeHtml(b.footerText || '')}</p>
      <p style="margin:12px 0 0;color:#64748b;font-size:11px;">© ${new Date().getFullYear()} ${escapeHtml(b.brandName)}</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

/* ─────────── 3. ANNOUNCEMENT — Editorial magazine style ─────────── */
function buildAnnouncementTemplate(b: EmailBlock): string {
  const c = b.brandColor;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8" />
<title>${escapeHtml(b.heading || '')}</title></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:'Playfair Display',Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;"><tr><td align="center">
  <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;box-shadow:0 10px 40px rgba(0,0,0,0.06);">
    <tr><td style="border-top:8px solid ${c};padding:48px 56px 24px;text-align:left;">
      <table width="100%"><tr>
        <td><p style="margin:0;color:${c};font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;font-family:-apple-system,sans-serif;">${escapeHtml(b.brandName)} · Official Announcement</p></td>
        <td align="right"><p style="margin:0;color:#78716c;font-size:12px;font-family:-apple-system,sans-serif;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 56px 24px;">
      <h1 style="margin:0;color:#1c1917;font-size:42px;font-weight:700;line-height:1.15;letter-spacing:-1px;">${escapeHtml(b.heading || '')}</h1>
      ${b.subheading ? `<p style="margin:16px 0 0;color:#57534e;font-size:19px;font-style:italic;line-height:1.5;">${escapeHtml(b.subheading)}</p>` : ''}
    </td></tr>
    ${b.imageUrl ? `<tr><td style="padding:16px 0;"><img src="${escapeAttr(b.imageUrl)}" alt="" width="620" style="width:100%;display:block;" /></td></tr>` : ''}
    <tr><td style="padding:24px 56px 32px;">
      <!-- Drop cap first letter -->
      <p style="margin:0;color:#292524;font-size:17px;line-height:1.85;">${nl2br(escapeHtml(b.bodyText))}</p>
    </td></tr>
    ${b.ctaText && b.ctaUrl ? `
    <tr><td style="padding:0 56px 48px;">
      <table cellpadding="0" cellspacing="0"><tr><td style="border:2px solid ${c};">
        <a href="${escapeAttr(b.ctaUrl)}" style="display:inline-block;padding:14px 36px;color:${c};text-decoration:none;font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-family:-apple-system,sans-serif;">${escapeHtml(b.ctaText)}</a>
      </td></tr></table>
    </td></tr>` : ''}
    <tr><td style="padding:28px 56px;background:#fafaf9;border-top:1px solid #e7e5e4;">
      <table width="100%"><tr>
        <td><p style="margin:0;color:#1c1917;font-size:14px;font-weight:600;font-family:-apple-system,sans-serif;">${escapeHtml(b.signature || b.brandName)}</p></td>
        <td align="right"><p style="margin:0;color:#78716c;font-size:12px;font-family:-apple-system,sans-serif;">${escapeHtml(b.footerText || '')}</p></td>
      </tr></table>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;color:#a8a29e;font-size:11px;font-family:-apple-system,sans-serif;">© ${new Date().getFullYear()} ${escapeHtml(b.brandName)}</p>
</td></tr></table></body></html>`;
}

/* ─────────── 4. ALERT — Urgent, high-contrast security alert ─────────── */
function buildAlertTemplate(b: EmailBlock): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8" />
<title>${escapeHtml(b.heading || '')}</title></head>
<body style="margin:0;padding:0;background:#fef2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px -10px rgba(220,38,38,0.25);border:1px solid #fecaca;">
    <!-- Red pulse header -->
    <tr><td style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:24px 32px;">
      <table width="100%"><tr>
        <td width="56" valign="middle"><div style="width:56px;height:56px;background:rgba(255,255,255,0.25);border-radius:50%;text-align:center;line-height:56px;font-size:28px;border:2px solid rgba(255,255,255,0.4);">⚠️</div></td>
        <td style="padding-left:16px;" valign="middle">
          <p style="margin:0;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Critical Alert</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;">From ${escapeHtml(b.brandName)} Security Team</p>
        </td>
      </tr></table>
    </td></tr>
    <!-- Body -->
    <tr><td style="padding:40px 36px 20px;">
      <h2 style="margin:0;color:#7f1d1d;font-size:26px;font-weight:800;line-height:1.3;letter-spacing:-0.5px;">${escapeHtml(b.heading || '')}</h2>
      ${b.subheading ? `<p style="margin:12px 0 0;color:#991b1b;font-size:16px;line-height:1.5;">${escapeHtml(b.subheading)}</p>` : ''}
    </td></tr>
    <tr><td style="padding:0 36px 28px;">
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:20px;border-radius:0 10px 10px 0;">
        <p style="margin:0;color:#450a0a;font-size:15px;line-height:1.75;font-weight:500;">${nl2br(escapeHtml(b.bodyText))}</p>
      </div>
    </td></tr>
    ${b.ctaText && b.ctaUrl ? `
    <tr><td align="center" style="padding:0 36px 36px;">
      <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#dc2626;">
        <a href="${escapeAttr(b.ctaUrl)}" style="display:inline-block;padding:16px 40px;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:0.5px;border-radius:10px;box-shadow:0 10px 25px -8px #dc2626;">${escapeHtml(b.ctaText)}</a>
      </td></tr></table>
      <p style="margin:12px 0 0;color:#991b1b;font-size:12px;font-weight:600;">⏱️ Action required within 24 hours</p>
    </td></tr>` : ''}
    <!-- Help info -->
    <tr><td style="background:#fef2f2;padding:20px 36px;border-top:1px solid #fecaca;">
      <p style="margin:0 0 6px;color:#7f1d1d;font-size:12px;font-weight:700;">Need help?</p>
      <p style="margin:0;color:#991b1b;font-size:12px;line-height:1.5;">${escapeHtml(b.footerText || 'Contact our support team if you did not initiate this request.')}</p>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;color:#991b1b;font-size:11px;">© ${new Date().getFullYear()} ${escapeHtml(b.brandName)} Security</p>
</td></tr></table></body></html>`;
}

/* ─────────── 5. NEWSLETTER — Editorial multi-section ─────────── */
function buildNewsletterTemplate(b: EmailBlock): string {
  const c = b.brandColor;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8" />
<title>${escapeHtml(b.heading || '')}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
  <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;box-shadow:0 10px 40px rgba(0,0,0,0.08);">
    <!-- Masthead -->
    <tr><td style="padding:32px 40px;border-bottom:4px double ${c};">
      <table width="100%"><tr>
        <td>${b.logoUrl ? `<img src="${escapeAttr(b.logoUrl)}" alt="${escapeAttr(b.brandName)}" height="44" style="height:44px;display:block;" />` : `<h2 style="margin:0;color:${c};font-size:28px;font-weight:900;letter-spacing:-0.5px;">${escapeHtml(b.brandName)}</h2>`}
          <p style="margin:4px 0 0;color:#64748b;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">The Weekly Digest</p>
        </td>
        <td align="right"><p style="margin:0;color:#64748b;font-size:13px;font-weight:600;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">Issue #${Math.floor(Math.random() * 100 + 1)}</p>
        </td>
      </tr></table>
    </td></tr>
    ${b.imageUrl ? `<tr><td><img src="${escapeAttr(b.imageUrl)}" alt="" width="640" style="width:100%;display:block;" /></td></tr>` : ''}
    <!-- Feature article -->
    <tr><td style="padding:40px 40px 20px;">
      <p style="margin:0 0 12px;color:${c};font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">★ Featured Story</p>
      <h1 style="margin:0;color:#0f172a;font-size:32px;font-weight:800;line-height:1.25;letter-spacing:-0.6px;">${escapeHtml(b.heading || '')}</h1>
      ${b.subheading ? `<p style="margin:12px 0 0;color:#475569;font-size:17px;line-height:1.5;">${escapeHtml(b.subheading)}</p>` : ''}
    </td></tr>
    <tr><td style="padding:16px 40px 28px;">
      <p style="margin:0;color:#334155;font-size:16px;line-height:1.8;">${nl2br(escapeHtml(b.bodyText))}</p>
    </td></tr>
    ${b.ctaText && b.ctaUrl ? `
    <tr><td style="padding:0 40px 32px;">
      <a href="${escapeAttr(b.ctaUrl)}" style="color:${c};font-weight:700;text-decoration:none;font-size:15px;border-bottom:2px solid ${c};padding-bottom:2px;">${escapeHtml(b.ctaText)} →</a>
    </td></tr>` : ''}
    <!-- Section divider -->
    <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>
    <!-- Secondary stories -->
    <tr><td style="padding:28px 40px;">
      <p style="margin:0 0 16px;color:${c};font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Also in this issue</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px;vertical-align:top;width:50%;">
          <div style="background:#f8fafc;border-radius:12px;padding:16px;">
            <p style="margin:0 0 6px;color:#64748b;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Updates</p>
            <p style="margin:0;color:#0f172a;font-size:14px;font-weight:700;line-height:1.4;">What's new this week</p>
          </div>
        </td>
        <td style="padding-left:12px;vertical-align:top;width:50%;">
          <div style="background:#f8fafc;border-radius:12px;padding:16px;">
            <p style="margin:0 0 6px;color:#64748b;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Community</p>
            <p style="margin:0;color:#0f172a;font-size:14px;font-weight:700;line-height:1.4;">Highlights from members</p>
          </div>
        </td>
      </tr></table>
    </td></tr>
    <!-- Footer -->
    <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
      <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">${escapeHtml(b.brandName)}</p>
      <p style="margin:8px 0 16px;color:#94a3b8;font-size:12px;line-height:1.6;">${escapeHtml(b.footerText || '')}</p>
      <p style="margin:0;color:#64748b;font-size:11px;">© ${new Date().getFullYear()} ${escapeHtml(b.brandName)} · All rights reserved</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

/* ─────────── 6. INVOICE — Clean receipt / transactional ─────────── */
function buildInvoiceTemplate(b: EmailBlock): string {
  const c = b.brandColor;
  const invoiceNum = Math.floor(Math.random() * 90000 + 10000);
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8" />
<title>${escapeHtml(b.heading || '')}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.08);">
    <!-- Header -->
    <tr><td style="background:${c};padding:32px 40px;">
      <table width="100%"><tr>
        <td>${b.logoUrl ? `<img src="${escapeAttr(b.logoUrl)}" alt="${escapeAttr(b.brandName)}" height="40" style="height:40px;" />` : `<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">${escapeHtml(b.brandName)}</h1>`}</td>
        <td align="right">
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Receipt</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:16px;font-weight:800;">#INV-${invoiceNum}</p>
        </td>
      </tr></table>
    </td></tr>
    <!-- Success badge -->
    <tr><td style="padding:40px 40px 16px;text-align:center;">
      <div style="display:inline-block;width:64px;height:64px;background:#dcfce7;border-radius:50%;line-height:64px;font-size:32px;margin-bottom:16px;">✅</div>
      <h2 style="margin:0;color:#0f172a;font-size:26px;font-weight:800;line-height:1.3;letter-spacing:-0.5px;">${escapeHtml(b.heading || '')}</h2>
      ${b.subheading ? `<p style="margin:8px 0 0;color:#64748b;font-size:15px;">${escapeHtml(b.subheading)}</p>` : ''}
    </td></tr>
    <!-- Body / details -->
    <tr><td style="padding:20px 40px;">
      <div style="background:#f8fafc;border-radius:14px;padding:28px;border:1px solid #e2e8f0;">
        <p style="margin:0;color:#334155;font-size:15px;line-height:1.75;">${nl2br(escapeHtml(b.bodyText))}</p>
      </div>
    </td></tr>
    <!-- Meta table -->
    <tr><td style="padding:16px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;"><span style="color:#64748b;font-size:13px;">Date</span></td><td align="right" style="padding:12px 0;border-bottom:1px solid #f1f5f9;"><span style="color:#0f172a;font-size:13px;font-weight:600;">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></td></tr>
        <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;"><span style="color:#64748b;font-size:13px;">Reference</span></td><td align="right" style="padding:12px 0;border-bottom:1px solid #f1f5f9;"><span style="color:#0f172a;font-size:13px;font-weight:600;font-family:monospace;">INV-${invoiceNum}</span></td></tr>
        <tr><td style="padding:12px 0;"><span style="color:#64748b;font-size:13px;">Status</span></td><td align="right" style="padding:12px 0;"><span style="display:inline-block;background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Completed</span></td></tr>
      </table>
    </td></tr>
    ${b.ctaText && b.ctaUrl ? `
    <tr><td align="center" style="padding:16px 40px 40px;">
      <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${c};">
        <a href="${escapeAttr(b.ctaUrl)}" style="display:inline-block;padding:14px 36px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;">${escapeHtml(b.ctaText)}</a>
      </td></tr></table>
    </td></tr>` : ''}
    <!-- Footer -->
    <tr><td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">${escapeHtml(b.footerText || '')}</p>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:11px;">© ${new Date().getFullYear()} ${escapeHtml(b.brandName)}</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

function generateEmailHtml(tpl: EmailTemplate, block: EmailBlock): string {
  switch (tpl) {
    case 'welcome': return buildWelcomeTemplate(block);
    case 'promo': return buildPromoTemplate(block);
    case 'announcement': return buildAnnouncementTemplate(block);
    case 'alert': return buildAlertTemplate(block);
    case 'newsletter': return buildNewsletterTemplate(block);
    case 'invoice': return buildInvoiceTemplate(block);
    default: return buildWelcomeTemplate(block);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   TEMPLATE PRESET DEFINITIONS (for the gallery)
   ═══════════════════════════════════════════════════════════════════ */
const TEMPLATE_GALLERY: { id: EmailTemplate; name: string; desc: string; emoji: string; color: string; preset: Partial<EmailBlock> }[] = [
  { id: 'welcome', name: 'Welcome', desc: 'Greet new users warmly', emoji: '👋', color: '#6366f1',
    preset: { heading: 'Welcome aboard! 🎉', subheading: 'Great to have you with us', bodyText: 'Thanks for joining. We built this platform to make your life easier. Explore all the features we have to offer.', ctaText: 'Get Started' } },
  { id: 'promo', name: 'Promotion', desc: 'Sales, discounts, offers', emoji: '🎁', color: '#ec4899',
    preset: { heading: 'Flat 50% OFF!', subheading: 'Limited time only — grab it now', bodyText: 'Our biggest sale of the year is here. Enjoy exclusive discounts on all your favorite products. Hurry, offer ends soon!', ctaText: 'Shop Now' } },
  { id: 'announcement', name: 'Announcement', desc: 'News & company updates', emoji: '📢', color: '#0ea5e9',
    preset: { heading: 'Big News from Our Team', subheading: 'Something exciting is coming', bodyText: 'We are thrilled to announce a major update to our platform. New features, improved performance, and much more.', ctaText: 'Read More' } },
  { id: 'alert', name: 'Alert', desc: 'Urgent, warnings, security', emoji: '⚠️', color: '#dc2626',
    preset: { heading: 'Action Required', subheading: 'Please review this important notice', bodyText: 'We detected unusual activity on your account. Please verify your identity immediately to secure your account.', ctaText: 'Verify Now' } },
  { id: 'newsletter', name: 'Newsletter', desc: 'Weekly/monthly digest', emoji: '📰', color: '#8b5cf6',
    preset: { heading: 'This Week in Review', subheading: 'Your weekly digest is here', bodyText: 'Catch up on the latest news, updates, and stories from our community. We have handpicked the best content just for you.', ctaText: 'Read Full Issue' } },
  { id: 'invoice', name: 'Invoice', desc: 'Receipts, payments, billing', emoji: '🧾', color: '#059669',
    preset: { heading: 'Payment Received', subheading: 'Thank you for your payment', bodyText: 'We have received your payment successfully. Your transaction has been processed and your account has been updated.', ctaText: 'View Receipt' } },
  { id: 'custom', name: 'Custom HTML', desc: 'Write your own HTML', emoji: '💻', color: '#f59e0b', preset: {} },
];

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function NotificationSender() {
  const [themeName, setThemeName] = useState<ThemeName>(getTheme);
  const t = THEMES[themeName];

  useEffect(() => {
    const iv = setInterval(() => {
      const n = getTheme();
      setThemeName(prev => (prev !== n ? n : prev));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const [form, setForm] = useState<NotificationForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showScheduler, setShowScheduler] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('gmail');
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [customHtml, setCustomHtml] = useState('');
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [editableHtml, setEditableHtml] = useState('');
  const htmlEditorRef = useRef<HTMLTextAreaElement>(null);

  /* ── Auto-generate email HTML whenever block or template changes ── */
  const generatedHtml = useMemo(() => {
    if (form.useCustomHtml) return customHtml || '<p>Enter your custom HTML…</p>';
    if (showHtmlEditor && editableHtml) return editableHtml;
    return generateEmailHtml(form.emailTemplate, form.emailBlock);
  }, [form.emailTemplate, form.emailBlock, form.useCustomHtml, customHtml, showHtmlEditor, editableHtml]);

  /* ── Keep form.emailHtml in sync (used when submitting) ── */
  useEffect(() => {
    setForm(prev => ({ ...prev, emailHtml: generatedHtml }));
  }, [generatedHtml]);

  /* ── When user opens HTML editor, seed it with current template HTML ── */
  useEffect(() => {
    if (showHtmlEditor && !editableHtml) {
      setEditableHtml(generateEmailHtml(form.emailTemplate, form.emailBlock));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHtmlEditor]);

  /* ── Fetch cities & zones ── */
  useEffect(() => {
    (async () => {
      try {
        const r = await apiClient.get('/admin/cities');
        if (r.data?.success) setCities(r.data.data?.cities || r.data.data || []);
      } catch (e) { console.warn('cities fetch failed', e); }
      try {
        const r = await apiClient.get('/admin/zones');
        if (r.data?.success) setZones(r.data.data?.zones || r.data.data || []);
      } catch (e) { console.warn('zones fetch failed', e); }
    })();
  }, []);

  /* ── Handlers ── */
  const upd = (k: keyof NotificationForm, v: any) => {
    setForm(p => ({ ...p, [k]: v }));
    setError(null); setSuccess(null);
  };
  const updBlock = (k: keyof EmailBlock, v: any) => {
    setForm(p => ({ ...p, emailBlock: { ...p.emailBlock, [k]: v } }));
  };
  const applyTemplatePreset = (tpl: EmailTemplate) => {
    const preset = TEMPLATE_GALLERY.find(x => x.id === tpl);
    if (!preset) return;
    setForm(p => ({
      ...p,
      emailTemplate: tpl,
      useCustomHtml: tpl === 'custom',
      emailBlock: { ...p.emailBlock, ...preset.preset, brandColor: preset.color || p.emailBlock.brandColor },
    }));
    setEditableHtml(''); // reset editor so it reseeds from new template
    setShowHtmlEditor(false);
    setShowTemplateGallery(false);
  };

  const handleAddTag = () => {
    const v = tagInput.trim();
    if (v && !form.tags.includes(v)) upd('tags', [...form.tags, v]);
    setTagInput('');
  };

  const handleMultiSelectChange = (name: 'targetCities' | 'targetZones', value: string) => {
    const current = form[name];
    upd(name, current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  };

  const validate = (): string | null => {
    if (!form.title.trim() && form.type !== 'email') return 'Title is required';
    if (form.type === 'email') {
      if (!form.subject.trim()) return 'Email subject is required';
      if (!form.emailBlock.heading?.trim() && !form.useCustomHtml && !showHtmlEditor) return 'Email heading is required';
    }
    if (!form.body.trim() && !form.emailBlock.bodyText.trim() && !form.useCustomHtml && !showHtmlEditor) return 'Body is required';
    return null;
  };

  const buildPayload = () => ({
    title: form.title || form.emailBlock.heading || form.subject,
    body: form.body || form.emailBlock.bodyText || 'Email content',
    subject: form.subject,
    type: form.type,
    priority: form.priority,
    targetAudience: form.targetAudience,
    targetIds: form.targetIds,
    targetCities: form.targetCities,
    targetZones: form.targetZones,
    scheduledAt: form.scheduledAt || undefined,
    actionUrl: form.actionUrl || form.emailBlock.ctaUrl,
    imageUrl: form.imageUrl || form.emailBlock.imageUrl,
    tags: form.tags,
    emailTemplate: form.emailTemplate,
    emailHtml: generatedHtml,
    emailBlock: form.emailBlock,
  });

  const handleSendNow = async () => {
    const v = validate(); if (v) { setError(v); return; }
    setSendingNow(true); setError(null);
    try {
      const r = await apiClient.post('/admin/notifications/send-now', buildPayload());
      if (r.data?.success) {
        setSuccess(`✅ Sent successfully! Delivered to ${r.data.data?.notification?.stats?.delivered || 0} recipients.`);
      } else setError(r.data?.message || 'Failed to send');
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Failed to send');
    } finally { setSendingNow(false); }
  };

  const handleSaveDraft = async () => {
    const v = validate(); if (v) { setError(v); return; }
    setLoading(true); setError(null);
    try {
      const r = await apiClient.post('/admin/notifications', buildPayload());
      if (r.data?.success) setSuccess('💾 Saved as draft');
      else setError(r.data?.message || 'Failed to save');
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const handleSchedule = async () => {
    if (!form.scheduledAt) { setError('Please select a scheduled time'); return; }
    const v = validate(); if (v) { setError(v); return; }
    setLoading(true); setError(null);
    try {
      const r = await apiClient.post('/admin/notifications', buildPayload());
      if (r.data?.success) {
        setSuccess(`⏰ Scheduled for ${new Date(form.scheduledAt).toLocaleString()}`);
        setShowScheduler(false);
      } else setError(r.data?.message || 'Failed to schedule');
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Failed to schedule');
    } finally { setLoading(false); }
  };

  const copyHtml = () => {
    navigator.clipboard.writeText(generatedHtml);
    setSuccess('📋 HTML copied to clipboard');
    setTimeout(() => setSuccess(null), 2000);
  };

  const downloadHtml = () => {
    const blob = new Blob([generatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.subject || 'email'}-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess('⬇️ HTML downloaded');
    setTimeout(() => setSuccess(null), 2000);
  };

  const resetHtmlToTemplate = () => {
    const fresh = generateEmailHtml(form.emailTemplate, form.emailBlock);
    setEditableHtml(fresh);
    setSuccess('🔄 HTML reset to template');
    setTimeout(() => setSuccess(null), 2000);
  };

  const filteredCities = cities.filter(c =>
    (c.cityName || c.name || '').toLowerCase().includes(citySearch.toLowerCase())
  );

  const isEmail = form.type === 'email' || form.type === 'all';
  const currentTpl = TEMPLATE_GALLERY.find(x => x.id === form.emailTemplate);
  const htmlLineCount = (editableHtml || generatedHtml).split('\n').length;

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className={`min-h-screen ${t.bgPage} p-4 md:p-6 transition-colors`}>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.gradHeader} flex items-center justify-center shadow-lg`}>
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl md:text-3xl font-bold ${t.textPrimary}`}>Email Campaign Sender</h1>
            <p className={`text-sm ${t.textSecondary}`}>Design beautiful emails & send to your audience</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEmail && (
            <button
              onClick={() => setShowHtmlEditor(!showHtmlEditor)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-sm ${
                showHtmlEditor ? 'text-white shadow-lg' : `${t.bgCard} ${t.textSecondary} border ${t.border}`
              }`}
              style={showHtmlEditor ? { background: t.primary } : {}}
            >
              <Code size={16} /> {showHtmlEditor ? 'Close HTML Editor' : 'Edit Raw HTML'}
            </button>
          )}
          <button
            onClick={() => setShowTemplateGallery(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white shadow-lg hover:scale-105 transition-all bg-gradient-to-r ${t.gradHeader}`}
          >
            <Sparkles size={18} /> Browse Templates
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-500">
          <AlertCircle size={20} /> <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={18} /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center gap-3 text-green-500">
          <CheckCircle size={20} /> <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess(null)}><X size={18} /></button>
        </div>
      )}

      {/* ═══════════ RAW HTML EDITOR (full-width split view) ═══════════ */}
      {showHtmlEditor && isEmail && (
        <div className={`${t.bgCard} rounded-2xl border ${t.border} mb-6 overflow-hidden`}>
          <div className={`flex items-center justify-between px-5 py-3 border-b ${t.border} bg-gradient-to-r ${t.gradHeader}`}>
            <div className="flex items-center gap-2 text-white">
              <Columns size={18} />
              <h2 className="font-bold">Raw HTML Editor · Split View</h2>
              <span className="text-xs opacity-80">({htmlLineCount} lines)</span>
            </div>
            <div className="flex gap-2">
              <button onClick={resetHtmlToTemplate} title="Reset to template"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-semibold hover:bg-white/30">
                <RotateCcw size={13} /> Reset
              </button>
              <button onClick={copyHtml} title="Copy HTML"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-semibold hover:bg-white/30">
                <Copy size={13} /> Copy
              </button>
              <button onClick={downloadHtml} title="Download .html"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-semibold hover:bg-white/30">
                <Download size={13} /> Download
              </button>
              <button onClick={() => setShowHtmlEditor(false)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-semibold hover:bg-white/30">
                <X size={13} /> Close
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Code editor */}
            <div className={`relative border-r ${t.border}`}>
              <div className={`absolute top-0 left-0 bottom-0 w-12 ${t.bgInput} border-r ${t.border} overflow-hidden text-right pt-3 pr-2 select-none`} style={{ pointerEvents: 'none' }}>
                {Array.from({ length: htmlLineCount }, (_, i) => (
                  <div key={i} className={`text-xs ${t.textMuted} font-mono leading-5`}>{i + 1}</div>
                ))}
              </div>
              <textarea
                ref={htmlEditorRef}
                value={editableHtml}
                onChange={e => setEditableHtml(e.target.value)}
                spellCheck={false}
                className={`w-full ${t.bgInput} ${t.textPrimary} font-mono text-xs leading-5 p-3 pl-14 focus:outline-none resize-none`}
                style={{ height: 600, tabSize: 2 }}
                placeholder="<html>...</html>"
              />
            </div>
            {/* Live preview */}
            <div className="bg-gray-200">
              <div className={`px-4 py-2 ${t.bgCard} border-b ${t.border} flex items-center gap-2`}>
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className={`text-xs ${t.textSecondary} ml-2`}>Live Preview</span>
              </div>
              <iframe title="html-editor-preview" srcDoc={editableHtml || generatedHtml} className="w-full bg-white" style={{ height: 557, border: 'none' }} />
            </div>
          </div>
          <div className={`px-5 py-3 border-t ${t.border} ${t.bgInput} text-xs ${t.textMuted} flex items-center gap-4`}>
            <span>💡 Tip: Use <code className={`px-1.5 py-0.5 rounded ${t.bgCard} font-mono`}>{'{{name}}'}</code> for recipient personalization</span>
            <span>·</span>
            <span>Changes apply instantly to the email that will be sent</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ═══════════ LEFT: EDITOR ═══════════ */}
        <div className="xl:col-span-3 space-y-6">

          {/* Current Template Badge */}
          {isEmail && currentTpl && (
            <div className={`${t.bgCard} rounded-2xl border ${t.border} p-4 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${currentTpl.color}22` }}>{currentTpl.emoji}</div>
                <div>
                  <div className={`text-xs ${t.textMuted} uppercase font-semibold tracking-wider`}>Current Template</div>
                  <div className={`font-bold ${t.textPrimary}`}>{currentTpl.name}</div>
                </div>
              </div>
              <button onClick={() => setShowTemplateGallery(true)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${t.bgHover} ${t.textSecondary} border ${t.border}`}>Change</button>
            </div>
          )}

          {/* Channel + Priority */}
          <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
            <h2 className={`text-lg font-bold ${t.textPrimary} mb-4 flex items-center gap-2`}>
              <Zap size={18} style={{ color: t.primary }} /> Delivery Settings
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              {([
                { v: 'email', l: 'Email', Icon: Mail },
                { v: 'push', l: 'Push', Icon: Smartphone },
                { v: 'sms', l: 'SMS', Icon: MessageSquare },
                { v: 'in_app', l: 'In-App', Icon: Bell },
                { v: 'all', l: 'All', Icon: Globe },
              ] as const).map(({ v, l, Icon }) => (
                <button
                  key={v}
                  onClick={() => upd('type', v)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    form.type === v ? 'text-white shadow-lg' : `${t.textSecondary} ${t.border} ${t.bgHover}`
                  }`}
                  style={form.type === v ? { background: t.primary, borderColor: t.primary } : {}}
                >
                  <Icon size={18} />
                  <span className="text-xs font-semibold">{l}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'normal', 'high', 'urgent'] as Priority[]).map(p => (
                <button key={p} onClick={() => upd('priority', p)}
                  className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    form.priority === p
                      ? p === 'urgent' ? 'bg-red-500 text-white' : p === 'high' ? 'bg-orange-500 text-white' : p === 'normal' ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'
                      : `${t.bgInput} ${t.textSecondary}`
                  }`}>{p}</button>
              ))}
            </div>
          </div>

          {/* Email Builder */}
          {isEmail && !form.useCustomHtml && (
            <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
              <h2 className={`text-lg font-bold ${t.textPrimary} mb-4 flex items-center gap-2`}>
                <Palette size={18} style={{ color: t.primary }} /> Email Content Builder
              </h2>

              <div className="space-y-4">
                {/* Subject */}
                <div>
                  <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>Email Subject *</label>
                  <input value={form.subject} onChange={e => upd('subject', e.target.value)}
                    placeholder="e.g. Welcome to our platform!"
                    className={`w-full px-4 py-3 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ring}`}
                    maxLength={200} />
                </div>

                {/* Brand */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>Brand Name</label>
                    <input value={form.emailBlock.brandName} onChange={e => updBlock('brandName', e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-lg ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ring} text-sm`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>Brand Color</label>
                    <div className="flex gap-2">
                      <input type="color" value={form.emailBlock.brandColor} onChange={e => updBlock('brandColor', e.target.value)}
                        className="w-12 h-10 rounded-lg border cursor-pointer" />
                      <input value={form.emailBlock.brandColor} onChange={e => updBlock('brandColor', e.target.value)}
                        className={`flex-1 px-3 py-2.5 rounded-lg ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none text-sm font-mono`} />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>Logo URL</label>
                    <input value={form.emailBlock.logoUrl || ''} onChange={e => updBlock('logoUrl', e.target.value)}
                      placeholder="https://..." className={`w-full px-3 py-2.5 rounded-lg ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none text-sm`} />
                  </div>
                </div>

                {/* Heading */}
                <div>
                  <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>Headline *</label>
                  <input value={form.emailBlock.heading || ''} onChange={e => updBlock('heading', e.target.value)}
                    placeholder="Welcome to our platform!"
                    className={`w-full px-4 py-3 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ring} text-lg font-bold`} />
                </div>

                {/* Subheading */}
                <div>
                  <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>Subheading</label>
                  <input value={form.emailBlock.subheading || ''} onChange={e => updBlock('subheading', e.target.value)}
                    placeholder="Short tagline below the heading"
                    className={`w-full px-4 py-3 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ring}`} />
                </div>

                {/* Body */}
                <div>
                  <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>Body Text *</label>
                  <textarea value={form.emailBlock.bodyText} onChange={e => updBlock('bodyText', e.target.value)}
                    rows={6} placeholder="Write your email message here. You can use multiple paragraphs."
                    className={`w-full px-4 py-3 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ring} resize-y leading-relaxed`} />
                  <p className={`text-xs ${t.textMuted} mt-1`}>{form.emailBlock.bodyText.length} characters · use <code className={`px-1 py-0.5 rounded ${t.bgInput} font-mono`}>{'{{name}}'}</code> for personalization</p>
                </div>

                {/* Image */}
                <div>
                  <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider flex items-center gap-1`}>
                    <ImageIcon size={12} /> Hero Image URL
                  </label>
                  <input value={form.emailBlock.imageUrl || ''} onChange={e => updBlock('imageUrl', e.target.value)}
                    placeholder="https://example.com/hero.jpg"
                    className={`w-full px-4 py-2.5 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ring} text-sm`} />
                </div>

                {/* CTA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>CTA Button Text</label>
                    <input value={form.emailBlock.ctaText || ''} onChange={e => updBlock('ctaText', e.target.value)}
                      placeholder="Get Started"
                      className={`w-full px-4 py-2.5 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ring} text-sm`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>CTA URL</label>
                    <input value={form.emailBlock.ctaUrl || ''} onChange={e => updBlock('ctaUrl', e.target.value)}
                      placeholder="https://example.com"
                      className={`w-full px-4 py-2.5 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ring} text-sm`} />
                  </div>
                </div>

                {/* Signature + Footer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>Signature</label>
                    <input value={form.emailBlock.signature || ''} onChange={e => updBlock('signature', e.target.value)}
                      placeholder="The Team" className={`w-full px-4 py-2.5 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none text-sm`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${t.textSecondary} mb-1.5 uppercase tracking-wider`}>Footer Text</label>
                    <input value={form.emailBlock.footerText || ''} onChange={e => updBlock('footerText', e.target.value)}
                      placeholder="You received this because..." className={`w-full px-4 py-2.5 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none text-sm`} />
                  </div>
                </div>

                {/* Toggle to custom HTML */}
                <button onClick={() => upd('useCustomHtml', true)}
                  className={`w-full py-2 rounded-lg text-xs font-semibold ${t.bgInput} ${t.textSecondary} border ${t.border} hover:scale-[1.01] transition-all flex items-center justify-center gap-2`}>
                  <Code size={14} /> Switch to Custom HTML Mode
                </button>
              </div>
            </div>
          )}

          {/* Custom HTML Mode */}
          {isEmail && form.useCustomHtml && (
            <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-lg font-bold ${t.textPrimary} flex items-center gap-2`}>
                  <Code size={18} style={{ color: t.primary }} /> Custom HTML Editor
                </h2>
                <button onClick={() => upd('useCustomHtml', false)}
                  className={`text-xs px-3 py-1.5 rounded-lg ${t.bgInput} ${t.textSecondary} border ${t.border}`}>← Back to Builder</button>
              </div>
              <input value={form.subject} onChange={e => upd('subject', e.target.value)}
                placeholder="Email Subject *"
                className={`w-full px-4 py-3 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none mb-3`} />
              <textarea value={customHtml} onChange={e => setCustomHtml(e.target.value)}
                rows={20} placeholder="<html>...</html>"
                className={`w-full px-4 py-3 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none font-mono text-xs leading-relaxed`} />
            </div>
          )}

          {/* Non-email: title/body */}
          {!isEmail && (
            <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
              <h2 className={`text-lg font-bold ${t.textPrimary} mb-4 flex items-center gap-2`}>
                <Bell size={18} style={{ color: t.primary }} /> Notification Content
              </h2>
              <div className="space-y-3">
                <input value={form.title} onChange={e => upd('title', e.target.value)}
                  placeholder="Notification Title *" maxLength={200}
                  className={`w-full px-4 py-3 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ring}`} />
                <textarea value={form.body} onChange={e => upd('body', e.target.value)}
                  rows={4} placeholder="Notification message *" maxLength={1000}
                  className={`w-full px-4 py-3 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none focus:ring-2 ${t.ring} resize-y`} />
              </div>
            </div>
          )}

          {/* Target Audience */}
          <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
            <h2 className={`text-lg font-bold ${t.textPrimary} mb-4 flex items-center gap-2`}>
              <Users size={18} style={{ color: t.primary }} /> Target Audience
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {([
                { v: 'all', l: 'Everyone', Icon: Globe },
                { v: 'all_users', l: 'All Users', Icon: Users },
                { v: 'all_providers', l: 'All Providers', Icon: Briefcase },
                { v: 'by_city', l: 'By City', Icon: Building2 },
                { v: 'by_zone', l: 'By Zone', Icon: MapPin },
              ] as const).map(({ v, l, Icon }) => (
                <button key={v} onClick={() => upd('targetAudience', v)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    form.targetAudience === v ? 'text-white shadow-lg' : `${t.textSecondary} ${t.border} ${t.bgHover}`
                  }`} style={form.targetAudience === v ? { background: t.primary, borderColor: t.primary } : {}}>
                  <Icon size={16} /><span className="text-xs font-semibold">{l}</span>
                </button>
              ))}
            </div>

            {form.targetAudience === 'by_city' && (
              <>
                <div className="relative mb-2">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${t.textMuted}`} />
                  <input value={citySearch} onChange={e => setCitySearch(e.target.value)} placeholder="Search cities…"
                    className={`w-full pl-10 pr-3 py-2 rounded-lg text-sm ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none`} />
                </div>
                <div className={`flex flex-wrap gap-2 p-3 rounded-xl border ${t.border} max-h-48 overflow-y-auto`}>
                  {filteredCities.map(c => (
                    <button key={c._id} onClick={() => handleMultiSelectChange('targetCities', c._id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        form.targetCities.includes(c._id) ? 'text-white' : `${t.bgInput} ${t.textSecondary}`
                      }`} style={form.targetCities.includes(c._id) ? { background: t.primary } : {}}>
                      {c.cityName || c.name}
                    </button>
                  ))}
                  {filteredCities.length === 0 && <p className={`text-xs ${t.textMuted}`}>No cities</p>}
                </div>
              </>
            )}

            {form.targetAudience === 'by_zone' && (
              <div className={`flex flex-wrap gap-2 p-3 rounded-xl border ${t.border} max-h-48 overflow-y-auto`}>
                {zones.map(z => (
                  <button key={z._id} onClick={() => handleMultiSelectChange('targetZones', z._id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      form.targetZones.includes(z._id) ? 'text-white' : `${t.bgInput} ${t.textSecondary}`
                    }`} style={form.targetZones.includes(z._id) ? { background: t.primary } : {}}>
                    {z.zoneName || z.name}
                  </button>
                ))}
                {zones.length === 0 && <p className={`text-xs ${t.textMuted}`}>No zones</p>}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
            <h2 className={`text-lg font-bold ${t.textPrimary} mb-3 flex items-center gap-2`}>
              <Tag size={18} style={{ color: t.primary }} /> Tags
            </h2>
            <div className="flex gap-2 mb-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag…"
                className={`flex-1 px-4 py-2 rounded-xl ${t.bgInput} ${t.textPrimary} border ${t.border} focus:outline-none text-sm`} />
              <button onClick={handleAddTag} className="px-4 rounded-xl text-white font-semibold text-sm" style={{ background: t.primary }}>Add</button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs" style={{ background: `${t.primary}22`, color: t.primary }}>
                    {tag}
                    <button onClick={() => upd('tags', form.tags.filter(x => x !== tag))}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════ RIGHT: PREVIEW + ACTIONS ═══════════ */}
        <div className="xl:col-span-2 space-y-6 xl:sticky xl:top-6 self-start">
          {/* Preview */}
          <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-bold ${t.textPrimary} flex items-center gap-2`}>
                <Eye size={18} style={{ color: t.primary }} /> Live Preview
              </h2>
              {isEmail && (
                <div className="flex gap-1">
                  <button onClick={copyHtml} title="Copy HTML" className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg ${t.bgInput} ${t.textSecondary} border ${t.border}`}>
                    <Copy size={12} />
                  </button>
                  <button onClick={downloadHtml} title="Download" className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg ${t.bgInput} ${t.textSecondary} border ${t.border}`}>
                    <Download size={12} />
                  </button>
                </div>
              )}
            </div>

            {isEmail && (
              <div className={`flex gap-1 mb-3 p-1 rounded-xl border ${t.border}`}>
                {([
                  { v: 'gmail', Icon: Monitor, l: 'Gmail' },
                  { v: 'mobile', Icon: Tablet, l: 'Phone' },
                  { v: 'html', Icon: Code, l: 'Code' },
                ] as const).map(({ v, Icon, l }) => (
                  <button key={v} onClick={() => setPreviewMode(v)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold ${
                      previewMode === v ? 'text-white' : `${t.textSecondary} ${t.bgHover}`
                    }`} style={previewMode === v ? { background: t.primary } : {}}>
                    <Icon size={13} /> {l}
                  </button>
                ))}
              </div>
            )}

            {/* ═══ Gmail-style realistic preview ═══ */}
            {isEmail && previewMode === 'gmail' && (
              <div className={`rounded-xl overflow-hidden border bg-white shadow-md`} style={{ borderColor: '#e5e7eb' }}>
                {/* Gmail toolbar */}
                <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                  <div className="flex gap-1">
                    <button title="Archive" className="p-1.5 rounded hover:bg-gray-200 text-gray-600"><Archive size={14} /></button>
                    <button title="Delete" className="p-1.5 rounded hover:bg-gray-200 text-gray-600"><Trash2 size={14} /></button>
                    <button title="Print" className="p-1.5 rounded hover:bg-gray-200 text-gray-600"><Printer size={14} /></button>
                  </div>
                  <div className="flex-1" />
                  <button title="More" className="p-1.5 rounded hover:bg-gray-200 text-gray-600"><MoreVertical size={14} /></button>
                </div>
                {/* Subject + sender */}
                <div className="px-5 py-4 border-b border-gray-200">
                  <div className="flex items-start gap-3">
                    <h3 className="flex-1 text-xl font-bold text-gray-900 leading-tight">
                      {form.subject || form.emailBlock.heading || '(no subject)'}
                    </h3>
                    <button className="text-yellow-500"><Star size={18} fill="currentColor" /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Inbox</span>
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold" style={{ background: `${t.primary}22`, color: t.primary }}>{form.emailTemplate}</span>
                  </div>
                </div>
                {/* Sender info */}
                <div className="px-5 py-3 border-b border-gray-200 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: form.emailBlock.brandColor }}>
                    {(form.emailBlock.brandName[0] || 'B').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 truncate">{form.emailBlock.brandName}</span>
                      <ChevronDown size={14} className="text-gray-400" />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      to <span className="font-medium">me</span>
                      <ChevronDown size={12} className="inline ml-1" />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span>{new Date().toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    <button className="p-1 hover:bg-gray-100 rounded text-gray-500"><Star size={14} /></button>
                    <button className="p-1 hover:bg-gray-100 rounded text-gray-500"><Reply size={14} /></button>
                  </div>
                </div>
                {/* Email body */}
                <iframe title="gmail-preview" srcDoc={generatedHtml} className="w-full bg-white" style={{ height: 500, border: 'none' }} />
                {/* Action buttons */}
                <div className="px-5 py-3 border-t border-gray-200 flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                    <Reply size={14} /> Reply
                  </button>
                  <button className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                    <Forward size={14} /> Forward
                  </button>
                </div>
              </div>
            )}

            {/* ═══ iPhone mobile frame ═══ */}
            {isEmail && previewMode === 'mobile' && (
              <div className="flex justify-center py-2">
                <div className="relative bg-black rounded-[2.5rem] p-2 shadow-2xl" style={{ width: 300 }}>
                  {/* Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-10 flex items-center justify-center gap-2">
                    <div className="w-10 h-1 bg-gray-800 rounded-full" />
                    <div className="w-2 h-2 bg-gray-700 rounded-full" />
                  </div>
                  {/* Screen */}
                  <div className="bg-white rounded-[2rem] overflow-hidden">
                    {/* iOS status bar */}
                    <div className="bg-white px-6 pt-7 pb-1 flex items-center justify-between text-black text-xs font-semibold">
                      <span>{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })}</span>
                      <div className="flex items-center gap-1">
                        <span>•••</span>
                        <span>📶</span>
                        <span>🔋</span>
                      </div>
                    </div>
                    {/* Mail app header */}
                    <div className="px-4 py-2 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <button className="text-blue-500 text-sm">‹ Inbox</button>
                        <div className="flex gap-3 text-gray-500">
                          <Archive size={16} />
                          <Trash2 size={16} />
                          <Reply size={16} />
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight line-clamp-2">
                        {form.subject || form.emailBlock.heading || '(no subject)'}
                      </h4>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: form.emailBlock.brandColor }}>
                          {(form.emailBlock.brandName[0] || 'B').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{form.emailBlock.brandName}</p>
                          <p className="text-[10px] text-gray-500">to me</p>
                        </div>
                        <p className="text-[10px] text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                    {/* Email body */}
                    <iframe title="mobile-preview" srcDoc={generatedHtml} className="w-full bg-white" style={{ height: 480, border: 'none' }} />
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Raw HTML code view ═══ */}
            {isEmail && previewMode === 'html' && (
              <div className={`rounded-xl overflow-hidden border ${t.border}`}>
                <div className={`${t.bgInput} px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
                  <span className={`text-xs font-mono ${t.textSecondary}`}>email.html · {htmlLineCount} lines</span>
                  <button onClick={() => setShowHtmlEditor(true)} className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${t.bgCard} ${t.textPrimary} border ${t.border}`}>
                    <Code size={11} /> Open Editor
                  </button>
                </div>
                <pre className={`${t.bgInput} ${t.textSecondary} p-3 text-xs overflow-auto`} style={{ maxHeight: 560 }}>
                  <code>{generatedHtml}</code>
                </pre>
              </div>
            )}

            {/* Non-email: mobile push preview */}
            {!isEmail && (
              <div className="bg-gray-900 rounded-3xl p-4 mx-auto" style={{ maxWidth: 300 }}>
                <div className="bg-gray-800 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.primary }}>
                      <Bell size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">{form.title || 'Notification Title'}</p>
                      <p className="text-gray-400 text-xs mt-1">{form.body || 'Message will appear here…'}</p>
                      <p className="text-gray-500 text-xs mt-2">Just now</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Meta */}
            <div className={`mt-4 pt-4 border-t ${t.border} space-y-2 text-xs`}>
              <div className={`flex justify-between ${t.textSecondary}`}>
                <span>Channel</span><span className={`font-semibold ${t.textPrimary} capitalize`}>{form.type.replace('_', ' ')}</span>
              </div>
              <div className={`flex justify-between ${t.textSecondary}`}>
                <span>Priority</span>
                <span className={`font-semibold px-2 py-0.5 rounded ${
                  form.priority === 'urgent' ? 'bg-red-500/20 text-red-500' :
                  form.priority === 'high' ? 'bg-orange-500/20 text-orange-500' :
                  form.priority === 'normal' ? 'bg-blue-500/20 text-blue-500' :
                  'bg-gray-500/20 text-gray-500'
                } uppercase`}>{form.priority}</span>
              </div>
              <div className={`flex justify-between ${t.textSecondary}`}>
                <span>Audience</span><span className={`font-semibold ${t.textPrimary}`}>{form.targetAudience.replace(/_/g, ' ')}</span>
              </div>
              {form.targetCities.length > 0 && (
                <div className={`flex justify-between ${t.textSecondary}`}>
                  <span>Cities</span><span className={`font-semibold ${t.textPrimary}`}>{form.targetCities.length} selected</span>
                </div>
              )}
              {isEmail && (
                <div className={`flex justify-between ${t.textSecondary}`}>
                  <span>HTML Size</span><span className={`font-semibold ${t.textPrimary}`}>{(generatedHtml.length / 1024).toFixed(1)} KB</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5`}>
            <h2 className={`text-lg font-bold ${t.textPrimary} mb-3`}>Actions</h2>
            <div className="space-y-2">
              <button onClick={handleSendNow} disabled={sendingNow}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 bg-gradient-to-r ${t.gradHeader}`}>
                {sendingNow ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : <><Send size={18} /> Send Now</>}
              </button>

              <button onClick={() => setShowScheduler(!showScheduler)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 hover:scale-[1.02] transition-all">
                <Clock size={18} /> Schedule
              </button>

              {showScheduler && (
                <div className={`p-3 rounded-xl ${t.bgInput} border ${t.border} space-y-2`}>
                  <input type="datetime-local" value={form.scheduledAt} onChange={e => upd('scheduledAt', e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className={`w-full px-3 py-2 rounded-lg ${t.bgCard} ${t.textPrimary} border ${t.border} focus:outline-none text-sm`} />
                  <button onClick={handleSchedule} disabled={loading || !form.scheduledAt}
                    className="w-full py-2 rounded-lg bg-amber-500 text-white font-semibold text-sm disabled:opacity-50">
                    {loading ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                    Confirm Schedule
                  </button>
                </div>
              )}

              <button onClick={handleSaveDraft} disabled={loading}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold ${t.bgInput} ${t.textSecondary} border ${t.border} hover:scale-[1.02] transition-all disabled:opacity-50`}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Draft
              </button>
            </div>
          </div>

          {/* Estimated Reach */}
          <div className={`rounded-2xl p-5 bg-gradient-to-br ${t.gradHeader} text-white shadow-xl`}>
            <h3 className="font-bold text-sm mb-1 opacity-90">Estimated Reach</h3>
            <div className="text-4xl font-extrabold mb-1">
              {form.targetAudience === 'all' ? '~1,000+' :
               form.targetAudience === 'all_users' ? '~800+' :
               form.targetAudience === 'all_providers' ? '~200+' :
               form.targetAudience === 'by_city' ? `~${form.targetCities.length * 100}` :
               form.targetAudience === 'by_zone' ? `~${form.targetZones.length * 50}` : '~0'}
            </div>
            <p className="text-xs opacity-80 capitalize">{form.targetAudience.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>

      {/* ═══════════ TEMPLATE GALLERY MODAL ═══════════ */}
      {showTemplateGallery && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowTemplateGallery(false)}>
          <div className={`${t.bgCard} rounded-2xl border ${t.border} max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className={`p-5 border-b ${t.border} flex items-center justify-between sticky top-0 ${t.bgCard} z-10`}>
              <div>
                <h2 className={`text-xl font-bold ${t.textPrimary}`}>Choose a Template</h2>
                <p className={`text-sm ${t.textSecondary}`}>Pick a professional template to start with</p>
              </div>
              <button onClick={() => setShowTemplateGallery(false)} className={`w-9 h-9 rounded-lg ${t.bgInput} ${t.textSecondary} flex items-center justify-center`}>
                <X size={18} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEMPLATE_GALLERY.map(tpl => (
                <button key={tpl.id} onClick={() => applyTemplatePreset(tpl.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.03] hover:shadow-xl ${
                    form.emailTemplate === tpl.id ? 'shadow-lg' : t.border
                  } ${t.bgInput}`}
                  style={form.emailTemplate === tpl.id ? { borderColor: tpl.color } : {}}>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-3" style={{ background: `${tpl.color}22` }}>{tpl.emoji}</div>
                  <h3 className={`font-bold ${t.textPrimary} mb-1`}>{tpl.name}</h3>
                  <p className={`text-xs ${t.textSecondary}`}>{tpl.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}