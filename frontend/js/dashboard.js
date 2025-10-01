// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    
    loadUserData();
    loadStats();
    loadCases();
    loadProgress();
    loadAchievements();
});

// Load user data
async function loadUserData() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        document.getElementById('userName').textContent = `${user.firstName} ${user.lastName}`;
        document.getElementById('userFirstName').textContent = user.firstName;
        
        // Load full profile
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const profile = await response.json();
            updateProfileModal(profile);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/progress/stats`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('completedCases').textContent = stats.completed_cases || 0;
            document.getElementById('averageScore').textContent = `${Math.round(stats.average_score || 0)}%`;
            document.getElementById('totalTime').textContent = `${Math.round((stats.total_time || 0) / 60)}min`;
            
            // Load achievements count
            loadAchievementsCount();
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load available cases
async function loadCases() {
    try {
        const response = await fetch(`${API_BASE_URL}/cases`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const cases = await response.json();
            displayCases(cases);
        }
    } catch (error) {
        console.error('Error loading cases:', error);
    }
}

// Display cases
function displayCases(cases) {
    const casesGrid = document.getElementById('casesGrid');
    casesGrid.innerHTML = '';
    
    cases.forEach(caseItem => {
        const caseCard = createCaseCard(caseItem);
        casesGrid.appendChild(caseCard);
    });
}

// Create case card
function createCaseCard(caseItem) {
    const card = document.createElement('div');
    card.className = 'case-card';
    
    card.innerHTML = `
        <div class="case-header">
            <div>
                <div class="case-title">${caseItem.title}</div>
                <div class="case-category">${caseItem.category}</div>
            </div>
            <div class="difficulty-badge difficulty-${caseItem.difficulty_level}">
                Niveau ${caseItem.difficulty_level}
            </div>
        </div>
        <div class="case-description">
            ${caseItem.description.substring(0, 150)}...
        </div>
        <div class="case-actions">
            <button class="btn-start" onclick="startCase(${caseItem.id})">
                🎬 Start Zaak
            </button>
        </div>
    `;
    
    return card;
}

// Start case
async function startCase(caseId) {
    try {
        const response = await fetch(`${API_BASE_URL}/progress/start-case`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ caseId })
        });
        
        if (response.ok) {
            // Redirect to rechtszaal with case ID
            window.location.href = `rechtszaal.html?caseId=${caseId}`;
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        alert('Er ging iets mis bij het starten van de zaak');
    }
}

// Load progress
async function loadProgress() {
    try {
        const response = await fetch(`${API_BASE_URL}/progress`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const progress = await response.json();
            displayProgress(progress.slice(0, 5)); // Show last 5
        }
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// Display progress
function displayProgress(progress) {
    const progressList = document.getElementById('progressList');
    progressList.innerHTML = '';
    
    if (progress.length === 0) {
        progressList.innerHTML = '<div class="loading">Nog geen zaken voltooid</div>';
        return;
    }
    
    progress.forEach(item => {
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        
        progressItem.innerHTML = `
            <div class="progress-info">
                <h4>${item.case_title}</h4>
                <p>Status: ${getStatusText(item.status)} • ${new Date(item.created_at).toLocaleDateString()}</p>
            </div>
            <div class="progress-score">
                ${item.status === 'completed' ? item.score + '%' : '-'}
            </div>
        `;
        
        progressList.appendChild(progressItem);
    });
}

// Get status text
function getStatusText(status) {
    switch (status) {
        case 'started': return 'Gestart';
        case 'completed': return 'Voltooid';
        case 'failed': return 'Mislukt';
        default: return status;
    }
}

// Load achievements
async function loadAchievements() {
    // This would connect to achievements API
    // For now, show placeholder
    const achievementsGrid = document.getElementById('achievementsGrid');
    achievementsGrid.innerHTML = '<div class="loading">Prestaties worden geladen...</div>';
}

// Load achievements count
async function loadAchievementsCount() {
    // For now, set to 0
    document.getElementById('achievements').textContent = '0';
}

// Profile Modal Functions
function showProfile() {
    document.getElementById('profileModal').style.display = 'block';
}

function closeProfile() {
    document.getElementById('profileModal').style.display = 'none';
}

function updateProfileModal(profile) {
    document.getElementById('profileName').textContent = `${profile.first_name} ${profile.last_name}`;
    document.getElementById('profileEmail').textContent = profile.email;
    document.getElementById('profileStudentNumber').textContent = profile.student_number;
    document.getElementById('profileRole').textContent = profile.role;
    document.getElementById('profileCreated').textContent = new Date(profile.created_at).toLocaleDateString();
    document.getElementById('apiKeyStatus').textContent = profile.has_openai_key ? '✅ API key geconfigureerd' : '❌ Geen API key';
}

// Update API Key
async function updateApiKey() {
    const newApiKey = document.getElementById('newApiKey').value;
    
    if (!newApiKey) {
        alert('Voer een API key in');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/update-api-key`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ openaiApiKey: newApiKey })
        });
        
        if (response.ok) {
            alert('API key succesvol bijgewerkt!');
            document.getElementById('newApiKey').value = '';
            document.getElementById('apiKeyStatus').textContent = '✅ API key geconfigureerd';
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        alert('Er ging iets mis bij het updaten van de API key');
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('profileModal');
    if (event.target === modal) {
        closeProfile();
    }
}