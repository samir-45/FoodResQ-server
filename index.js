require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());


// ------------------------ ///////////////-----------------------------


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d2h2whv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // Database------:
        const donationCollection = client.db("foodResQ").collection("donations");


        // ----------------------------------////////////--------------------------------------------------

        // Routes-------:

        // GET /donations/featured
        app.get("/donations/featured", async (req, res) => {
            try {
                const featured = await donationCollection
                    .find({ isFeatured: true })
                    .sort({ createdAt: -1 }) // 👈 Newest first
                    .limit(6)
                    .toArray();

                res.send(featured);
            } catch (error) {
                console.error("Error fetching featured donations:", error);
                res.status(500).send({ message: "Server error" });
            }
        });



        // POST /donations
        app.post("/donations", async (req, res) => {
            const donation = req.body;
            const result = await donationCollection.insertOne(donation);
            res.send(result);
        });








        // ----------------------------------////////////--------------------------------------------------
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



// ------------------------ ///////////////-----------------------------
app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})