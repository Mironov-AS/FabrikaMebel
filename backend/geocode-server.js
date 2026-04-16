/**
 * Standalone geocode-llm microservice on port 3003
 * Handles POST /api/geocode-llm and GET /api/geocode-llm/status
 */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { authenticate } = require('./src/middleware/auth');
const db = require('./src/db');

const geocodeLlmRouter = require('./src/routes/geocodeLlm');

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5175', /\.proxy\.daytona\.works$/, /\.preview\.promto\.ai$/],
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

app.use('/api/geocode-llm', geocodeLlmRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'geocode-llm' }));

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.GEOCODE_PORT || 3003;

db.init().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Geocode-LLM service running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
