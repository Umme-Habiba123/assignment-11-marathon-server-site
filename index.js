const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin-service-key.json");
const port = process.env.PORT || 5000;
require("dotenv").config();

// middleware----
// app.use(cors());
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jbcozto.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
      email: decoded.email
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
      creatAt: new Date()
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
    app.get("/marathons", verifyFirebaseToken, async (req, res) => {
      const { email, sort } = req.query;
      const sortOrder = sort === 'asc' ? 1 : -1
      const query = email ? { userEmail: email } : {};
      try {
        const cursor = marathonsCollections.find(query).sort({ createAt: sortOrder })
        const result = await cursor.toArray()
        return res.send(result)
      } catch (error) {
        console.error(error)
      }
      return res.status(500).send({ message: 'Failed to fetch marathons' });
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

    // app.get('/my-marathons', async (req, res) => {
    //   const email = req.query.email;
    //   if (!email) return res.status(400).json({ message: "Email is required" });

    //   try {
    //     const myMarathons = await marathonsCollections.find({ userEmail: email }).toArray();
    //     res.json(myMarathons);
    //   } catch (err) {
    //     res.status(500).json({ message: "Server error" });
    //   }
    // });


    app.get("/my-marathons", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const myMarathons = await marathonsCollections.find({ userEmail: email }).toArray();
      res.json(myMarathons);
    });

    app.get("/marathons", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      try {
        const marathons = await marathonsCollections
          .find({ userEmail: email })
          .sort({ createAt: -1 })
          .toArray();
        res.json(marathons);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch marathons" });
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


    // app.get("/apply", verifyFirebaseToken, async (req, res) => {
    //   const email = req.query.email;
    //   if (email !== req.decoded.email) {
    //     return res.status(403).send({ message: "forbidden access" });
    //   }
    //   const query = {
    //     applicantEmail: email,
    //   };
    //   console.log(query);

    //   const result = await applyCollection.find(query).toArray();
    //   console.log(result);
    //   res.send(result);
    // });

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
    app.put("/apply/:id", async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const option = { upsert: true }
      // updated registration/ apply
      const updatedApply = req.body
      const updateDoc = {
        $set: updatedApply
      }

      const result = await applyCollection.updateOne(filter, updateDoc, option)

      res.send(result)
    })

    // update medal
    app.patch("/apply/:id", async (req, res) => {
      const { id } = req.params;
      const { medal } = req.body;

      try {
        const result = await applyCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { medal } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Registration not found" });
        }

        res.send({ message: "Medal updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Express.js server
    const { ObjectId } = require("mongodb");

    // DELETE registration
    app.delete("/apply/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const result = await applyCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Registration not found" });
        }

        res.send({ message: "Registration deleted successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Express
    app.get("/apply", verifyFirebaseToken, async (req, res) => {
      const { email, marathonId } = req.query;
      console.log("✅ Verified user:", req.decoded.email);

      try {
        let query = {};


        if (email) {
          if (email !== req.decoded.email) {
            return res.status(403).send({ message: "Forbidden access" });
          }
          query.applicantEmail = email;
        }

        if (marathonId) {
          query.marathonId = marathonId;
        }

        const participants = await applyCollection.find(query).toArray();
        res.send(participants);
      } catch (err) {
        console.error("❌ Failed to load participants:", err);
        res.status(500).send({ message: "Server error" });
      }
    });





    // Leaderboard / My Marathons
    app.get("/marathons", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.query.email;

        // Email না দিলে বা mismatch হলে forbidden
        if (!email || email !== req.decoded.email) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const marathons = await marathonsCollections
          .find({ userEmail: email })
          .sort({ createAt: -1 }) // newest first
          .toArray();

        res.status(200).json(marathons);
      } catch (error) {
        console.error("Failed to fetch marathons:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });


    // achievementss---
    // GET /achievements?email=...
    app.get("/achievements", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      if (!email || email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const achievements = await marathonsCollections
          .find({ userEmail: email })
          .project({ marathonsTitle: 1, medal: 1, marathonDate: 1 }) // প্রয়োজনীয় ফিল্ড
          .toArray();

        res.json(achievements);
      } catch (error) {
        console.error("Failed to fetch achievements:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });


    // resultt---------
    app.get("/results/:marathonId", verifyFirebaseToken, async (req, res) => {
      const { marathonId } = req.params;
      try {
        const results = await Competition.find({ marathonId }).sort({ time: 1 }); // best time ascending
        res.json(results);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

  // Update Finish Time
// backend/routes/apply.js
// app.patch("/:id", async (req, res) => {
//   const { finishTime } = req.body;
//   try {
//     const updated = await Apply.findByIdAndUpdate(
//       req.params.id,
//       { finishTime },
//       { new: true }
//     );
//     if (!updated) return res.status(404).json({ message: "Participant not found" });
//     res.json(updated);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });


app.patch("/:id/medal", async (req, res) => {
  const { medal } = req.body;
  try {
    const updated = await Apply.findByIdAndUpdate(
      req.params.id,
      { medal },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Participant not found" });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// Update finishTime for a participant
app.patch("/:id", async (req, res) => {
  try {
    const { finishTime } = req.body;
    const apply = await Apply.findById(req.params.id);
    if (!apply) return res.status(404).json({ message: "Apply not found" });

    apply.finishTime = finishTime;
    await apply.save();
    res.json({ message: "Finish time updated", apply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get participants with finishTime
app.get("/", async (req, res) => {
  try {
    const { finishTimeExists } = req.query;
    let query = {};

    if (finishTimeExists === "true") {
      query.finishTime = { $exists: true, $ne: null };
    }

    const applies = await Apply.find(query).sort({ finishTime: 1 });
    res.json(applies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get participants with finishTime
app.get("/participants", async (req, res) => {
  try {
    const { marathonId } = req.query;
    let query = { finishTime: { $exists: true, $ne: null } };

    if (marathonId) query.marathonId = marathonId;

    const participants = await applyCollection.find(query).sort({ finishTime: 1 }).toArray();
    res.json(participants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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
