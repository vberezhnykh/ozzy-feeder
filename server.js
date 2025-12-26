
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const uri = process.env.MONGODB_URI;
let statesCollection = null;
let isConnected = false;

// Инициализация Gemini (используем API_KEY из окружения)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function connectDB() {
  if (!uri) {
    console.warn("⚠️ MONGODB_URI not found in Environment Variables.");
    return;
  }
  
  try {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
    
    await client.connect();
    const db = client.db('ozzy_tracker');
    statesCollection = db.collection('family_states');
    
    await db.command({ ping: 1 });
    isConnected = true;
    console.log("✅ Successfully connected to MongoDB Atlas");
  } catch (e) {
    isConnected = false;
    console.error("❌ MongoDB Connection Error:", e.message);
  }
}

connectDB();

app.use(cors());
app.use(bodyParser.json());

app.get('/api/health', (req, res) => {
  res.json({ dbConnected: isConnected });
});

// Новый эндпоинт для AI советов
app.post('/api/ai-advice', async (req, res) => {
  const { weight, age, consumed, norm } = req.body;
  
  if (!process.env.API_KEY) {
    return res.json({ advice: "Добавьте API_KEY для получения советов от ИИ." });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Котенку ${age.toFixed(1)} месяцев, вес ${weight.toFixed(2)}кг. Сегодня съел ${consumed.toFixed(0)}г при норме ${norm.toFixed(0)}г. 
      Дай ОДИН очень короткий (до 15 слов) заботливый совет на русском языке. Используй имя котенка Оззи.`,
    });
    res.json({ advice: response.text });
  } catch (error) {
    res.json({ advice: "Оззи сегодня просто милашка!" });
  }
});

const memoryDb = {};

app.get('/api/state/:familyId', async (req, res) => {
  const { familyId } = req.params;
  
  if (statesCollection) {
    try {
      const doc = await statesCollection.findOne({ _id: familyId });
      return res.json(doc ? doc.state : null);
    } catch (e) {
      console.error("Read error:", e.message);
    }
  }
  
  res.json(memoryDb[familyId] || null);
});

app.post('/api/state/:familyId', async (req, res) => {
  const { familyId } = req.params;
  const newState = req.body;

  if (statesCollection) {
    try {
      await statesCollection.updateOne(
        { _id: familyId },
        { $set: { state: newState, updatedAt: new Date() } },
        { upsert: true }
      );
      return res.json({ success: true });
    } catch (e) {
      console.error("Write error:", e.message);
      return res.status(500).json({ error: "Database write failed" });
    }
  }

  memoryDb[familyId] = newState;
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
