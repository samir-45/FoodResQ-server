require('dotenv').config();
const express = require('express');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());



const decodedKey = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decodedKey);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// module.exports = admin;



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
        await client.connect();   // Its need comment

        // Database------:
        const donationCollection = client.db("foodResQ").collection("donations");
        const requestCollection = client.db("foodResQ").collection("requests");
        const userCollection = client.db("foodResQ").collection("users");
        const charityRequestCollection = client.db("foodResQ").collection("CharityRequests");
        const paymentCollection = client.db("foodResQ").collection("charityPayments");
        const donationRequestsCollection = client.db("foodResQ").collection("donationRequests");
        const favoritesCollection = client.db("foodResQ").collection("favorites");
        const reviewsCollection = client.db("foodResQ").collection("reviews");


        // ----------------------------------////////////--------------------------------------------------


        // middleware/verifyFBToken.js
        // const admin = require("../firebase"); // import admin

        // const verifyFBToken = async (req, res, next) => {
        //     const authHeaders = req.headers.authorization;
        //     if (!authHeaders) {
        //         return res.status(401).send({ message: "Unauthorized access" });
        //     }

        //     const token = authHeaders.split(" ")[1];

        //     try {
        //         const decoded = await admin.auth().verifyIdToken(token);
        //         req.decoded = decoded; // Contains email, uid, etc.
        //         next();
        //     } catch (error) {
        //         return res.status(403).send({ message: "Forbidden access" });
        //     }
        // };

        // module.exports = verifyFBToken;

        const verifyFBToken = async (req, res, next) => {
            const authHeaders = req.headers.authorization;
            if (!authHeaders) return res.status(401).send({ message: "Unauthorized access" });

            const token = authHeaders.split(" ")[1];
            if (!token) return res.status(401).send({ message: "Unauthorized access" });

            try {
                const decoded = await admin.auth().verifyIdToken(token);
                req.decoded = decoded;
                next();
            } catch (error) {
                return res.status(403).send({ message: "Forbidden access" });
            }
        };

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await userCollection.findOne({ email });

            if (!user || user.role !== "admin") {
                return res.status(403).send({ message: "Forbidden access" });
            }
            next();
        };

        const verifyCharity = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await userCollection.findOne({ email });

            if (!user || user.role !== "charity") {
                return res.status(403).send({ message: "Forbidden access" });
            }
            next();
        };

        const verifyRestaurant = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await userCollection.findOne({ email });

            if (!user || user.role !== "restaurant") {
                return res.status(403).send({ message: "Forbidden access" });
            }
            next();
        };

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
        app.post("/donations", verifyFBToken, verifyRestaurant, async (req, res) => {
            const donation = req.body;
            const result = await donationCollection.insertOne(donation);
            res.send(result);
        });


        // Admin manage donation page stuffs /////////Start///////////////////
        app.get("/donations/all-admin", verifyFBToken, verifyAdmin, async (req, res) => {
            const all = await donationCollection.find().sort({ createdAt: -1 }).toArray();
            res.send(all);
        });

        app.patch("/donations/verify/:id", verifyFBToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const result = await donationCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { verification: "Verified" } }
            );
            res.send(result);
        });

        app.patch("/donations/reject/:id", verifyFBToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const result = await donationCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { verification: "Rejected" } }
            );
            res.send(result);
        });

        // For admin featured donation page
        app.patch("/donations/feature/:id", verifyFBToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const { makeFeatured } = req.body;

            const result = await donationCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { isFeatured: makeFeatured } }
            );

            res.send(result);
        });

        app.get("/donations/verified", verifyFBToken, verifyAdmin, async (req, res) => {
            const result = await donationCollection
                .find({ verification: "Verified" })
                .sort({ createdAt: -1 })
                .toArray();

            res.send(result);
        });

        // Admin manage donation page stuffs /////////End///////////////////


        // get reausturant Donations
        app.get('/donations/restaurant/:email', verifyFBToken, verifyRestaurant, async (req, res) => {
            const email = req.params.email;
            const donations = await donationCollection.find({ restaurantEmail: email }).sort({ createdAt: -1 }).toArray();
            res.send(donations);
        });

        // Delete reaustarunt given donations
        app.delete('/donations/:id', verifyFBToken, verifyAdmin, async (req, res) => {
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
        app.get("/requests/charity/:email", verifyFBToken, verifyCharity, async (req, res) => {
            const email = req.params.email;
            const requests = await requestCollection
                .find({ charityEmail: email })
                .sort({ requestedAt: -1 })
                .toArray();
            res.send(requests);
        });

        app.get("/donations/received/:email", verifyFBToken, verifyCharity, async (req, res) => {
            const email = req.params.email;
            const donations = await donationCollection
                .find({ receivedBy: email }) // assuming you store this on pickup
                .sort({ deliveredAt: -1 })
                .toArray();
            res.send(donations);
        });

        // For admin dasboard
        app.get("/users", verifyFBToken, async (req, res) => {
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


        app.post("/create-payment-intent-charity", async (req, res) => {
            try {
                const { amountInCents, email } = req.body;

                if (!amountInCents || !email) {
                    return res.status(400).send({ error: "Missing amount or email" });
                }

                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountInCents,
                    currency: "usd",
                    payment_method_types: ["card"],
                    receipt_email: email,
                });

                res.send({ clientSecret: paymentIntent.client_secret });
            } catch (err) {
                console.error("❌ Payment intent error:", err.message);
                res.status(500).send({ error: err.message });
            }
        });




        app.patch("/charity-requests/:email", async (req, res) => {
            const email = req.params.email;

            const result = await charityRequestCollection.updateOne(
                { userEmail: email },
                { $set: { status: "paid" } }
            );

            res.send(result);
        });

        app.post("/charity-payments", async (req, res) => {
            const paymentData = req.body;
            const result = await paymentCollection.insertOne(paymentData);
            res.send({ insertedId: result.insertedId });
        });

        // For admin manage charity request

        app.get("/charity-requests", async (req, res) => {
            const requests = await charityRequestCollection.find().sort({ requestedAt: -1 }).toArray();
            res.send(requests);
        });


        app.patch("/charity-requests/approve/:email", verifyFBToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;

            // 1. Update approval status
            const updateReq = await charityRequestCollection.updateOne(
                { userEmail: email },
                { $set: { approval: "approved" } }
            );

            // 2. Update user role
            const updateUser = await userCollection.updateOne(
                { email },
                { $set: { role: "charity" } }
            );

            res.send({ requestUpdated: updateReq.modifiedCount, userUpdated: updateUser.modifiedCount });
        });


        app.patch("/charity-requests/reject/:email", async (req, res) => {
            const email = req.params.email;

            const result = await charityRequestCollection.updateOne(
                { userEmail: email },
                { $set: { approval: "rejected" } }
            );

            res.send(result);
        });

        // Get charity payment history
        app.get("/charity-payments/:email", verifyFBToken, async (req, res) => {
            const email = req.params.email;
            const result = await paymentCollection.find({ userEmail: email }).sort({ paidAt: -1 }).toArray();
            res.send(result);
        });

        // for charity can req for donation from donation details page 

        // app.post("/donation-requests", async (req, res) => {
        //     const request = req.body;

        //     // Check if the same user already requested this donation
        //     const existing = await donationRequestsCollection.findOne({
        //         donationId: request.donationId,
        //         charityEmail: request.charityEmail,
        //     });

        //     if (existing) {
        //         return res.status(409).send({ message: "Already requested" });
        //     }

        //     const result = await donationRequestsCollection.insertOne({
        //         ...request,
        //         status: "pending",
        //         requestedAt: new Date(),
        //     });

        //     res.send(result);
        // });


        app.post("/donation-requests", async (req, res) => {
            const requestInfo = req.body;

            // Prevent duplicate requests
            const existing = await donationRequestsCollection.findOne({
                donationId: requestInfo.donationId,
                charityEmail: requestInfo.charityEmail,
            });

            if (existing) {
                return res
                    .status(409)
                    .send({ message: "You have already requested this donation." });
            }

            const result = await donationRequestsCollection.insertOne({
                ...requestInfo,
                status: "pending",
                requestedAt: new Date(),
            });

            res.send(result);
        });


        // app.get("/donation-requests/check", async (req, res) => {
        //     const { donationId, email } = req.query;

        //     const request = await donationRequestsCollection.findOne({
        //         donationId,
        //         charityEmail: email,
        //     });

        //     res.send({ exists: !!request });
        // });

        app.get("/donation-requests/check", async (req, res) => {
            const { donationId, email } = req.query;

            const request = await donationRequestsCollection.findOne({
                donationId,
                charityEmail: email,
            });

            res.send({ request }); // can be null or full object
        });


        // For auto reject other donations
        app.patch("/donation-requests/accept/:id", async (req, res) => {
            const { id } = req.params;

            // Accept this request
            const result = await donationRequestsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: "accepted",
                        acceptedAt: new Date(),
                    },
                }
            );

            // Optional: Auto-reject other requests for the same donation
            const acceptedRequest = await donationRequestsCollection
                .findOne({ _id: new ObjectId(id) });

            if (acceptedRequest?.donationId) {
                await donationRequestsCollection.updateMany(
                    {
                        donationId: acceptedRequest.donationId,
                        _id: { $ne: new ObjectId(id) },
                        status: "pending",
                    },
                    { $set: { status: "rejected" } }
                );
            }

            res.send(result);
        });

        // For add favorites button in donation details page

        app.get("/favorites/check", async (req, res) => {
            const { email, donationId } = req.query;

            const favorite = await favoritesCollection.findOne({
                userEmail: email,
                donationId,
            });

            res.send({ isFavorite: !!favorite });
        });



        // For my requests page 
        app.get("/donation-requests/user/:email", verifyFBToken, verifyCharity, async (req, res) => {
            const email = req.params.email;

            const result = await donationRequestsCollection
                .find({ charityEmail: email })
                .sort({ requestedAt: -1 })
                .toArray();

            res.send(result);
        });

        // app.patch("/donation-requests/pickup/:id", async (req, res) => {
        //     const { id } = req.params;
        //     const { userEmail } = req.body;

        //     const existing = await donationRequestsCollection.findOne({
        //         _id: new ObjectId(id),
        //     });

        //     if (!existing || existing.charityEmail !== userEmail) {
        //         return res.status(403).send({ message: "Unauthorized" });
        //     }

        //     const result = await donationRequestsCollection.updateOne(
        //         { _id: new ObjectId(id) },
        //         {
        //             $set: {
        //                 status: "picked_up",
        //                 pickedUpAt: new Date(),
        //             },
        //         }
        //     );

        //     res.send(result);
        // });


        app.patch("/donation-requests/pickup/:id", verifyFBToken, verifyCharity, async (req, res) => {
            const { id } = req.params;
            const { userEmail } = req.body;

            const request = await donationRequestsCollection.findOne({
                _id: new ObjectId(id),
            });

            if (!request || request.charityEmail !== userEmail) {
                return res.status(403).send({ message: "Unauthorized" });
            }

            const result = await donationRequestsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: "picked_up",
                        pickedUpAt: new Date(),
                    },
                }
            );

            res.send(result);
        });



        // For my pickup page
        app.get("/donation-requests/picked-up/:email", verifyFBToken, verifyCharity, async (req, res) => {
            const email = req.params.email;

            const result = await donationRequestsCollection
                .find({ charityEmail: email, status: "picked_up" })
                .sort({ pickedUpAt: -1 })
                .toArray();

            res.send(result);
        });

        // For requested donation page 

        app.get("/donation-requests/by-restaurant/:email", verifyFBToken, verifyCharity, async (req, res) => {
            const email = req.params.email;

            const result = await donationRequestsCollection.find({
                restaurantEmail: email,
            }).sort({ requestedAt: -1 }).toArray();

            res.send(result);
        });

        app.patch("/donation-requests/accept/:id", verifyFBToken, verifyCharity, async (req, res) => {
            const { id } = req.params;

            const result = await donationRequestsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: "accepted",
                        acceptedAt: new Date(),
                    },
                }
            );

            res.send(result);
        });

        app.patch("/donation-requests/reject/:id", verifyFBToken, verifyCharity, async (req, res) => {
            const { id } = req.params;

            const result = await donationRequestsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: "rejected",
                        rejectedAt: new Date(),
                    },
                }
            );

            res.send(result);
        });


        // For recieved donation page

        app.get("/donation-requests/received/:email", verifyFBToken, verifyCharity, async (req, res) => {
            const email = req.params.email;

            const result = await donationRequestsCollection
                .find({ charityEmail: email, status: "picked_up" })
                .sort({ pickedUpAt: -1 })
                .toArray();

            res.send(result);
        });


        // For user favorite donations
        app.get("/favorites/:email", async (req, res) => {
            const result = await favoritesCollection
                .find({ userEmail: req.params.email })
                .sort({ addedAt: -1 })
                .toArray();

            res.send(result);
        });

        app.post("/favorites", async (req, res) => {
            const favorite = req.body;

            // Check for duplicate
            const exists = await favoritesCollection.findOne({
                userEmail: favorite.userEmail,
                donationId: favorite.donationId,
            });

            if (exists) {
                return res.status(409).send({ message: "Already in favorites" });
            }

            const result = await favoritesCollection.insertOne({
                ...favorite,
                addedAt: new Date(),
            });

            res.send(result);
        });

        // app.post("/favorites", async (req, res) => {
        //     const fav = req.body;
        //     const exists = await db.collection("favorites").findOne({
        //         userEmail: fav.userEmail,
        //         donationId: fav.donationId,
        //     });
        //     if (exists) {
        //         return res.status(409).send({ message: "Already in favorites" });
        //     }
        //     const result = await db.collection("favorites").insertOne({ ...fav, addedAt: new Date() });
        //     res.send(result);
        // });


        app.delete("/favorites", async (req, res) => {
            const { userEmail, donationId } = req.query;

            const result = await favoritesCollection.deleteOne({
                userEmail,
                donationId,
            });

            res.send(result);
        });

        // My reviews page for user dashboard
        app.get("/reviews/by-user/:email", async (req, res) => {
            const email = req.params.email;

            const result = await reviewsCollection
                .find({ userEmail: email })
                .sort({ createdAt: -1 })
                .toArray();

            res.send(result);
        });

        app.post("/reviews", async (req, res) => {
            const review = req.body;

            // Prevent multiple reviews by same user on same donation
            const exists = await reviewsCollection.findOne({
                userEmail: review.userEmail,
                donationId: review.donationId,
            });

            if (exists) {
                return res.status(409).send({ message: "You've already reviewed this donation." });
            }

            const result = await reviewsCollection.insertOne(review);
            res.send(result);
        });

        // Chart visualize
        app.get('/donations/by-email/:email', verifyFBToken, verifyRestaurant, async (req, res) => {
            const { email } = req.params;
            const donations = await donationCollection.find({ donorEmail: email, verification: 'Verified' }).toArray();
            res.send(donations);
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