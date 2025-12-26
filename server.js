
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

// Инициализация Gemini
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

// --- МЕХАНИЗМ KEEP-ALIVE (АНТИ-СОН) ---
const keepAlive = () => {
  const hostname = process.env.RENDER_EXTERNAL_HOSTNAME;
  if (hostname) {
    const url = `https://${hostname}.onrender.com/api/health`;
    setInterval(async () => {
      try {
        await fetch(url);
        console.log(`[Keep-Alive] Pinged ${url} at ${new Date().toISOString()}`);
      } catch (err) {
        console.error('[Keep-Alive] Ping failed:', err.message);
      }
    }, 14 * 60 * 1000); 
  }
};

keepAlive();

app.use(cors());
app.use(bodyParser.json());

app.get('/api/health', (req, res) => {
  res.json({ 
    dbConnected: isConnected,
    timestamp: new Date().toISOString(),
    status: "awake"
  });
});

app.post('/api/ai-advice', async (req, res) => {
  const { weight, age, consumed, norm } = req.body;
  
  if (!process.env.API_KEY) {
    return res.json({ advice: "Добавьте API_KEY в Render Settings." });
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
  
  if (statesCollection && isConnected) {
    try {
      const doc = await statesCollection.findOne({ _id: familyId });
      return res.json(doc ? doc.state : null);
    } catch (e) {
      console.error("Read error:", e.message);
      // Если БД упала во время запроса, пробуем выдать из памяти или вернуть null
      return res.json(memoryDb[familyId] || null);
    }
  }
  
  return res.json(memoryDb[familyId] || null);
});

app.post('/api/state/:familyId', async (req, res) => {
  const { familyId } = req.params;
  const newState = req.body;

  memoryDb[familyId] = newState; // Всегда пишем в память как фоллбек

  if (statesCollection && isConnected) {
    try {
      await statesCollection.updateOne(
        { _id: familyId },
        { $set: { state: newState, updatedAt: new Date() } },
        { upsert: true }
      );
      return res.json({ success: true });
    } catch (e) {
      console.error("Write error:", e.message);
      // Не возвращаем 500, так как мы сохранили в memoryDb, клиент может продолжать работу
      return res.json({ success: true, warning: "Saved in memory only" });
    }
  }

  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
