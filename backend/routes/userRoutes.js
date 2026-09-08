const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Contact = require('../models/Contact');
const { authStore } = require('../utils/authStore');
const bcrypt = require('bcryptjs');

const router = express.Router();
const callerEmailFromName = (name) => `${String(name).toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;

router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

  if (mongoose.connection.readyState === 1) {
    const users = await User.find({ $or: [{ _id: req.user._id }, { ownerId: req.user._id }] }, 'name email role ownerId').lean();
    return res.json(users.map((user) => ({ _id: String(user._id), id: String(user._id), name: user.name, email: user.email, role: user.role, ownerId: user.ownerId ? String(user.ownerId) : null })));
  }

  const users = authStore.users.filter((user) => String(user.id) === String(req.user._id) || String(user.ownerId) === String(req.user._id)).map(({ id, name, email, role, ownerId }) => ({ _id: String(id), id, name, email, role, ownerId: ownerId || null }));
  res.json(users);
});

router.post('/callers', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Caller name is required' });
  const email = String(req.body.email || callerEmailFromName(name)).trim().toLowerCase();
  const password = String(req.body.password || '123456');
  try {
    if (mongoose.connection.readyState === 1) {
      const existing = await User.findOne({ $or: [{ name }, { email }] });
      if (existing) return res.status(409).json({ message: 'A user with this caller name already exists' });
      const caller = await User.create({ name, email, password: await bcrypt.hash(password, 10), role: 'caller', ownerId: req.user._id, shopName: req.user.shopName, phone: req.body.phone || '' });
      return res.status(201).json({ id: String(caller._id), name: caller.name, email: caller.email, role: caller.role, temporaryPassword: password });
    }
    const caller = await authStore.createUser({ name, email, password, role: 'caller', ownerId: req.user._id, shopName: req.user.shopName, phone: req.body.phone || '' });
    if (!caller) return res.status(409).json({ message: 'A user with this caller name already exists' });
    res.status(201).json({ id: caller.id, name: caller.name, email: caller.email, role: caller.role, temporaryPassword: password });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/callers/sync', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const callerNames = mongoose.connection.readyState === 1
      ? await Contact.distinct('callerName', { createdBy: req.user._id, callerName: { $nin: ['', null] } })
      : [];
    const existing = mongoose.connection.readyState === 1 ? await User.find({ ownerId: req.user._id, role: 'caller' }).select('name') : authStore.users.filter((user) => user.role === 'caller' && String(user.ownerId) === String(req.user._id));
    const existingNames = new Set(existing.map((user) => user.name.toLowerCase()));
    let created = 0;
    for (const rawName of callerNames) {
      const name = String(rawName).trim();
      if (!name || existingNames.has(name.toLowerCase())) continue;
      const email = callerEmailFromName(name);
      if (mongoose.connection.readyState === 1) {
        const emailUsed = await User.exists({ email });
        if (emailUsed) continue;
        await User.create({ name, email, password: await bcrypt.hash('123456', 10), role: 'caller', ownerId: req.user._id, shopName: req.user.shopName });
      } else {
        const caller = await authStore.createUser({ name, email, password: '123456', role: 'caller', ownerId: req.user._id, shopName: req.user.shopName });
        if (!caller) continue;
      }
      created += 1;
    }
    res.json({ message: created ? `${created} caller account${created === 1 ? '' : 's'} created` : 'No new caller names found', created });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.put('/callers/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const updates = {};
  if (req.body.name) updates.name = String(req.body.name).trim();
  if (req.body.email) updates.email = String(req.body.email).trim().toLowerCase();
  if (req.body.phone !== undefined) updates.phone = String(req.body.phone).trim();
  if (req.body.password) updates.password = await bcrypt.hash(String(req.body.password), 10);
  try {
    if (mongoose.connection.readyState === 1) {
      const caller = await User.findOneAndUpdate({ _id: req.params.id, ownerId: req.user._id, role: 'caller' }, updates, { new: true }).select('name email role phone');
      if (!caller) return res.status(404).json({ message: 'Caller not found' });
      return res.json(caller);
    }
    const caller = authStore.findUserById(req.params.id);
    if (!caller || caller.role !== 'caller' || String(caller.ownerId) !== String(req.user._id)) return res.status(404).json({ message: 'Caller not found' });
    Object.assign(caller, updates);
    res.json({ id: caller.id, name: caller.name, email: caller.email, role: caller.role, phone: caller.phone });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.delete('/callers/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const deleted = mongoose.connection.readyState === 1
      ? await User.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id, role: 'caller' })
      : authStore.users.splice(authStore.users.findIndex((user) => String(user.id) === String(req.params.id) && user.role === 'caller' && String(user.ownerId) === String(req.user._id)), 1)[0];
    if (!deleted) return res.status(404).json({ message: 'Caller not found' });
    res.json({ message: 'Caller removed' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/public-settings', async (req, res) => {
  try {
    const query = req.query.ownerId ? { _id: req.query.ownerId } : { role: 'admin' };
    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne(query).select('appSettings shopName shopAddress phone email shopLogoUrl').lean();
      return res.json({ ...(user?.appSettings || {}), shopName: user?.shopName, shopAddress: user?.shopAddress, phone: user?.phone, email: user?.email, shopLogoUrl: user?.shopLogoUrl });
    }
    const user = authStore.users.find((entry) => query._id ? String(entry.id) === String(query._id) : entry.role === 'admin');
    res.json({ ...(user?.appSettings || {}), shopName: user?.shopName, shopAddress: user?.shopAddress, phone: user?.phone, email: user?.email, shopLogoUrl: user?.shopLogoUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/settings', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  if (mongoose.connection.readyState === 1) {
    const user = await User.findById(req.user._id).select('appSettings').lean();
    return res.json(user?.appSettings || {});
  }
  res.json(authStore.findUserById(req.user._id)?.appSettings || {});
});

router.put('/settings', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const safeUrl = (value) => { const text = String(value || '').trim(); return /^https?:\/\//i.test(text) || text.startsWith('/') ? text : ''; };
  const heroSlides = Array.isArray(req.body.heroSlides) ? req.body.heroSlides.slice(0, 6).map((slide, index) => ({
    kicker: String(slide?.kicker || `Featured workflow ${index + 1}`).trim().slice(0, 120),
    title: String(slide?.title || 'Make your work feel organised.').trim().slice(0, 180),
    copy: String(slide?.copy || '').trim().slice(0, 360),
    stat: String(slide?.stat || `0${index + 1} / 03`).trim().slice(0, 30),
    accent: String(slide?.accent || 'Built for better work').trim().slice(0, 100),
    imageUrl: safeUrl(slide?.imageUrl),
    buttonLabel: String(slide?.buttonLabel || 'Open workspace').trim().slice(0, 60),
    buttonLink: safeUrl(slide?.buttonLink) || '/login'
  })) : undefined;
  const publicStats = Array.isArray(req.body.publicStats) ? req.body.publicStats.slice(0, 4).map((stat) => ({ value: String(stat?.value || '').trim().slice(0, 30), label: String(stat?.label || '').trim().slice(0, 70) })).filter((stat) => stat.value || stat.label) : undefined;
  const settings = {
    lowStockThreshold: Math.max(0, Number(req.body.lowStockThreshold ?? 5)),
    quotationValidity: Math.max(1, Number(req.body.quotationValidity ?? 15)),
    currency: req.body.currency || 'INR',
    showPayroll: req.body.showPayroll !== false,
    showAnalytics: req.body.showAnalytics !== false,
    compactContacts: req.body.compactContacts === true,
    autoReminder: req.body.autoReminder !== false,
    siteTitle: String(req.body.siteTitle || 'SGSE Billing Suite').trim(),
    siteTagline: String(req.body.siteTagline || 'Modern billing and stock management').trim(),
    siteDescription: String(req.body.siteDescription || 'Run sales, stock, purchases, and GST workflows from one professional workspace.').trim(),
    aboutTitle: String(req.body.aboutTitle || 'Built for busy business teams').trim(),
    aboutText: String(req.body.aboutText || 'Keep billing, contacts, stock, finance, and team operations moving from one reliable workspace.').trim(),
    contactCta: String(req.body.contactCta || 'Talk to our team').trim(),
    publicPhone: String(req.body.publicPhone || '').trim(),
    publicEmail: String(req.body.publicEmail || '').trim(),
    primaryColor: /^#[0-9a-f]{6}$/i.test(req.body.primaryColor) ? req.body.primaryColor : '#186FAF',
    accentColor: /^#[0-9a-f]{6}$/i.test(req.body.accentColor) ? req.body.accentColor : '#E59D2D',
    surfaceColor: /^#[0-9a-f]{6}$/i.test(req.body.surfaceColor) ? req.body.surfaceColor : '#F6F9FC',
    darkMode: req.body.darkMode === true,
    showCalculator: req.body.showCalculator !== false,
    showPublicContact: req.body.showPublicContact !== false,
    showPublicAbout: req.body.showPublicAbout !== false,
    language: ['en', 'hi', 'od'].includes(req.body.language) ? req.body.language : 'en',
    themePreset: ['ocean', 'forest', 'graphite', 'coral'].includes(req.body.themePreset) ? req.body.themePreset : 'ocean',
    fontFamily: ['Manrope', 'DM Sans', 'Plus Jakarta Sans'].includes(req.body.fontFamily) ? req.body.fontFamily : 'Manrope',
    cornerRadius: Math.min(32, Math.max(8, Number(req.body.cornerRadius ?? 20))),
    density: ['comfortable', 'compact'].includes(req.body.density) ? req.body.density : 'comfortable',
    ...(heroSlides ? { heroSlides } : {}),
    ...(publicStats ? { publicStats } : {})
  };
  if (mongoose.connection.readyState === 1) await User.findByIdAndUpdate(req.user._id, { appSettings: settings });
  else { const user = authStore.findUserById(req.user._id); if (user) user.appSettings = settings; }
  res.json(settings);
});

module.exports = router;
