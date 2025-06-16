const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin-service-key.json");
const port = process.env.PORT || 5000;
require("dotenv").config();

// middleware----
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jbcozto.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  console.log(authHeader);

  if (!authHeader || authHeader.startsWith("Bearer ")) {
    return res.send(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.send(401).send({ message: "unauthorized access" });
  }
};

const verifyTokenEmail = (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    res.status(403).send({ message: "forbidden access" });
  }
  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const marathonCollection = client
      .db("marathonCode")
      .collection("marathonData");
      
    const upcomingMarathonCollection = client
      .db("marathonCode")
      .collection("marathon2");

    //main marathons Collectio--
    const marathonsCollections = client
      .db("marathonCode")
      .collection("marathons");

    // applIcollection-----
    const applyCollection = client.db("marathonCode").collection("apply");

    // Upcoming-marathon-collection  api-------
    app.get("/marathon2", async (req, res) => {
      const cursor = upcomingMarathonCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // marathos Api-----
    app.get("/marathonData", async (req, res) => {
      const cursor = marathonCollection.find().limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/marathonData/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(query)
      const result = await marathonsCollections.findOne(query);
           console.log(result)
      res.send(result);
 
    });

    //****/ marathons related api----------
    app.get("/marathons", async (req, res) => {
      const cursor = marathonsCollections.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/marathons", async (req, res) => {
      const marathon = req.body;
      const result = await marathonsCollections.insertOne(marathon);
      res.send(result);
    });

    app.get("/marathons", async (req, res) => {
      const userEmail = req.body.email;
      if (!userEmail) {
        const query = { userEmail: userEmail };
        const result = await marathonsCollections.find(query).toArray();
      } else {
        const result = await marathonsCollections.find(query).toArray();
      }

      return res.send(result);
    });

    app.get("/marathons/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await marathonsCollections.findOne(query);
     console.log(result)
      if (result) {
        res.send(result);
      } else {
        res.status(404).send({ message: "Marathon not found" });
      }
    });

    app.patch("/marathons/increment/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updatedDoc = {
        $inc: { totalRegCount: 1 },
      };
      const result = await marathonsCollections.updateOne(filter, updatedDoc);

      res.send(result);
    });

    // my apply api---
    app.get("/marathons", async (req, res) => {
      const UserEmail = req.query.email;

      const query = { userEmail: userEmail };

      const result = await marathonsCollections.find(query).toArray();
      res.send(result);
    });

    app.post("/apply", async (req, res) => {
      const registration = req.body;
      console.log(registration);
      const result = await applyCollection.insertOne(registration);
      res.send(result);
    });

    // app.get("applyByEmail", async (req, res) => {
    //   const email = req.query.email;
    //   const query = { email: email };
    // });

    // verifyTokenEmail ------

    app.get("/apply", async (req, res) => {
      const email = req.query.email;
      const query = {
        applicantEmail: email,
      };
      console.log(query);

      const result = await applyCollection.find(query).toArray();
      console.log(result);
      res.send(result);
    });

    // handleDelete---
    app.delete("/apply/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const query = { _id: new ObjectId(id) };
        const result = await applyCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.status(200).send({ deletedCount: 1 });
        } else {
          res.status(404).send({ deletedCount: 0, message: "not founded" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to delete" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Marathons code runing...");
});

app.listen(port, () => {
  console.log(`marathons on going ${port}`);
});
