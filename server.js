
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Временное хранилище в памяти сервера
// В продакшене здесь должна быть база данных
const db = {};

// API для получения данных
app.get('/api/state/:familyId', (req, res) => {
  const { familyId } = req.params;
  res.json(db[familyId] || null);
});

// API для сохранения данных
app.post('/api/state/:familyId', (req, res) => {
  const { familyId } = req.params;
  db[familyId] = req.body;
  console.log(`Updated state for family: ${familyId}`);
  res.json({ success: true });
});

// Раздача статических файлов фронтенда после сборки (Vite build)
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
