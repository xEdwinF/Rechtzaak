-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT DEFAULT 'student' CHECK(role IN ('student', 'teacher', 'admin')),
    openai_api_key TEXT,
    student_number TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT 1
);

-- Legal cases table
CREATE TABLE IF NOT EXISTS legal_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence JSON NOT NULL,
    difficulty_level INTEGER DEFAULT 1 CHECK(difficulty_level BETWEEN 1 AND 5),
    category TEXT DEFAULT 'algemeen',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- User progress table
CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    case_id INTEGER NOT NULL,
    status TEXT DEFAULT 'started' CHECK(status IN ('started', 'completed', 'failed')),
    score INTEGER DEFAULT 0,
    conversation_log JSON,
    time_spent INTEGER DEFAULT 0, -- in seconds
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (case_id) REFERENCES legal_cases(id)
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_type TEXT NOT NULL,
    achievement_name TEXT NOT NULL,
    description TEXT,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insert default admin user (password: admin123)
INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, role, student_number) 
VALUES ('admin@school.nl', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin', 'ADMIN001');

-- Insert default legal cases
INSERT OR IGNORE INTO legal_cases (title, description, evidence, difficulty_level, category) VALUES
('Dronediefstal in Techstad', 'In de stad Techstad wordt steeds vaker gebruik gemaakt van drones om pakketjes te bezorgen. Een innovatieve startup, SkyDrop BV, test nieuwe modellen. Op een dag wordt één van hun prototypes gestolen uit een afgesloten testhal. De waarde van de drone wordt geschat op €75.000.', 
'["Camerabeelden tonen Alex Vermeer om 22:15 bij het bedrijfsterrein", "Vingerafdrukken op het hek rondom de testhal", "Getuige zag verdachte wegrennen met grote tas", "Drone werd 2 dagen later aangeboden op Marktplaats vanuit Alex'' stad", "Alex'' telefoon was actief in de buurt van het bedrijf die avond"]', 
3, 'diefstal'),

('Fietsendiefstal bij Universiteit', 'Alex Vermeer wordt beschuldigd van het stelen van een elektrische fiets ter waarde van €2.800 uit de beveiligde fietsenstalling van de universiteit.',
'["HD-camerabeelden van 23:30 tonen duidelijk Alex bij de fietsenstalling", "Sleutelsporen op het slot van de gestolen fiets", "Alex bezat geen studentenkaart voor toegang tot de stalling", "De eigenaar kan bewijzen dat zijn fiets er wel stond die avond", "Beveiligingsmedewerker herkende Alex van eerdere waarschuwingen"]',
2, 'diefstal'),

('Winkeldiefstal bij MegaTech', 'In elektronicawinkel MegaTech is een MacBook Pro ter waarde van €2.400 gestolen tijdens openingstijden.',
'["Beveiligingscamera toont Alex de laptop in zijn rugzak stoppen", "Magnetische sensoren bij de uitgang gingen af toen Alex vertrok", "Kassamedewerker zag Alex nerveus rondkijken bij de laptops", "Alex verliet haastig de winkel zonder iets te kopen", "Dezelfde laptop werd die avond online verkocht vanuit Alex'' buurt"]',
1, 'diefstal');