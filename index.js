const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
require('dotenv').config();
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
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.fh8zolv.mongodb.net/?appName=Cluster0`;

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
    return res.status(401).send({
      message: "unauthorized access. Token not found!",
    });
  }

  const token = authorization.split(" ")[1];
  try {

    const user = await admin.auth().verifyIdToken(token);
    req.user = user;

    next();
  } catch (error) {
    res.status(405).send({
      message: "unauthorized access.",
    });
  }
};



async function run() {
  try {
    await client.connect();

    const db = client.db("ecoTrackDB");
    const cardsCollection = db.collection("cards");
    const joinChallengeCollection = db.collection("join-challenges");
    const tipsCollection = db.collection("communityTips");
    const eventsCollection = db.collection("upcomingEvents");



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

    // update challenge
    const { ObjectId } = require('mongodb');

    app.put('/cards/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const updatedChallenge = req.body;

        const filter = { _id: new ObjectId(id) };   // ✅ FIXED
        const updateDoc = { $set: updatedChallenge };

        const result = await cardsCollection.updateOne(filter, updateDoc);

        res.send({ success: true, result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Update failed" });
      }
    });


    // join chlallenge
    app.post('/join-challenges/:id', verifyToken, async (req, res) => {
      try {
        const challenge = req.body;

        const id = req.params.id;
        const result = await joinChallengeCollection.insertOne(challenge);


        const filter = { _id: id };
        const update = { $inc: { participants: 1 } };
        const participantsCount = await cardsCollection.updateOne(filter, update);


        res.send({
          joinResult: result,
          participantsUpdate: participantsCount
        });

      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Something went wrong!' });
      }
    });


    app.get('/my-activities', verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await joinChallengeCollection.find({ createdBy: email }).toArray();
      res.send(result);
    });






    // delete joined challenge
    app.delete('/my-activities/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const email = req.user.email;

        const result = await joinChallengeCollection.deleteOne({
          _id: new ObjectId(id),
          createdBy: email
        });

        if (result.deletedCount === 0) {
          return res.status(403).send({
            success: false,
            message: 'Not allowed or not found'
          });
        }

        res.send({ success: true });

      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false });
      }
    });





    // Get all community tips
    app.get('/communityTips', async (req, res) => {
      const result = await tipsCollection.find().toArray();
      res.send(result);
    });

    // Get all upcoming events
    app.get('/upcomingEvents', async (req, res) => {
      const result = await eventsCollection.find().toArray();
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
