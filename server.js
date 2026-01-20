
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

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

// --- СТАБИЛЬНЫЙ МЕХАНИЗМ KEEP-ALIVE ---
const startKeepAlive = () => {
  const url = process.env.RENDER_EXTERNAL_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com` : null);

  if (!url) {
    console.warn("[Keep-Alive] No external URL found for pinging.");
    return;
  }

  const healthUrl = `${url.replace(/\/$/, '')}/api/health`;
  console.log(`[Keep-Alive] Service scheduled for: ${healthUrl}`);

  setTimeout(() => {
    console.log("[Keep-Alive] Initializing periodic pings...");

    setInterval(async () => {
      try {
        const res = await fetch(healthUrl);
        if (res.ok) {
          console.log(`[Keep-Alive] Heartbeat OK at ${new Date().toLocaleTimeString()}`);
        } else {
          console.warn(`[Keep-Alive] Heartbeat status: ${res.status}`);
        }
      } catch (err) {
        console.log(`[Keep-Alive] Network skip (likely internal Render routing): ${err.message}`);
      }
    }, 4 * 60 * 1000);
  }, 30000);
};

startKeepAlive();

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
  const { weight, age, consumed, norm, currentTime, mealsCount } = req.body;

  if (!process.env.API_KEY) {
    return res.json({ advice: "Добавьте API_KEY в Render Settings." });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        ИНФОРМАЦИЯ:
        Котёнок: Оззи
        Возраст: ${age.toFixed(1)} мес
        Вес: ${weight.toFixed(2)} кг
        Сейчас времени: ${currentTime}
        Съел за сегодня: ${consumed.toFixed(0)}г (из ${norm.toFixed(0)}г нормы)
        Количество приемов пищи: ${mealsCount}

        ЗАДАЧА:
        Дай ОДИН очень короткий (до 15 слов) заботливый совет на русском языке.
        ВАЖНО: Учитывай текущее время. Если сейчас день или вечер (например, 17:40), НЕ ГОВОРИ "не переживай о норме" — это глупо, так как котенок еще поест. 
        Если съел мало для данного времени, подбодри. Если съел много — предупреди. Если норма почти достигнута, похвали.
        Будь естественным, как член семьи.
      `,
    });
    res.json({ advice: response.text });
  } catch (error) {
    res.json({ advice: "Оззи сегодня просто лапочка!" });
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
  console.log(`🚀 Ozzy Tracker server active on port ${port}`);
});
