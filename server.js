const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); 

const app = express();
const port = 3000;
const USERS_DB_PATH = path.join(__dirname, 'users.json');
const JWT_SECRET = 'your-super-secret-key-change-this'; // IMPORTANT: Change this to a long, random string

// --- Middleware ---
app.use(cors());
app.use(express.json()); // Middleware to parse JSON request bodies

// --- Helper Functions ---
const readUsers = async () => {
    try {
        const data = await fs.readFile(USERS_DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return []; // If file doesn't exist, return empty array
        throw error;
    }
};

const writeUsers = async (users) => {
    await fs.writeFile(USERS_DB_PATH, JSON.stringify(users, null, 2));
};

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (token == null) {
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // Forbidden
        }
        req.user = user;
        next();
    });
};


// --- Authentication API Endpoints ---

// Register a new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const users = await readUsers();
        if (users.find(user => user.email === email)) {
            return res.status(409).json({ message: 'User with this email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now().toString(), name, email, password: hashedPassword };
        
        users.push(newUser);
        await writeUsers(users);

        res.status(201).json({ message: 'User registered successfully!' });

    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// Login a user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = await readUsers();
        const user = users.find(u => u.email === email);

        if (!user || !await bcrypt.compare(password, user.password)) {
             return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Create JWT token
        const accessToken = jwt.sign({ name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ accessToken, userName: user.name });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});


// --- Protected Data API Endpoints ---

// Get all farms (now requires authentication)
app.get('/api/farms', authenticateToken, async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'js', 'data', 'farms.json');
        const data = await fs.readFile(filePath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).send('Error fetching farm list');
    }
});

// Get a specific farm's data (now requires authentication)
app.get('/api/farms/:farmId', authenticateToken, async (req, res) => {
    const { farmId } = req.params;
    if (!/^[a-z0-9_]+$/.test(farmId)) {
        return res.status(400).send('Invalid farm ID format');
    }
    try {
        const filePath = path.join(__dirname, 'js', 'data', `${farmId}.json`);
        const data = await fs.readFile(filePath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(404).send(`Data for farm '${farmId}' not found.`);
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Agrasia server listening at http://localhost:${port}`);
});