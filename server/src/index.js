require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const accountsRoutes = require('./routes/accounts');
const contactsRoutes = require('./routes/contacts');
const relationshipsRoutes = require('./routes/relationships');
const opportunitiesRoutes = require('./routes/opportunities');
const activitiesRoutes = require('./routes/activities');

const app = express();
const PORT = process.env.PORT || 5000;

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://davidrpetrone.github.io',
  process.env.FRONTEND_URL,
].filter(Boolean);
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

// Initialize DB on startup
initDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/relationships', relationshipsRoutes);
app.use('/api/opportunities', opportunitiesRoutes);
app.use('/api/activities', activitiesRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`TRC CRM server running on port ${PORT}`));
