// Check authentication and role
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    
    const user = JSON.parse(localStorage.getItem('user'));
    if (user.role !== 'admin' && user.role !== 'teacher') {
        alert('Je hebt geen toegang tot deze pagina');
        window.location.href = 'dashboard.html';
        return;
    }
    
    showStudents(); // Show students section by default
});

let currentStudents = [];
let currentCases = [];

// Navigation functions
function showStudents() {
    hideAllSections();
    document.getElementById('studentsSection').style.display = 'block';
    setActiveNav('students');
    loadStudents();
}

function showCases() {
    hideAllSections();
    document.getElementById('casesSection').style.display = 'block';
    setActiveNav('cases');
    loadCasesAdmin();
}

function showAnalytics() {
    hideAllSections();
    document.getElementById('analyticsSection').style.display = 'block';
    setActiveNav('analytics');
    loadAnalytics();
}

function hideAllSections() {
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });
}

function setActiveNav(activeSection) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[href="#${activeSection}"]`).classList.add('active');
}

// Load students
async function loadStudents() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            currentStudents = await response.json();
            displayStudents(currentStudents);
        } else {
            console.error('Error loading students');
        }
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

// Display students
function displayStudents(students) {
    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Geen studenten gevonden</td></tr>';
        return;
    }
    
    students.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.first_name} ${student.last_name}</td>
            <td>${student.student_number}</td>
            <td>${student.email}</td>
            <td>${student.completed_cases || 0}</td>
            <td>${Math.round(student.average_score || 0)}%</td>
            <td>${student.last_login ? new Date(student.last_login).toLocaleDateString() : 'Nooit'}</td>
            <td>
                <button onclick="viewStudent(${student.id})" class="btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.5rem;">
                    👁️ Bekijk
                </button>
                <button onclick="editStudent(${student.id})" class="btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                    ✏️ Bewerk
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Search students
function searchStudents() {
    const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
    const filteredStudents = currentStudents.filter(student => 
        student.first_name.toLowerCase().includes(searchTerm) ||
        student.last_name.toLowerCase().includes(searchTerm) ||
        student.email.toLowerCase().includes(searchTerm) ||
        student.student_number.toLowerCase().includes(searchTerm)
    );
    displayStudents(filteredStudents);
}

// View student details
async function viewStudent(studentId) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/${studentId}`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            showStudentDetailModal(data);
        }
    } catch (error) {
        console.error('Error loading student details:', error);
    }
}

