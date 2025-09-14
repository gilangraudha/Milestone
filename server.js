const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Email validation function
function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Database initialization
async function initializeDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        service_interest VARCHAR(255),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const adminExists = await pool.query("SELECT 1 FROM users WHERE email = 'admin@mail.com' LIMIT 1");
    if (adminExists.rowCount === 0) {
      await pool.query(
        "INSERT INTO users (full_name, email, password, role) VALUES ($1, $2, $3, $4)",
        ['Admin User', 'admin@mail.com', 'admin123', 'admin']
      );
      console.log('Default admin user created: admin@mail.com / admin123');
    }
    console.log('Database tables checked/created successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// User registration endpoint
app.post('/api/register', async (req, res) => {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role',
      [full_name, email, password, 'user']
    );
    res.status(201).json({ message: 'User registered successfully.', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email already registered.' });
    }
    console.error('Error during registration:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// User login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  try {
    const result = await pool.query('SELECT id, full_name, email, password, role FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || password !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    res.status(200).json({
      message: 'Login successful.',
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
  const { full_name, email, service_interest, message } = req.body;
  if (!full_name || !email || !message) {
    return res.status(400).json({ message: 'Full Name, Email, and Message are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO contacts (full_name, email, service_interest, message) VALUES ($1, $2, $3, $4) RETURNING id',
      [full_name, email, service_interest, message]
    );
    res.status(201).json({ message: 'Message sent successfully.', contactId: result.rows[0].id });
  } catch (err) {
    console.error('Error submitting contact form:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Admin contacts retrieval endpoint
app.get('/api/admin/contacts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at ASC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching contacts for admin:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Single contact retrieval endpoint
app.get('/api/admin/contacts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Contact message not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching single contact:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Contact update endpoint
app.put('/api/contacts/:id', async (req, res) => {
  const { id } = req.params;
  const { full_name } = req.body;

  if (!full_name) {
    return res.status(400).json({ message: 'Full Name is required for update.' });
  }

  try {
    const result = await pool.query(
      'UPDATE contacts SET full_name = $1 WHERE id = $2 RETURNING *',
      [full_name, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Contact message not found.' });
    }
    res.status(200).json({ message: 'Contact name updated successfully.', contact: result.rows[0] });
  } catch (err) {
    console.error('Error updating contact message:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Contact deletion endpoint
app.delete('/api/contacts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Contact message not found.' });
    }
    res.status(200).json({ message: 'Contact message deleted successfully.', deletedId: id });
  } catch (err) {
    console.error('Error deleting contact message:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  initializeDb();
});