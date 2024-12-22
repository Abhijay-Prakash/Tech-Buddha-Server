require("dotenv").config();
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { s3UploadV3 } = require("./s3Service");

const app = express();
app.use(express.json());




const userSchema = new mongoose.Schema({
    fullname: String,
    collegename: String,
    currentPositions: [String],
    imageUrl: String,
    year: [String],
    testimonials: [String],
    certificateUrls: [String],
});



const User = mongoose.model("User", userSchema);



mongoose.connect(process.env.MONGO_DB_URI)
    .then(() => console.log("Connected to Mong0DB"))
    .catch(err => console.error("Error connecting to MongoDB Atlas:", err));





const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
}).fields([
    { name: "image", maxCount: 1 }, // Single image
    { name: "certificates", maxCount: 3 },
]);

app.post("/upload", upload, async (req, res) => {
    try {
        const { fullname, collegename, currentPositions, year, testimonials } = req.body;


        if (!fullname || !collegename || !currentPositions || !year || !req.files || !req.files.image) {
            return res.status(400).json({ error: "All fields and image are required" });
        }

        const positionsArray = JSON.parse(currentPositions);
        const testimonialsArray = JSON.parse(testimonials);


        const imageBuffer = req.files.image[0].buffer;
        const imageName = req.files.image[0].originalname;
        const { objectUrl: imageUrl } = await s3UploadV3(imageBuffer, imageName);


        const certificateUrls = [];
        if (req.files.certificates) {
            for (const file of req.files.certificates) {
                const { buffer, originalname } = file;
                const { objectUrl } = await s3UploadV3(buffer, originalname);
                certificateUrls.push(objectUrl);
            }
        }


        const user = new User({
            fullname,
            collegename,
            currentPositions: positionsArray,
            imageUrl,
            year,
            testimonials: testimonialsArray,
            certificateUrls,
        });

        const savedUser = await user.save();

        res.json({
            message: "Data uplo0ded successfully",
            data: savedUser,
        });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



app.get("/users", async (req, res) => {
    try {
        const { collegename, year } = req.query;


        if (!collegename || !year) {
            return res.status(400).json({ error: "College name and year are required" });
        }

        const users = await User.find({
            collegename,
            year: { $in: [year] },
        });


        if (users.length === 0) {
            return res.status(404).json({ message: "No records found for the provided criteria" });
        }

        res.json({
            message: "Records fetched successfully",
            data: users,
        });
    } catch (error) {
        console.error("Error fetching records:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



app.listen(4000, () => console.log("Listenting to port 4000"));