// Show student detail modal
function showStudentDetailModal(data) {
    const { student, progress, achievements } = data;
    
    const modalContent = `
        <div class="modal" id="studentDetailModal" style="display: block;">
            <div class="modal-content large">
                <div class="modal-header">
                    <h3>👤 ${student.first_name} ${student.last_name}</h3>
                    <button class="close" onclick="closeStudentDetail()">&times;</button>
                </div>
                <div class="student-detail-content">
                    <div class="student-info-grid">
                        <div class="student-basic-info">
                            <h4>Algemene Informatie</h4>
                            <p><strong>Email:</strong> ${student.email}</p>
                            <p><strong>Studentnummer:</strong> ${student.student_number}</p>
                            <p><strong>Lid sinds:</strong> ${new Date(student.created_at).toLocaleDateString()}</p>
                            <p><strong>Laatste login:</strong> ${student.last_login ? new Date(student.last_login).toLocaleDateString() : 'Nooit'}</p>
                        </div>
                        
                        <div class="student-stats">
                            <h4>Statistieken</h4>
                            <p><strong>Voltooide zaken:</strong> ${student.completed_cases || 0}</p>
                            <p><strong>Gemiddelde score:</strong> ${Math.round(student.average_score || 0)}%</p>
                            <p><strong>Totale tijd:</strong> ${Math.round((student.total_time || 0) / 60)} minuten</p>
                            <p><strong>Prestaties:</strong> ${achievements.length}</p>
                        </div>
                    </div>
                    
                    <div class="student-progress">
                        <h4>Recente Voortgang</h4>
                        <div class="progress-list">
                            ${progress.slice(0, 5).map(item => `
                                <div class="progress-item">
                                    <div class="progress-info">
                                        <h5>${item.case_title}</h5>
                                        <p>Status: ${getStatusText(item.status)} • Score: ${item.score || 0}% • ${new Date(item.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="student-achievements">
                        <h4>🏆 Prestaties</h4>
                        <div class="achievements-grid">
                            ${achievements.map(achievement => `
                                <div class="achievement-card">
                                    <div class="achievement-icon">🏆</div>
                                    <div class="achievement-name">${achievement.achievement_name}</div>
                                    <div class="achievement-description">${achievement.description}</div>
                                    <small>${new Date(achievement.earned_at).toLocaleDateString()}</small>
                                </div>
                            `).join('') || '<p>Nog geen prestaties behaald</p>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalContent);
}

function closeStudentDetail() {
    const modal = document.getElementById('studentDetailModal');
    if (modal) {
        modal.remove();
    }
}

// Load cases for admin
async function loadCasesAdmin() {
    try {
        const response = await fetch(`${API_BASE_URL}/cases`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            currentCases = await response.json();
            displayCasesAdmin(currentCases);
        }
    } catch (error) {
        console.error('Error loading cases:', error);
    }
}

// Display cases for admin
function displayCasesAdmin(cases) {
    const casesGrid = document.getElementById('casesAdminGrid');
    casesGrid.innerHTML = '';
    
    cases.forEach(caseItem => {
        const caseCard = document.createElement('div');
        caseCard.className = 'case-card';
        caseCard.innerHTML = `
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
            <div class="case-evidence">
                <strong>Bewijs items:</strong> ${caseItem.evidence.length}
            </div>
            <div class="case-actions">
                <button class="btn-secondary" onclick="editCase(${caseItem.id})" style="margin-right: 0.5rem;">
                    ✏️ Bewerk
                </button>
                <button class="btn-start" onclick="testCase(${caseItem.id})">
                    🧪 Test
                </button>
            </div>
        `;
        casesGrid.appendChild(caseCard);
    });
}

// Show add case modal
function showAddCase() {
    document.getElementById('caseModalTitle').textContent = 'Nieuwe Rechtszaak';
    document.getElementById('caseForm').reset();
    document.getElementById('caseModal').style.display = 'block';
}

// Edit case
function editCase(caseId) {
    const caseItem = currentCases.find(c => c.id === caseId);
    if (!caseItem) return;
    
    document.getElementById('caseModalTitle').textContent = 'Rechtszaak Bewerken';
    document.getElementById('caseTitle').value = caseItem.title;
    document.getElementById('caseDescription').value = caseItem.description;
    document.getElementById('caseCategory').value = caseItem.category;
    document.getElementById('caseDifficulty').value = caseItem.difficulty_level;
    document.getElementById('caseEvidence').value = caseItem.evidence.join('\n');
    
    // Store case ID for update
    document.getElementById('caseForm').dataset.caseId = caseId;
    document.getElementById('caseModal').style.display = 'block';
}

// Close case modal
function closeCaseModal() {
    document.getElementById('caseModal').style.display = 'none';
}

// Handle case form submission
document.addEventListener('DOMContentLoaded', () => {
    const caseForm = document.getElementById('caseForm');
    if (caseForm) {
        caseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('caseTitle').value;
            const description = document.getElementById('caseDescription').value;
            const category = document.getElementById('caseCategory').value;
            const difficulty_level = document.getElementById('caseDifficulty').value;
            const evidence = document.getElementById('caseEvidence').value.split('\n').filter(e => e.trim());
            
            const caseId = caseForm.dataset.caseId;
            const isEdit = !!caseId;
            
            try {
                const url = isEdit ? `${API_BASE_URL}/cases/${caseId}` : `${API_BASE_URL}/cases`;
                const method = isEdit ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method,
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        title,
                        description,
                        evidence,
                        difficulty_level: parseInt(difficulty_level),
                        category
                    })
                });
                
                if (response.ok) {
                    alert(isEdit ? 'Rechtszaak bijgewerkt!' : 'Rechtszaak aangemaakt!');
                    closeCaseModal();
                    loadCasesAdmin();
                    delete caseForm.dataset.caseId;
                } else {
                    const data = await response.json();
                    alert(data.error);
                }
            } catch (error) {
                alert('Er ging iets mis');
            }
        });
    }
});

// Test case
function testCase(caseId) {
    window.open(`rechtszaal.html?caseId=${caseId}`, '_blank');
}

// Load analytics
async function loadAnalytics() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const stats = await response.json();
            displayAnalytics(stats);
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Display analytics
function displayAnalytics(stats) {
    document.getElementById('totalStudents').textContent = stats.totalStudents || 0;
    document.getElementById('activeStudents').textContent = stats.activeStudents || 0;
    document.getElementById('totalCompletedCases').textContent = stats.totalCompletedCases || 0;
    document.getElementById('overallAverageScore').textContent = `${stats.overallAverageScore || 0}%`;
    document.getElementById('weeklyRegistrations').textContent = stats.weeklyRegistrations || 0;
    document.getElementById('weeklyCases').textContent = stats.weeklyCases || 0;
    
    // Top performers
    const topPerformersDiv = document.getElementById('topPerformers');
    if (stats.topPerformers && stats.topPerformers.length > 0) {
        topPerformersDiv.innerHTML = stats.topPerformers.map((student, index) => `
            <div style="margin-bottom: 0.5rem;">
                ${index + 1}. ${student.first_name} ${student.last_name} 
                <br><small>${Math.round(student.average_score)}% avg (${student.completed_cases} zaken)</small>
            </div>
        `).join('');
    } else {
        topPerformersDiv.innerHTML = 'Geen data beschikbaar';
    }
}

// Show add student modal
function showAddStudent() {
    // Implementation for adding new student
    const studentForm = prompt('Deze functie wordt binnenkort toegevoegd');
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}