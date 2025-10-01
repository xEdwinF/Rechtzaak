// Global variables
let currentCase = null;
let conversationHistory = [];
let conversationState = {
    phase: 'not_started',
    judgeInterventions: 0,
    evidencePresented: 0,
    totalEvidence: 0
};
let startTime = null;
let timerInterval = null;
let caseId = null;

// Check authentication and load case
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    
    loadUserData();
    
    // Get case ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    caseId = urlParams.get('caseId');
    
    if (caseId) {
        loadCase(caseId);
    } else {
        alert('Geen zaak geselecteerd');
        window.location.href = 'dashboard.html';
    }
});

// Load user data
function loadUserData() {
    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('userName').textContent = `${user.firstName} ${user.lastName}`;
}

// Load case data
async function loadCase(caseId) {
    try {
        const response = await fetch(`${API_BASE_URL}/cases/${caseId}`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            currentCase = await response.json();
            displayCase();
            
            // Start the case in progress tracking
            await startCaseProgress();
        } else {
            alert('Fout bij laden van de zaak');
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error('Error loading case:', error);
        alert('Er ging iets mis bij het laden van de zaak');
        window.location.href = 'dashboard.html';
    }
}

// Display case information
function displayCase() {
    document.getElementById('caseTitle').textContent = currentCase.title;
    document.getElementById('caseDescription').textContent = currentCase.description;
    document.getElementById('simulateBtn').disabled = false;
    
    conversationState.totalEvidence = currentCase.evidence.length;
}

// Start case progress tracking
async function startCaseProgress() {
    try {
        const response = await fetch(`${API_BASE_URL}/progress/start-case`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ caseId: parseInt(caseId) })
        });
        
        if (response.ok) {
            console.log('Case progress started');
        }
    } catch (error) {
        console.error('Error starting case progress:', error);
    }
}

// Evidence Modal functions
function showEvidence() {
    const modal = document.getElementById('evidenceModal');
    const evidenceList = document.getElementById('modalEvidenceList');
    
    if (currentCase && currentCase.evidence) {
        evidenceList.innerHTML = currentCase.evidence.map((item, index) => 
            `<div class="evidence-item">
                <div class="evidence-number">${index + 1}</div>
                <div class="evidence-text">${item}</div>
            </div>`
        ).join('');
    }
    
    modal.style.display = 'block';
}

function closeEvidence() {
    document.getElementById('evidenceModal').style.display = 'none';
}

// Timer functions
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if (!startTime) return;
    
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    document.getElementById('timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function getElapsedTime() {
    if (!startTime) return 0;
    return Math.floor((Date.now() - startTime) / 1000);
}

// Start simulation
async function startSimulation() {
    if (!currentCase) return;
    
    document.getElementById('simulateBtn').disabled = true;
    document.getElementById('simulateBtn').textContent = '🎬 Rechtszaak Gestart';
    document.getElementById('chatContainer').style.display = 'grid';
    
    conversationState.phase = 'opening';
    startTimer();
    
    // Rechter opent de zitting
    const openingContext = `Je opent nu de rechtszaak over: ${currentCase.description}. Er is het volgende bewijs beschikbaar: ${currentCase.evidence.join(', ')}. Open de zitting formeel en vraag de officier om te beginnen.`;
    
    await sendBotMessage('rechter', openingContext);
}

