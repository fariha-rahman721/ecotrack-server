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
    // await client.connect();

    const db = client.db("ecoTrackDB");
    const cardsCollection = db.collection("cards");
    const joinChallengeCollection = db.collection("join-challenges");
    const tipsCollection = db.collection("communityTips");
    const eventsCollection = db.collection("upcomingEvents");
    const userCollection = db.collection("users");


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

        const filter = { _id: new ObjectId(id) };
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
        const challengeId = req.params.id;
        const userEmail = req.user.email;

        // Get challenge info
        const challenge = await cardsCollection.findOne({ _id: new ObjectId(challengeId) });
        if (!challenge) return res.status(404).send({ message: 'Challenge not found' });

        // Get user info
        const userInfo = await userCollection.findOne({ email: userEmail });
        if (!userInfo) return res.status(404).send({ message: 'User not found' });

        // Create join entry
        const joinEntry = {
          challengeId,
          challengeTitle: challenge.title,
          challengeCategory: challenge.category,
          createdBy: userEmail,
          userName: userInfo.name || '',
          userPhoto: userInfo.photoURL || '',
          createdAt: new Date(),
        };

        const result = await joinChallengeCollection.insertOne(joinEntry);

        // Increment participants count
        const participantsUpdate = await cardsCollection.updateOne(
          { _id: new ObjectId(challengeId) },
          { $inc: { participants: 1 } }
        );

        res.send({ joinResult: result, participantsUpdate });

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


    // get joined participants
    app.get('/joined-participants', verifyToken, async (req, res) => {
      try {
        const participants = await joinChallengeCollection.find().toArray();
        res.send(participants);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch participants' });
      }
    });



    // get all users
    // GET all users
    app.get('/users', verifyToken, async (req, res) => {
      try {
        const users = await userCollection.find().toArray();

        // Convert ObjectId to string for frontend display
        const usersWithId = users.map(u => ({
          ...u,
          _id: u._id.toString()
        }));

        res.send({ success: true, users: usersWithId });
      } catch (error) {
        console.error("Fetch users error:", error);
        res.status(500).send({ success: false, message: 'Failed to fetch users' });
      }
    });

    // POST user (create or update)
    app.post('/users', async (req, res) => {
      try {
        const userData = req.body;
        if (!userData.email) {
          return res.status(400).send({ success: false, message: "Email is required" });
        }

        const query = { email: userData.email };
        const alreadyExists = await userCollection.findOne(query);

        if (alreadyExists) {
          const result = await userCollection.updateOne(query, {
            $set: {
              last_loggedIn: new Date().toISOString(),
              name: userData.name || alreadyExists.name,
              photoURL: userData.photoURL || alreadyExists.photoURL,
            },
          });

          return res.send({ success: true, updated: true, result });
        }

        // New user
        const newUser = {
          ...userData,
          created_at: new Date().toISOString(),
          last_loggedIn: new Date().toISOString(),
          role: 'Member',
        };

        const result = await userCollection.insertOne(newUser);

        res.send({ success: true, created: true, result });
      } catch (error) {
        console.error("User save error:", error);
        res.status(500).send({ success: false, message: "User save failed" });
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
    // await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB.");
  } catch (error) {
    console.error("Server crashed:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
