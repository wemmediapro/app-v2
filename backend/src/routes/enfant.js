/**
 * Routes API Espace Enfant - Activités pour enfants (MongoDB)
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const EnfantActivity = require('../models/EnfantActivity');
const { generateTranslationsForEnfant } = require('../lib/enfant-translations-openai');

const AGE_RANGE_SUFFIX = {
  en: ' years',
  es: ' años',
  it: ' anni',
  de: ' Jahre',
  ar: ' سنوات',
  fr: ' ans',
};

function localizeActivity(doc, lang) {
  if (!doc) {return doc;}
  const obj = { ...doc, _id: doc._id?.toString(), image: doc.imageUrl || doc.image, isFeatured: doc.isFeatured || false };
  if (lang && doc.translations && doc.translations[lang]) {
    const t = doc.translations[lang];
    if (t.name) {obj.name = t.name;}
    if (t.description !== undefined) {obj.description = t.description;}
    if (t.ageRange) {obj.ageRange = t.ageRange;} else if (doc.ageRange && AGE_RANGE_SUFFIX[lang]) {
      obj.ageRange = String(doc.ageRange).replace(/\s*ans\s*$/i, AGE_RANGE_SUFFIX[lang]).trim();
    }
    if (t.schedule) {obj.schedule = t.schedule;}
    if (Array.isArray(t.features) && t.features.length > 0) {obj.features = t.features;}
  } else if (lang && AGE_RANGE_SUFFIX[lang] && doc.ageRange && /ans\s*$/i.test(String(doc.ageRange))) {
    obj.ageRange = String(doc.ageRange).replace(/\s*ans\s*$/i, AGE_RANGE_SUFFIX[lang]).trim();
  }
  return obj;
}

// @route   GET /api/enfant/activities — ?lang= pour contenu localisé
router.get('/activities', async (req, res) => {
  try {
    const { lang } = req.query;
    if (mongoose.connection.readyState === 1) {
      const activities = await EnfantActivity.find({}).lean().sort({ createdAt: -1 });
      return res.json(activities.map(doc => localizeActivity(doc, lang)));
    }
    res.json([]);
  } catch (error) {
    console.error('Get enfant activities error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/enfant/activities/:id — ?lang=
router.get('/activities/:id', async (req, res) => {
  try {
    const { lang } = req.query;
    if (mongoose.connection.readyState === 1) {
      const activity = await EnfantActivity.findById(req.params.id).lean();
      if (!activity) {return res.status(404).json({ message: 'Activité non trouvée' });}
      return res.json(localizeActivity(activity, lang));
    }
    return res.status(404).json({ message: 'Activité non trouvée' });
  } catch (error) {
    console.error('Get enfant activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/enfant/activities
// @desc    Créer une activité enfant
router.post('/activities', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const body = req.body;
    const activity = new EnfantActivity({
      name: body.name,
      category: body.category,
      description: body.description,
      ageRange: body.ageRange || '0-12 ans',
      duration: typeof body.duration === 'number' ? `${body.duration} min` : (body.duration || '60 min'),
      location: body.location,
      capacity: typeof body.capacity === 'number' ? String(body.capacity) : (body.capacity || '20'),
      price: body.price || 0,
      schedule: body.schedule,
      instructor: body.instructor,
      features: body.features || [],
      imageUrl: body.imageUrl || body.image,
      isActive: body.isActive !== false,
      isFeatured: body.isFeatured === true,
      countries: body.countries || [],
      shipId: body.shipId,
      destination: body.destination,
      participants: body.participants || 0,
      maxParticipants: body.maxParticipants,
      translations: body.translations && typeof body.translations === 'object' ? body.translations : undefined,
    });
    await activity.save();
    const doc = activity.toObject();
    res.status(201).json({ ...doc, _id: doc._id?.toString(), image: doc.imageUrl });
  } catch (error) {
    console.error('Create enfant activity error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   PUT /api/enfant/activities/:id
// @desc    Modifier une activité enfant
router.put('/activities/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const body = req.body;
    const updates = { ...body };
    delete updates._id;
    if (typeof updates.duration === 'number') {updates.duration = `${updates.duration} min`;}
    if (typeof updates.capacity === 'number') {updates.capacity = String(updates.capacity);}
    if (updates.image) {updates.imageUrl = updates.image;}
    if (updates.translations && typeof updates.translations !== 'object') {delete updates.translations;}
    const activity = await EnfantActivity.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!activity) {return res.status(404).json({ message: 'Activité non trouvée' });}
    const doc = activity.toObject();
    res.json({ ...doc, _id: doc._id?.toString(), image: doc.imageUrl });
  } catch (error) {
    console.error('Update enfant activity error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   POST /api/enfant/activities/:id/translate
// @desc    Traduire le contenu de l'activité dans toutes les langues (fr, en, es, it, de, ar) via OpenAI
router.post('/activities/:id/translate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ message: 'OPENAI_API_KEY manquant. Définissez-le dans backend/.env pour utiliser la traduction OpenAI.' });
    }
    const OpenAI = require('openai').default;
    const openai = new OpenAI({ apiKey });

    const activity = await EnfantActivity.findById(req.params.id).lean();
    if (!activity) {return res.status(404).json({ message: 'Activité non trouvée' });}

    const nameFr = activity.name || '';
    const descriptionFr = activity.description || '';
    const category = activity.category || 'Activité';
    const trFr = activity.translations?.fr || {};
    const ageRangeFr = trFr.ageRange || activity.ageRange || '';
    const scheduleFr = trFr.schedule || activity.schedule || '';
    const featuresFr = Array.isArray(trFr.features) && trFr.features.length > 0
      ? trFr.features
      : (Array.isArray(activity.features) ? activity.features : []);

    const generated = await generateTranslationsForEnfant(
      openai, nameFr, descriptionFr, category, ageRangeFr, scheduleFr, featuresFr,
    );

    const existing = activity.translations && typeof activity.translations === 'object' ? activity.translations : {};
    const merged = { ...existing };
    for (const [lang, data] of Object.entries(generated)) {
      merged[lang] = { ...(merged[lang] || {}), ...data };
    }

    await EnfantActivity.updateOne(
      { _id: activity._id },
      { $set: { translations: merged } },
    );
    const updated = await EnfantActivity.findById(activity._id).lean();
    const doc = { ...updated, _id: updated._id?.toString(), image: updated.imageUrl };
    res.json(doc);
  } catch (error) {
    console.error('Translate enfant activity error:', error);
    res.status(500).json({ message: error.message || 'Erreur lors de la traduction OpenAI.' });
  }
});

// @route   DELETE /api/enfant/activities/:id
// @desc    Supprimer une activité enfant
router.delete('/activities/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Base de données indisponible. Mode démo actif.' });
    }
    const activity = await EnfantActivity.findByIdAndDelete(req.params.id);
    if (!activity) {return res.status(404).json({ message: 'Activité non trouvée' });}
    res.json({ message: 'Activité supprimée' });
  } catch (error) {
    console.error('Delete enfant activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