// Send bot message with API integration
async function sendBotMessage(botType, contextMessage, isResponseTo = null) {
    updateStatus(botType, 'Denkt na...');
    
    try {
        // Build full context including conversation history
        let fullContext = `RECHTSZAAK: ${currentCase.title}\n`;
        fullContext += `BESCHRIJVING: ${currentCase.description}\n`;
        fullContext += `BEWIJS: ${currentCase.evidence.join('; ')}\n\n`;
        
        if (conversationHistory.length > 0) {
            fullContext += `GESPREKSVERLAUF TOT NU:\n`;
            conversationHistory.forEach(msg => {
                fullContext += `${msg.speaker}: ${msg.message}\n`;
            });
            fullContext += `\n`;
        }
        
        fullContext += `HUIDIGE SITUATIE: ${contextMessage}\n`;
        
        if (isResponseTo) {
            fullContext += `REAGEER OP: "${isResponseTo}"\n`;
        }
        
        fullContext += getCharacterInstructions(botType);

        const response = await fetch(`${API_BASE_URL}/cases/chat`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: fullContext
                    },
                    {
                        role: 'user', 
                        content: 'Reageer nu kort maar realistisch als jouw karakter in deze rechtszaal situatie.'
                    }
                ],
                model: 'gpt-4o-mini'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API fout');
        }

        const data = await response.json();
        const botResponse = data.response;
        
        // Add to conversation history
        conversationHistory.push({
            speaker: getBotName(botType),
            message: botResponse,
            timestamp: new Date().toISOString()
        });
        
        // Display message
        addMessage(botType, botResponse, 'bot');
        updateStatus(botType, 'Heeft gesproken');
        
        // Auto-save progress
        saveProgressSilently();
        
        // Handle conversation flow
        handleConversationFlow(botType, botResponse);
        
    } catch (error) {
        console.error('Bot message error:', error);
        addMessage(botType, `Fout: ${error.message}`, 'system');
        updateStatus(botType, 'Fout opgetreden');
        setTimeout(() => enableDefendantInput(), 2000);
    }
}

// Get character-specific instructions
function getCharacterInstructions(botType) {
    switch (botType) {
        case 'rechter':
            return `\nJe bent Rechter Van der Berg. Leid het gesprek neutraal, stel verhelderende vragen, zorg voor orde. Presenteer bewijs alleen als dat nodig is voor verduidelijking. Wees kort maar autoritair.`;
        case 'officier':
            return `\nJe bent Officier van Justitie Jansen. Presenteer bewijs uit de lijst, stel kritische vragen, probeer schuld aan te tonen. Gebruik het beschikbare bewijs strategisch. Wees professioneel maar assertief.`;
        case 'verdachte':
            return `\nJe bent Alex Vermeer, de verdachte. Reageer menselijk en emotioneel op beschuldigingen. Je kunt onschuldig zijn of schuldig maar met verklaringen. Wees authentiek.`;
    }
}

// Get bot display name
function getBotName(botType) {
    switch (botType) {
        case 'rechter': return 'Rechter Van der Berg';
        case 'officier': return 'Officier Jansen';
        case 'verdachte': return 'Alex Vermeer';
    }
}

// Handle conversation flow after bot speaks
function handleConversationFlow(botType, message) {
    if (conversationState.phase === 'opening' && botType === 'rechter') {
        setTimeout(() => {
            const prosecutorContext = `De rechter heeft de zitting geopend. Presenteer nu de zaak en het eerste stuk bewijs tegen de verdachte. Gebruik concreet bewijs uit de lijst.`;
            sendBotMessage('officier', prosecutorContext);
        }, 2000);
        conversationState.phase = 'active';
        
    } else if (conversationState.phase === 'active') {
        setTimeout(() => {
            enableDefendantInput();
        }, 1500);
    }
}

