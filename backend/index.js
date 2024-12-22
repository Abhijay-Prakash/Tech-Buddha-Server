require("dotenv").config();
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { s3UploadV3 } = require("./s3Service");

const app = express();
app.use(express.json());



mongoose.connect(process.env.MONGO_DB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => {
        console.error("Error connecting to MongoDB Atlas:", err);
        process.exit(1);
    });


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





const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
}).fields([
    { name: "image", maxCount: 1 },
    { name: "certificates", maxCount: 3 },
]);


app.post("/upload", upload, async (req, res) => {
    try {
        const { fullname, collegename, currentPositions, year, testimonials } = req.body;

        if (!fullname || !collegename || !currentPositions || !year || !req.files || !req.files.image) {
            return res.status(400).json({ success: false, error: "All fields and image are required" });
        }

        const positionsArray = Array.isArray(currentPositions) ? currentPositions : JSON.parse(currentPositions);
        const testimonialsArray = Array.isArray(testimonials) ? testimonials : JSON.parse(testimonials);

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
        res.status(201).json({ success: true, message: "Data uploaded successfully", data: savedUser });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});


app.get("/users", async (req, res) => {
    try {
        const { collegename, year } = req.query;

        if (!collegename || !year) {
            return res.status(400).json({ success: false, error: "College name and year are required" });
        }

        const users = await User.find({
            collegename,
            year: { $in: [year] },
        });

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "No records found for the provided criteria" });
        }

        res.status(200).json({ success: true, message: "Records fetched successfully", data: users });
    } catch (error) {
        console.error("Error fetching records:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
