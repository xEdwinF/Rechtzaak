-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK(role IN ('student', 'teacher', 'admin')),
    openai_api_key TEXT,
    student_number VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Legal cases table
CREATE TABLE IF NOT EXISTS legal_cases (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    evidence JSONB NOT NULL,
    difficulty_level INTEGER DEFAULT 1 CHECK(difficulty_level BETWEEN 1 AND 5),
    category VARCHAR(50) DEFAULT 'algemeen',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- User progress table
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    case_id INTEGER NOT NULL REFERENCES legal_cases(id),
    status VARCHAR(20) DEFAULT 'started' CHECK(status IN ('started', 'completed', 'failed')),
    score INTEGER DEFAULT 0,
    conversation_log JSONB,
    time_spent INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    achievement_type VARCHAR(50) NOT NULL,
    achievement_name VARCHAR(100) NOT NULL,
    description TEXT,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default legal cases
INSERT INTO legal_cases (id, title, description, evidence, difficulty_level, category) 
VALUES 
(1, 'Dronediefstal in Techstad', 
'In de stad Techstad wordt steeds vaker gebruik gemaakt van drones om pakketjes te bezorgen. Een innovatieve startup, SkyDrop BV, test nieuwe modellen. Op een dag wordt één van hun prototypes gestolen uit een afgesloten testhal. De waarde van de drone wordt geschat op €75.000.', 
'["Camerabeelden tonen Alex Vermeer om 22:15 bij het bedrijfsterrein", "Vingerafdrukken op het hek rondom de testhal", "Getuige zag verdachte wegrennen met grote tas", "Drone werd 2 dagen later aangeboden op Marktplaats vanuit Alex'' stad", "Alex'' telefoon was actief in de buurt van het bedrijf die avond"]'::jsonb, 
3, 'diefstal')
ON CONFLICT (id) DO NOTHING;

INSERT INTO legal_cases (id, title, description, evidence, difficulty_level, category) 
VALUES 
(2, 'Fietsendiefstal bij Universiteit', 
'Alex Vermeer wordt beschuldigd van het stelen van een elektrische fiets ter waarde van €2.800 uit de beveiligde fietsenstalling van de universiteit.',
'["HD-camerabeelden van 23:30 tonen duidelijk Alex bij de fietsenstalling", "Sleutelsporen op het slot van de gestolen fiets", "Alex bezat geen studentenkaart voor toegang tot de stalling", "De eigenaar kan bewijzen dat zijn fiets er wel stond die avond", "Beveiligingsmedewerker herkende Alex van eerdere waarschuwingen"]'::jsonb,
2, 'diefstal')
ON CONFLICT (id) DO NOTHING;

INSERT INTO legal_cases (id, title, description, evidence, difficulty_level, category) 
VALUES 
(3, 'Winkeldiefstal bij MegaTech', 
'In elektronicawinkel MegaTech is een MacBook Pro ter waarde van €2.400 gestolen tijdens openingstijden.',
'["Beveiligingscamera toont Alex de laptop in zijn rugzak stoppen", "Magnetische sensoren bij de uitgang gingen af toen Alex vertrok", "Kassamedewerker zag Alex nerveus rondkijken bij de laptops", "Alex verliet haastig de winkel zonder iets te kopen", "Dezelfde laptop werd die avond online verkocht vanuit Alex'' buurt"]'::jsonb,
1, 'diefstal')
ON CONFLICT (id) DO NOTHING;