// Handle defendant message
async function sendMessage(botType) {
    if (botType !== 'verdachte') return;
    
    const input = document.getElementById('verdachte-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add defendant message to history and display
    conversationHistory.push({
        speaker: 'Alex Vermeer (Verdachte - JIJ)',
        message: message,
        timestamp: new Date().toISOString()
    });
    
    addMessage('verdachte', message, 'user');
    input.value = '';
    disableDefendantInput();
    
    // Decide who should respond
    const shouldJudgeRespond = Math.random() < 0.4 || conversationState.judgeInterventions < 2;
    
    if (shouldJudgeRespond && conversationState.judgeInterventions < 3) {
        setTimeout(() => {
            const judgeContext = `De verdachte heeft geantwoord: "${message}". Reageer als rechter - stel vervolgvragen of vraag om verduidelijking. Leid het gesprek.`;
            sendBotMessage('rechter', judgeContext, message);
            conversationState.judgeInterventions++;
        }, 2000);
        
    } else {
        setTimeout(() => {
            conversationState.evidencePresented++;
            const evidenceContext = `De verdachte zegt: "${message}". Reageer hierop als officier van justitie. Presenteer nieuw bewijs of stel kritische vervolgvragen. Gebruik het beschikbare bewijs.`;
            sendBotMessage('officier', evidenceContext, message);
        }, 2000);
        
        // Check if we should move to closing
        if (conversationState.evidencePresented >= Math.min(4, conversationState.totalEvidence)) {
            setTimeout(() => {
                initiateClosing();
            }, 8000);
        }
    }
}

// Initiate closing phase
async function initiateClosing() {
    conversationState.phase = 'closing';
    
    const closingContext = `Het gesprek heeft lang genoeg geduurd. Doe nu je strafeis gebaseerd op al het gepresenteerde bewijs en de reacties van de verdachte. Wees concreet over straf.`;
    await sendBotMessage('officier', closingContext);
    
    setTimeout(() => {
        const verdictContext = `Na het horen van alle argumenten en bewijs, doe nu uitspraak als rechter. Weeg het bewijs en de verdediging tegen elkaar af en kom tot een vonnis.`;
        sendBotMessage('rechter', verdictContext);
        conversationState.phase = 'ended';
        
        setTimeout(() => {
            finishCase();
        }, 6000);
    }, 4000);
}

// Enable/disable defendant input
function enableDefendantInput() {
    const input = document.getElementById('verdachte-input');
    const sendBtn = document.getElementById('verdachte-send-btn');
    
    input.disabled = false;
    input.placeholder = 'Typ je reactie... (reageer op wat er gezegd is)';
    sendBtn.disabled = false;
    
    updateStatus('verdachte', 'Jouw beurt - reageer op het gesprek');
    input.focus();
}

function disableDefendantInput() {
    const input = document.getElementById('verdachte-input');
    const sendBtn = document.getElementById('verdachte-send-btn');
    
    input.disabled = true;
    input.placeholder = 'De bots zijn aan het reageren...';
    sendBtn.disabled = true;
    
    updateStatus('verdachte', 'Wacht op reacties...');
}

// Save progress
async function saveProgress() {
    try {
        const response = await fetch(`${API_BASE_URL}/progress/update-progress`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                caseId: parseInt(caseId),
                conversationLog: conversationHistory,
                timeSpent: getElapsedTime()
            })
        });
        
        if (response.ok) {
            alert('Voortgang opgeslagen!');
        }
    } catch (error) {
        console.error('Error saving progress:', error);
    }
}

// Save progress silently (auto-save)
async function saveProgressSilently() {
    try {
        await fetch(`${API_BASE_URL}/progress/update-progress`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                caseId: parseInt(caseId),
                conversationLog: conversationHistory,
                timeSpent: getElapsedTime()
            })
        });
    } catch (error) {
        console.error('Auto-save error:', error);
    }
}

// Finish case
async function finishCase() {
    stopTimer();
    const finalScore = calculateScore();
    
    try {
        const response = await fetch(`${API_BASE_URL}/progress/complete-case`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                caseId: parseInt(caseId),
                score: finalScore,
                timeSpent: getElapsedTime(),
                conversationLog: conversationHistory
            })
        });
        
        if (response.ok) {
            showScoreModal(finalScore);
        }
    } catch (error) {
        console.error('Error completing case:', error);
        showScoreModal(finalScore);
    }
    
    // Update status
    ['rechter', 'officier', 'verdachte'].forEach(botType => {
        updateStatus(botType, 'Zaak voltooid');
    });
}

