const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
const serviceAccount = require("./ecoTrackPrivateKey.json");
const app = express()
const port = 3000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Hello World!')
})




admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



const uri = "mongodb+srv://ecoTrackDB:bgJTc0YxXD8TkvGU@cluster0.fh8zolv.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    await client.connect();


    const db = client.db("ecoTrackDB");
    const cardsCollection = db.collection("cards");
    // const usersCollection = db.collection("userChallenges");


    //  cards
    app.get('/cards', async (req, res) => {
      const cursor = cardsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });


    // user challenge
    // app.get('/userChallenge/:id', async (req, res) => {
    //   const id = req.params;
    //   const objectId = new ObjectId(id);
    //   const result = await usersCollection.insertOne({ _id: objectId });
    //   res.send(result);
    // });


    const verifyToken = async (req, res, next) => {
      const authorization = req.headers.authorization;
      const token = authorization.split(' ')[1];

      if (!token) {
        return res.status(401).send({message: 'unauthorized access'});
      }
      
      try {
       await admin.auth().verifyIdToken(token)
        next();
      } catch (error) {
        res.status(401).send({message: 'unauthorized access'});
      }
      
    }


    app.get('/cards/:id', verifyToken ,async (req, res) => {
      const id = req.params;
      const objectId = new ObjectId(id);
      const result = await cardsCollection.findOne({ _id: objectId });
      res.send({
        success: true,
        result
      });
    });


    // post method
    app.post('/cards', async (req, res) => {
      const newCard = req.body;
      const result = await cardsCollection.insertOne(newCard);
      res.send({
        success: true,
        result
      }
      );
    });



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
