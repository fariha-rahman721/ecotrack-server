const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
const serviceAccount = require("./ecoTrackPrivateKey.json");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// MongoDB Connection
const uri = "mongodb+srv://ecoTrackDB:bgJTc0YxXD8TkvGU@cluster0.fh8zolv.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];

  try {
    await admin.auth().verifyIdToken(token);
    next();
  } catch (error) {
    res.status(401).send({ message: "unauthorized access" });
  }
};

async function run() {
  try {
    await client.connect();

    const db = client.db("ecoTrackDB");
    const cardsCollection = db.collection("cards");
    const joinChallengeCollection = db.collection("join-challenges");

    

    // Get all cards
    app.get('/cards', async (req, res) => {
      const result = await cardsCollection.find().toArray();
      res.send(result);
    });

    // Get card by ID
    app.get('/cards/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const objectId = new ObjectId(id);
      const result = await cardsCollection.findOne({ _id: objectId });
      res.send({ success: true, result });
    });

    // Create new card
    app.post('/cards', async (req, res) => {
      const newCard = req.body;
      const result = await cardsCollection.insertOne(newCard);
      res.send({ success: true, result });
    });

    // Get activities for user
    app.get('/myChallenges', verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await cardsCollection.find({ createdBy: email }).toArray();
      res.send(result);
    });

    // JOIN CHALLENGE
    app.post('/join-challenges', async (req, res) => {
      const challenge = req.body;
      const result = await joinChallengeCollection.insertOne(challenge);
      res.send(result);
    });

     app.get('/my-activities', verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await joinChallengeCollection.find({ joinedBy: email }).toArray();
      res.send(result);
    });

    // Test DB connection
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB.");
  } catch (error) {
    console.error("Server crashed:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