// Calculate score based on various factors
function calculateScore() {
    let score = 50; // Base score
    
    // Time bonus (faster = better, but not too fast)
    const timeSpent = getElapsedTime();
    if (timeSpent < 300) score += 10; // Under 5 minutes
    else if (timeSpent < 600) score += 20; // Under 10 minutes
    else if (timeSpent < 900) score += 15; // Under 15 minutes
    else if (timeSpent < 1200) score += 10; // Under 20 minutes
    
    // Participation bonus
    const userMessages = conversationHistory.filter(msg => msg.speaker.includes('JIJ')).length;
    if (userMessages >= 5) score += 20;
    else if (userMessages >= 3) score += 15;
    else if (userMessages >= 1) score += 10;
    
    // Engagement bonus (longer messages show more thought)
    const avgMessageLength = conversationHistory
        .filter(msg => msg.speaker.includes('JIJ'))
        .reduce((sum, msg) => sum + msg.message.length, 0) / userMessages;
    
    if (avgMessageLength > 100) score += 15;
    else if (avgMessageLength > 50) score += 10;
    else if (avgMessageLength > 20) score += 5;
    
    // Cap at 100
    return Math.min(100, Math.max(0, score));
}

// Show score modal
function showScoreModal(score) {
    document.getElementById('finalScore').textContent = `${score}%`;
    
    const breakdown = document.getElementById('scoreBreakdown');
    breakdown.innerHTML = `
        <div class="score-details">
            <h4>Score Details:</h4>
            <p>🏆 <strong>Totale Score:</strong> ${score}%</p>
            <p>💬 <strong>Berichten verstuurd:</strong> ${conversationHistory.filter(msg => msg.speaker.includes('JIJ')).length}</p>
            <p>⏱️ <strong>Tijd besteed:</strong> ${Math.floor(getElapsedTime() / 60)} minuten</p>
            <p>📝 <strong>Gesprek voltooid:</strong> ${conversationState.phase === 'ended' ? 'Ja' : 'Nee'}</p>
        </div>
        <div class="score-feedback">
            ${getScoreFeedback(score)}
        </div>
    `;
    
    document.getElementById('scoreModal').style.display = 'block';
}

// Get score feedback
function getScoreFeedback(score) {
    if (score >= 90) {
        return '<p class="feedback excellent">🌟 <strong>Uitstekend!</strong> Je hebt deze rechtszaak perfect afgehandeld!</p>';
    } else if (score >= 80) {
        return '<p class="feedback good">👍 <strong>Goed gedaan!</strong> Je toont goede juridische vaardigheden.</p>';
    } else if (score >= 70) {
        return '<p class="feedback average">📚 <strong>Redelijk!</strong> Er is nog ruimte voor verbetering.</p>';
    } else if (score >= 60) {
        return '<p class="feedback below-average">💪 <strong>Oké!</strong> Blijf oefenen om beter te worden.</p>';
    } else {
        return '<p class="feedback poor">🎯 <strong>Probeer het nog eens!</strong> Meer participatie zal je score verbeteren.</p>';
    }
}

// End case manually
function endCase() {
    if (confirm('Weet je zeker dat je deze zaak wilt beëindigen?')) {
        finishCase();
    }
}

// Navigation functions
function goToDashboard() {
    window.location.href = 'dashboard.html';
}

function startNewCase() {
    window.location.href = 'dashboard.html';
}

// Utility functions
function addMessage(botType, message, sender) {
    const messagesContainer = document.getElementById(`${botType}-messages`);
    const messageDiv = document.createElement('div');
    
    let className = 'message ';
    if (sender === 'user') {
        className += 'user-message';
    } else if (sender === 'system') {
        className += 'system-message';
    } else {
        className += 'bot-message';
    }
    
    messageDiv.className = className;
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateStatus(botType, status) {
    const statusElement = document.getElementById(`${botType}-status`);
    statusElement.textContent = status;
    
    statusElement.className = 'status-indicator';
    if (status.includes('Denkt') || status.includes('Bezig')) {
        statusElement.classList.add('thinking');
    } else if (status.includes('beurt') || status.includes('Wacht')) {
        statusElement.classList.add('waiting');
    }
}

function handleKeyPress(event, botType) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage(botType);
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        if (event.target.id !== 'scoreModal') { // Don't close score modal by clicking outside
            event.target.style.display = 'none';
        }
    }
}