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
  console.log({ authHeader });

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = {
      email : decoded.email
    };
    next(); 
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).send({ message: "unauthorized access" });
  }
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
      creatAt : new Date()
      res.send(result);
    });

    app.get("/marathonData/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(query)
      const result = await marathonsCollections.findOne(query);
           console.log(result)
      res.send(result);
 
    });

    //****/ marathons related api----------
    app.get("/marathons",verifyFirebaseToken, async (req, res) => {
      const { email, sort } = req.query;    
      const sortOrder=sort === 'asc'? 1 : -1
        const query = email ? { userEmail: email } : {};
      try{
         const cursor = marathonsCollections.find(query).sort({createAt : sortOrder})
         const result =await cursor.toArray()
         return res.send(result)
      }catch(error){
        console.error(error)
      }
      return res.status(500).send({message : 'Failed to fetch marathons'});
    });


app.post('/marathons', async (req, res) => {
  const marathon = req.body;


  marathon.userEmail = req.body.userEmail || "unknown@example.com";
  marathon.createAt = new Date();

  try {
    const result = await marathonsCollections.insertOne(marathon);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Failed to add marathon" });
  }
});

app.get('/my-marathons', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const myMarathons = await marathonsCollections.find({ userEmail: email }).toArray();
    res.json(myMarathons);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// DELETE /marathons/:id
app.delete('/marathons/:id', verifyFirebaseToken, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await marathonsCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Delete failed', error });
  }
});


// GET /marathons/:id
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


    // GET /marathons?email=user@example.com
app.get("/marathons", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const marathons = await marathonsCollections
      .find({ email: email })
      .sort({ createdAt: -1 }) 
      .toArray();
    res.json(marathons);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch marathons" });
  }
});


// PATCH /marathons/:id
app.patch("/marathons/:id", async (req, res) => {
  const id = req.params.id;
  const { marathonsTitle, location, runningDistance, marathonDate } = req.body;

  if (!marathonsTitle || !location || !runningDistance || !marathonDate) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const result = await marathonsCollections.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          marathonsTitle,
          location,
          runningDistance,
          marathonDate: new Date(marathonDate),
        },
      }
    );

    if (result.modifiedCount === 1) {
      res.json({ message: "Marathon updated successfully" });
    } else {
      res.status(404).json({ error: "Marathon not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update marathon" });
  }
});


// DELETE /marathons/:id
app.delete("/marathons/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const result = await marathonsCollections.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 1) {
      res.json({ message: "Marathon deleted successfully" });
    } else {
      res.status(404).json({ error: "Marathon not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete marathon" });
  }
});


  app.patch("/marathons/increment/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };

  const updatedDoc = {
    $inc: { totalRegCount: 1 }
  };

  try {
    const result = await marathonsCollections.updateOne(filter, updatedDoc);
    res.send(result);
  } catch (error) {
    console.error("Error incrementing registration count:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});


app.patch("/marathons/:id", async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;

  const result = await marathonsCollections.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedData }
  );

  res.send(result);
});



       // my apply api---

    app.post("/apply", async (req, res) => {

      const registration = req.body;
      console.log(registration);
      const result = await applyCollection.insertOne(registration);
      res.send(result);

    });

   
    app.get("/apply", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      if(email !== req.decoded.email){
        return res.status(403).send({ message: "forbidden access" });
      }
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

    // handle update....
    app.put("/apply/:id", async(req,res)=>{
      const id=req.params.id
      const filter={_id: new ObjectId(id)}
      const option={upsert: true}
      // updated registration/ apply
      const updatedApply=req.body
      const updateDoc={
        $set:updatedApply
      }

      const result=await applyCollection.updateOne(filter,updateDoc,option)

      res.send(result)
    })

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
