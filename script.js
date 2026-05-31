// Configuration
const API_URL = 'http://localhost:5000/api';
const CHECK_INTERVAL = 3000; // Vérification toutes les 3 secondes

// Éléments DOM
const sourceText = document.getElementById('sourceText');
const targetText = document.getElementById('targetText');
const sourceLang = document.getElementById('sourceLang');
const targetLang = document.getElementById('targetLang');
const translateBtn = document.getElementById('translateBtn');
const clearSourceBtn = document.getElementById('clearSourceBtn');
const clearTargetBtn = document.getElementById('clearTargetBtn');
const copySourceBtn = document.getElementById('copySourceBtn');
const copyTargetBtn = document.getElementById('copyTargetBtn');
const swapBtn = document.getElementById('swapBtn');
const statusBar = document.getElementById('statusBar');
const statusText = document.getElementById('statusText');
const messageContainer = document.getElementById('messageContainer');
const resultSection = document.getElementById('resultSection');

let isConnected = false;

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

// Afficher un message
function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    
    let icon = '📝';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'info') icon = 'ℹ️';
    
    message.innerHTML = `<span>${icon}</span><span>${text}</span>`;
    messageContainer.appendChild(message);
    
    // Supprimer le message après 5 secondes
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transform = 'translateY(20px)';
        setTimeout(() => message.remove(), 300);
    }, 5000);
}

// Mettre à jour le statut
function updateStatus(connected) {
    isConnected = connected;
    if (connected) {
        statusBar.className = 'status-bar connected';
        statusText.textContent = '✅ Serveur connecté - Prêt à traduire';
    } else {
        statusBar.className = 'status-bar loading';
        statusText.textContent = '⏳ Tentative de connexion au serveur...';
    }
}

// Vérifier la connexion au serveur
async function checkConnection() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
            updateStatus(true);
            return true;
        }
    } catch (error) {
        updateStatus(false);
    }
    return false;
}

// Copier du texte
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showMessage('✨ Texte copié dans le presse-papiers', 'success');
    }).catch(() => {
        showMessage('❌ Erreur lors de la copie', 'error');
    });
}

// Mettre à jour le compteur de caractères
function updateCharCount() {
    const count = sourceText.value.length;
    document.getElementById('charCount').textContent = count;
}

// ============================================
// ÉVÉNEMENTS DES BOUTONS
// ============================================

// Bouton Traduction
translateBtn.addEventListener('click', async () => {
    const text = sourceText.value.trim();
    const source = sourceLang.value;
    const target = targetLang.value;

    // Validations
    if (!text) {
        showMessage('⚠️ Veuillez entrer un texte à traduire', 'error');
        return;
    }

    if (text.length > 5000) {
        showMessage('❌ Le texte dépasse la limite de 5000 caractères', 'error');
        return;
    }

    if (source === target) {
        showMessage('⚠️ Les langues source et cible doivent être différentes', 'error');
        return;
    }

    if (!isConnected) {
        showMessage('❌ Le serveur n\'est pas connecté', 'error');
        return;
    }

    // Appeler l'API
    await translate(text, source, target);
});

// Fonction de traduction
async function translate(text, source, target) {
    translateBtn.disabled = true;
    translateBtn.textContent = '🔄 Traduction en cours...';

    try {
        const response = await fetch(`${API_URL}/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                sourceLang: source,
                targetLang: target
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erreur de traduction');
        }

        // Afficher le résultat
        targetText.value = data.translated;
        showMessage('✨ Traduction réussie!', 'success');

        // Afficher les détails
        displayResultDetails(data);

        // Scroll vers le résultat
        resultSection.classList.remove('hidden');
        resultSection.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('Erreur:', error);
        showMessage(`❌ Erreur: ${error.message}`, 'error');
        targetText.value = '';
        resultSection.classList.add('hidden');
    } finally {
        translateBtn.disabled = false;
        translateBtn.textContent = '🚀 Traduire';
    }
}

// Afficher les détails des résultats
function displayResultDetails(data) {
    document.getElementById('modelUsed').textContent = data.model.split('/').pop();
    document.getElementById('charCount2').textContent = data.original.length;
    document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleString('fr-FR');
}

// Boutons Effacer
clearSourceBtn.addEventListener('click', () => {
    sourceText.value = '';
    updateCharCount();
    showMessage('Texte source effacé', 'info');
});

clearTargetBtn.addEventListener('click', () => {
    targetText.value = '';
    resultSection.classList.add('hidden');
    showMessage('Traduction effacée', 'info');
});

// Boutons Copier
copySourceBtn.addEventListener('click', () => {
    if (sourceText.value) {
        copyText(sourceText.value);
    } else {
        showMessage('❌ Rien à copier dans le texte source', 'error');
    }
});

copyTargetBtn.addEventListener('click', () => {
    if (targetText.value) {
        copyText(targetText.value);
    } else {
        showMessage('❌ Aucune traduction à copier', 'error');
    }
});

// Bouton Swap (inverser les langues)
swapBtn.addEventListener('click', () => {
    const temp = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = temp;

    // Swap le texte aussi
    const tempText = sourceText.value;
    sourceText.value = targetText.value;
    targetText.value = tempText;

    updateCharCount();
    showMessage('🔄 Langues inversées', 'info');
});

// Mettre à jour le compteur lors de la saisie
sourceText.addEventListener('input', updateCharCount);

// Permettre Entrée + Ctrl pour traduire
sourceText.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        translateBtn.click();
    }
});

// ============================================
// INITIALISATION
// ============================================

// Vérifier la connexion au chargement
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Application lancée');
    console.log('📡 API URL:', API_URL);
    
    checkConnection();
    
    // Vérifier la connexion périodiquement
    setInterval(checkConnection, CHECK_INTERVAL);

    // Focus sur le texte source
    sourceText.focus();
    
    // Log des infos
    console.log('✅ Interface prête');
});

// ============================================
// GESTION DES ERREURS
// ============================================

window.addEventListener('error', (event) => {
    console.error('Erreur globale:', event.error);
    showMessage('❌ Une erreur interne s\'est produite', 'error');
});

// Observer les changements de connectivité
if ('connection' in navigator) {
    navigator.connection.addEventListener('change', () => {
        if (navigator.onLine) {
            showMessage('✅ Connexion Internet rétablie', 'success');
            checkConnection();
        } else {
            showMessage('❌ Pas de connexion Internet', 'error');
            updateStatus(false);
        }
    });
}
