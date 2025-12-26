
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ServerApiVersion } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const uri = process.env.MONGODB_URI;
let statesCollection = null;

async function connectDB() {
  if (!uri) {
    console.warn("⚠️ MONGODB_URI not found in Environment Variables.");
    console.warn("Data will be lost when the server restarts.");
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
    
    // Проверка соединения
    await db.command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB Atlas");
  } catch (e) {
    console.error("❌ MongoDB Connection Error:", e.message);
    console.error("Check your MONGODB_URI and IP Access List (should be 0.0.0.0/0)");
  }
}

connectDB();

app.use(cors());
app.use(bodyParser.json());

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
