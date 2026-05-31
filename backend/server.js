require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration CORS - autoriser toutes les origines en développement
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false
}));

// Middleware
app.use(express.json());

// Servir les fichiers du frontend (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// URL de base de l'API Hugging Face (nouveau endpoint)
const HF_API_BASE = 'https://router.huggingface.co/hf-inference/models';

// Modèles disponibles pour la traduction
const TRANSLATION_MODELS = {
  'en-fr': 'Helsinki-NLP/opus-mt-en-fr',
  'fr-en': 'Helsinki-NLP/opus-mt-fr-en',
  'en-es': 'Helsinki-NLP/opus-mt-en-es',
  'es-en': 'Helsinki-NLP/opus-mt-es-en',
  'en-de': 'Helsinki-NLP/opus-mt-en-de',
  'de-en': 'Helsinki-NLP/opus-mt-de-en',
  'en-it': 'Helsinki-NLP/opus-mt-en-it',
  'it-en': 'Helsinki-NLP/opus-mt-it-en',
  'en-pt': 'Helsinki-NLP/opus-mt-en-pt',
  'pt-en': 'Helsinki-NLP/opus-mt-pt-en',
  'fr-es': 'Helsinki-NLP/opus-mt-fr-es',
  'es-fr': 'Helsinki-NLP/opus-mt-es-fr',
  'fr-de': 'Helsinki-NLP/opus-mt-fr-de',
  'de-fr': 'Helsinki-NLP/opus-mt-de-fr',
  'en-ar': 'Helsinki-NLP/opus-mt-en-ar',
  'ar-en': 'Helsinki-NLP/opus-mt-ar-en',
  'fr-ar': 'Helsinki-NLP/opus-mt-fr-ar',
  'ar-fr': 'Helsinki-NLP/opus-mt-ar-fr',
  'multi': 'facebook/mbart-large-50-many-to-many-mmt'
};

// Langues supportées
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'fr': 'Français',
  'es': 'Español',
  'de': 'Deutsch',
  'it': 'Italiano',
  'pt': 'Português',
  'zh': '中文',
  'ja': '日本語',
  'ar': 'العربية'
};

// Fonction d'appel direct à l'API Hugging Face Inference
async function callHuggingFaceAPI(model, text) {
  const apiKey = process.env.HF_API_KEY;
  
  if (!apiKey) {
    throw new Error('Clé API Hugging Face non configurée. Ajoutez HF_API_KEY dans le fichier .env');
  }

  const url = `${HF_API_BASE}/${model}`;
  console.log(`  → Appel API: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text }),
  });

  const responseText = await response.text();
  console.log(`  → Statut HTTP: ${response.status}`);
  console.log(`  → Réponse brute: ${responseText.substring(0, 500)}`);

  if (!response.ok) {
    // Analyser l'erreur pour donner un message clair
    let errorDetail = responseText;
    try {
      const errorJson = JSON.parse(responseText);
      errorDetail = errorJson.error || errorJson.message || responseText;
    } catch (e) {}

    if (response.status === 401) {
      throw new Error('Clé API Hugging Face invalide ou expirée. Veuillez vérifier votre clé dans le fichier .env');
    } else if (response.status === 403) {
      throw new Error('Accès refusé au modèle. Votre clé API n\'a pas les permissions nécessaires.');
    } else if (response.status === 429) {
      throw new Error('Trop de requêtes. Veuillez attendre quelques secondes et réessayer.');
    } else if (response.status === 503) {
      throw new Error('Le modèle est en cours de chargement. Veuillez réessayer dans 20-30 secondes.');
    } else {
      throw new Error(`Erreur API Hugging Face (${response.status}): ${errorDetail}`);
    }
  }

  // Parser la réponse JSON
  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Réponse invalide de l'API: ${responseText.substring(0, 200)}`);
  }

  // Extraire le texte traduit selon le format de réponse
  if (Array.isArray(result) && result.length > 0) {
    return result[0].translation_text || result[0].generated_text || String(result[0]);
  } else if (result && result.translation_text) {
    return result.translation_text;
  } else if (typeof result === 'string') {
    return result;
  } else {
    return JSON.stringify(result);
  }
}

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Serveur de traduction est actif',
    apiKeyConfigured: !!process.env.HF_API_KEY
  });
});

// Route pour obtenir les langues supportées
app.get('/api/languages', (req, res) => {
  res.json({
    languages: SUPPORTED_LANGUAGES,
    models: Object.keys(TRANSLATION_MODELS)
  });
});

// Route principale de traduction
app.post('/api/translate', async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;

    // Validation des entrées
    if (!text || !sourceLang || !targetLang) {
      return res.status(400).json({
        error: 'Veuillez fournir text, sourceLang et targetLang'
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        error: 'Le texte à traduire ne peut pas être vide'
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        error: 'Le texte dépasse la limite de 5000 caractères'
      });
    }

    // Sélectionner le modèle approprié
    const modelKey = `${sourceLang}-${targetLang}`;
    let model = TRANSLATION_MODELS[modelKey];

    if (!model) {
      // Si la paire de langues n'existe pas, utiliser le modèle multilingue
      model = TRANSLATION_MODELS['multi'];
    }

    console.log(`\nTraduction demandée: ${sourceLang} -> ${targetLang}`);
    console.log(`Modèle utilisé: ${model}`);

    // Appeler l'API Hugging Face directement
    const translatedText = await callHuggingFaceAPI(model, text);

    console.log(`Texte traduit: ${translatedText}`);

    res.json({
      success: true,
      original: text,
      translated: translatedText,
      sourceLang: sourceLang,
      targetLang: targetLang,
      model: model,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erreur de traduction:', error.message);
    
    res.status(500).json({
      error: error.message,
      message: error.message
    });
  }
});

// Route pour tester le modèle
app.post('/api/test-model', async (req, res) => {
  try {
    if (!process.env.HF_API_KEY) {
      return res.status(500).json({
        error: 'Clé API Hugging Face non configurée'
      });
    }

    // Tester avec une traduction simple
    const result = await callHuggingFaceAPI('Helsinki-NLP/opus-mt-en-fr', 'Hello world');

    res.json({
      success: true,
      message: 'Modèle testé avec succès',
      test: result
    });

  } catch (error) {
    console.error('Erreur de test:', error.message);
    res.status(500).json({
      error: 'Erreur lors du test du modèle',
      message: error.message
    });
  }
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`\n=====================================`);
  console.log(`✅ Serveur lancé sur le port ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`=====================================\n`);
  
  if (!process.env.HF_API_KEY) {
    console.warn('⚠️  AVERTISSEMENT: Clé API Hugging Face non définie!');
    console.warn('    Veuillez configurer HF_API_KEY dans le fichier .env\n');
  } else {
    console.log('🔑 Clé API Hugging Face: configurée');
    console.log(`🌐 Endpoint API: ${HF_API_BASE}\n`);
  }
});

module.exports = app;
