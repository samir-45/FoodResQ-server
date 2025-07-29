require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const requestCollection = client.db("foodResQ").collection("requests");
        const userCollection = client.db("foodResQ").collection("users");
        const charityRequestCollection = client.db("foodResQ").collection("CharityRequests");


        // ----------------------------------////////////--------------------------------------------------

        // Routes-------:

        // GET /donations/featured
        app.get("/donations/featured", async (req, res) => {
            try {
                const featured = await donationCollection
                    .find({ isFeatured: true, verification: "Verified" })
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


        // Admin manage donation page stuffs /////////Start///////////////////
        app.get("/donations/all-admin", async (req, res) => {
            const all = await donationCollection.find().sort({ createdAt: -1 }).toArray();
            res.send(all);
        });

        app.patch("/donations/verify/:id", async (req, res) => {
            const id = req.params.id;
            const result = await donationCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { verification: "Verified" } }
            );
            res.send(result);
        });

        app.patch("/donations/reject/:id", async (req, res) => {
            const id = req.params.id;
            const result = await donationCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { verification: "Rejected" } }
            );
            res.send(result);
        });

        // For admin featured donation page
        app.patch("/donations/feature/:id", async (req, res) => {
            const id = req.params.id;
            const { makeFeatured } = req.body;

            const result = await donationCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { isFeatured: makeFeatured } }
            );

            res.send(result);
        });

        app.get("/donations/verified", async (req, res) => {
            const result = await donationCollection
                .find({ verification: "Verified" })
                .sort({ createdAt: -1 })
                .toArray();

            res.send(result);
        });

        // Admin manage donation page stuffs /////////End///////////////////


        // get reausturant Donations
        app.get('/donations/restaurant/:email', async (req, res) => {
            const email = req.params.email;
            const donations = await donationCollection.find({ restaurantEmail: email }).sort({ createdAt: -1 }).toArray();
            res.send(donations);
        });

        // Delete reaustarunt given donations
        app.delete('/donations/:id', async (req, res) => {
            const id = req.params.id;
            const result = await donationCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // Get latest donation request for showcase in home page
        app.get("/requests/latest", async (req, res) => {
            try {
                const latest = await requestCollection
                    .find({})
                    .sort({ requestedAt: -1 }) // newest first
                    .limit(6) // ✅ show only latest 6
                    .toArray();

                res.send(latest);
            } catch (error) {
                console.error("Error fetching latest charity requests:", error);
                res.status(500).send({ message: "Server error" });
            }
        });

        // Post user data after registered
        app.post('/users', async (req, res) => {
            const user = req.body;
            const existing = await userCollection.findOne({ email: user.email });
            if (existing) {
                return res.send({ message: 'User already exists' });
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        });


        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send(user);
        });

        // For check user role
        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send({ role: user?.role || 'user' });
        });

        // Charity request ----------------------------------------------------------------------------
        app.post("/charity-requests", async (req, res) => {
            const newRequest = req.body;
            const existing = await charityRequestCollection.findOne({ userEmail: newRequest.userEmail });

            if (existing) {
                return res.send({ message: "Already requested." });
            }

            const result = await charityRequestCollection.insertOne(newRequest);
            res.send(result);
        });

        // get charity requests
        app.get("/charity-requests/:email", async (req, res) => {
            const email = req.params.email;
            const request = await charityRequestCollection.findOne({ userEmail: email });
            res.send(request || {});
        });

        // ----------------------------------------------------------------------------------------------

        // Data for all donations page 
        app.get("/donations/all", async (req, res) => {
            const verified = await donationCollection
                .find({ verification: "Verified" })
                .sort({ createdAt: -1 })
                .toArray();
            res.send(verified);
        });

        // Get card details 
        app.get("/donations/:id", async (req, res) => {
            const id = req.params.id;
            const donation = await donationCollection.findOne({ _id: new ObjectId(id) });
            res.send(donation);
        });


        // Get charity profile details
        app.get("/requests/charity/:email", async (req, res) => {
            const email = req.params.email;
            const requests = await requestCollection
                .find({ charityEmail: email })
                .sort({ requestedAt: -1 })
                .toArray();
            res.send(requests);
        });

        app.get("/donations/received/:email", async (req, res) => {
            const email = req.params.email;
            const donations = await donationCollection
                .find({ receivedBy: email }) // assuming you store this on pickup
                .sort({ deliveredAt: -1 })
                .toArray();
            res.send(donations);
        });

        // For admin dasboard
        app.get("/users", async (req, res) => {
            const allUsers = await userCollection.find().toArray();
            res.send(allUsers);
        });

        app.patch("/users/role/:email", async (req, res) => {
            const email = req.params.email;
            const { newRole } = req.body;

            const result = await userCollection.updateOne(
                { email },
                { $set: { role: newRole } }
            );

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