const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();
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

    // add classes
    app.post("/addclasses", async (req, res) => {
      const adClass = req.body;
      console.log(adClass);
      const result = await allClassesCollection.insertOne(adClass);
      res.send(result);
    });

    // Selected Class post
    app.post("/selected", async (req, res) => {
      const selectedClass = req.body;
      console.log(selectedClass);
      const result = await selectedClasses.insertOne(selectedClass);
      res.send(result);
    });

    // selected class get
    app.get("/selectedClass", async (req, res) => {
      const email = req.query.email;
      const query = { studentEmail: email };
      console.log(email);
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
      console.log(price);
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

      const insertResult = await paymentCollection.insertOne(payment);

      const query = { _id: new ObjectId(id) };

      const deleteResult = await selectedClasses.deleteOne(query);

      res.send({ insertResult });
    });

    // get all class
    app.get("/allClass", async (req, res) => {
      const query = {};
      const result = await allClassesCollection.find(query).toArray();
      res.send(result);
    });
    // get payments classes
    app.get("/myenrolled", async (req, res) => {
      const userEmail = req.query.email;
      console.log(userEmail);
      const query = { email: userEmail };
      console.log(query);
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    // for payment history
    app.get("/myPaymentHistory", async (req, res) => {
      const userEmail = req.query.email;
      console.log(userEmail);
      const query = { email: userEmail };
      console.log(query);
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
