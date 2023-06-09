const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.Payment_secret_key);

const app = express();

// middleware

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_USER_PASS}@cluster0.0w2mrif.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client
      .db("sportFitDB")
      .collection("usersCollection");
    const selectedClasses = client
      .db("sportFitDB")
      .collection("selectedClasses");
    const paymentCollection = client
      .db("sportFitDB")
      .collection("paymentsClasses");
    const allClassesCollection = client
      .db("sportFitDB")
      .collection("allClasses");
    const allInstructorCollection = client
      .db("sportFitDB")
      .collection("allInstructor");

    // user post
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };

      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // user get
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });

    // make admin api

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // make instructor api
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get admin api
    app.get("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // get instructor api
    app.get("/user/instructor/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    // add classes
    app.post("/addclasses", async (req, res) => {
      const adClass = req.body;

      const result = await allClassesCollection.insertOne(adClass);
      res.send(result);
    });

    // get my class
    app.get("/myclass", async (req, res) => {
      const email = req.query.email;
      const query = { instructor_email: email };
      const result = await allClassesCollection.find(query).toArray();
      res.send(result);
    });

    // delete my classes
    app.delete("/myclass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allClassesCollection.deleteOne(query);
      res.send(result);
    });
    // get one my class
    app.get("/myclass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allClassesCollection.findOne(query);
      res.send(result);
    });

    // Selected Class post
    app.post("/selected", async (req, res) => {
      const selectedClass = req.body;
      const result = await selectedClasses.insertOne(selectedClass);
      res.send(result);
    });

    // selected class get
    app.get("/selectedClass", async (req, res) => {
      const email = req.query.email;
      const query = { studentEmail: email };

      const result = await selectedClasses.find(query).toArray();

      res.send(result);
    });

    // selected class delete
    app.delete("/selectedDelete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClasses.deleteOne(query);
      res.send(result);
    });

    // paymentIntent

    app.post("/createIntent", async (req, res) => {
      const { price } = req.body;

      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Post payments classes
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const id = payment.id;
      const classId = req.query.classId;
      const query = { _id: new ObjectId(id) };
      const instructorEmail = payment.instructor_email;

      const filter = { _id: new ObjectId(classId) };
      const filterInstructor = { email: instructorEmail };

      const updateDoc = {
        $inc: {
          totalEnrolled: 1,
          available_seats: -1,
        },
      };
      const updateNumberOfStudent = {
        $inc: {
          number_of_students: 1,
        },
      };
      const result = await allClassesCollection.updateOne(filter, updateDoc);
      const updateStudentNumber = await allInstructorCollection.updateOne(
        filterInstructor,
        updateNumberOfStudent
      );
      const insertResult = await paymentCollection.insertOne(payment);

      const deleteResult = await selectedClasses.deleteOne(query);

      res.send({ insertResult, deleteResult, result, updateStudentNumber });
    });

    // get all approved class
    app.get("/allApprovedClass", async (req, res) => {
      const query = { status: { $nin: ["pending", "denied"] } };
      const result = await allClassesCollection
        .find(query)
        .sort({ totalEnrolled: -1 })
        .toArray();
      res.send(result);
    });
    // all classes
    app.get("/allClass", async (req, res) => {
      const query = {};
      const result = await allClassesCollection.find(query).toArray();
      res.send(result);
    });
    // make approved api
    app.patch("/allClass/approved/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await allClassesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // make denied api
    app.patch("/allClass/denied/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };
      const result = await allClassesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //  feedback api
    app.patch("/allClass/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const feedback = req.query.feedback;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback,
        },
      };

      const result = await allClassesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get payments classes
    app.get("/myenrolled", async (req, res) => {
      const userEmail = req.query.email;

      const query = { email: userEmail };

      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    // for payment history
    app.get("/myPaymentHistory", async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const result = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("School is start");
});

app.listen(port, () => {
  console.log(`school is running at ${port}`);
});
