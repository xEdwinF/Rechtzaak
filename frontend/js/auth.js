// API Base URL - change this to your deployed backend URL
const API_BASE_URL = 'http://localhost:3000/api';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authMessage = document.getElementById('authMessage');

// Event Listeners
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
}

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token && !window.location.pathname.includes('login')) {
        // Redirect to dashboard if already logged in
        window.location.href = 'dashboard.html';
    }
});

// Show/Hide Forms
function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function showLogin() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

// Handle Login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect based on role
            if (data.user.role === 'admin' || data.user.role === 'teacher') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        } else {
            showMessage(data.error, 'error');
        }
    } catch (error) {
        showMessage('Er ging iets mis. Probeer het opnieuw.', 'error');
    }
}

// Handle Register
async function handleRegister(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('registerFirstName').value;
    const lastName = document.getElementById('registerLastName').value;
    const email = document.getElementById('registerEmail').value;
    const studentNumber = document.getElementById('registerStudentNumber').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const openaiApiKey = document.getElementById('registerOpenAIKey').value;
    
    // Validation
    if (password !== confirmPassword) {
        showMessage('Wachtwoorden komen niet overeen', 'error');
        return;
    }
    
    if (!openaiApiKey || !openaiApiKey.startsWith('sk-')) {
        showMessage('Voer een geldige OpenAI API key in', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                studentNumber,
                password,
                openaiApiKey
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            showMessage('Account succesvol aangemaakt!', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        } else {
            showMessage(data.error, 'error');
        }
    } catch (error) {
        showMessage('Er ging iets mis. Probeer het opnieuw.', 'error');
    }
}

// Show Message
function showMessage(message, type) {
    authMessage.textContent = message;
    authMessage.className = `message ${type}`;
    authMessage.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
        authMessage.style.display = 'none';
    }, 5000);
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Check Authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Get Auth Header
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}