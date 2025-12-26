
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

// --- УЛУЧШЕННЫЙ МЕХАНИЗМ KEEP-ALIVE ---
const keepAlive = () => {
  // На Render есть стандартная переменная RENDER_EXTERNAL_URL
  const url = process.env.RENDER_EXTERNAL_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com` : null);
  
  if (url) {
    const healthUrl = `${url}/api/health`;
    console.log(`[Keep-Alive] Initializing with URL: ${healthUrl}`);
    
    // Пингуем чаще (раз в 5 минут), чтобы Render не успевал "заснуть"
    setInterval(async () => {
      try {
        const res = await fetch(healthUrl);
        if (res.ok) {
          console.log(`[Keep-Alive] Ping success: ${new Date().toLocaleTimeString()}`);
        } else {
          console.warn(`[Keep-Alive] Ping returned status ${res.status}`);
        }
      } catch (err) {
        // Ошибка fetch failed часто бывает при временных сбоях сети самого хостинга
        console.error('[Keep-Alive] Ping failed (network error):', err.message);
      }
    }, 5 * 60 * 1000); 
  } else {
    console.warn("[Keep-Alive] No external URL found for pinging.");
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
      return res.json(memoryDb[familyId] || null);
    }
  }
  
  return res.json(memoryDb[familyId] || null);
});

app.post('/api/state/:familyId', async (req, res) => {
  const { familyId } = req.params;
  const newState = req.body;

  memoryDb[familyId] = newState;

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
