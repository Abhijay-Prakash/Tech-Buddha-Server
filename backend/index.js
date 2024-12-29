require("dotenv").config();
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { s3UploadV3 } = require("./s3Service");
const cors = require('cors');

const app = express();
app.use(express.json());

app.use(cors({
     origin: [
        'http://localhost:5173', 
        'https://tech-buddhaa.vercel.app', 
        'https://www.lenienttree.com'
    ], 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));
  
mongoose.connect(process.env.MONGO_DB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => {
        console.error("Error connecting to MongoDB Atlas:", err);
        process.exit(1);
    });

const userSchema = new mongoose.Schema({
    fullname: String,
    userType: { 
        type: String, 
        enum: ["college", "job", "marketing", "development"], 
        required: true 
    },
    collegename: String,
    currentPositions: [String],
    imageUrl: String,
    year: [String],
    cgpa: { type: Number, min: 0, max: 10 },  
    testimonials: [String],
    certificateUrls: [String],
    skills: [String],
    linkedinUrl: String,  
    quote: String,        
    quoteAuthor: String   
});
const User = mongoose.model("User", userSchema);

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, 
}).fields([
    { name: "image", maxCount: 1 },
    { name: "certificates", maxCount: 3 },
]);

app.post("/upload", upload, async (req, res) => {
    try {
        const { 
            fullname, 
            userType, 
            collegename, 
            currentPositions, 
            year, 
            cgpa,  // Added CGPA
            testimonials, 
            skills,
            linkedinUrl,   
            quote,         
            quoteAuthor    
        } = req.body;

        if (!fullname || !userType || !currentPositions || !req.files || !req.files.image) {
            return res.status(400).json({ success: false, error: "Required fields and image are missing" });
        }

        if (!["college", "job", "marketing", "development"].includes(userType)) {
            return res.status(400).json({ success: false, error: "Invalid userType" });
        }

        // Validate CGPA if provided for college students
        if (userType === "college" && cgpa !== undefined) {
            const cgpaNum = parseFloat(cgpa);
            if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
                return res.status(400).json({ success: false, error: "CGPA must be a number between 0 and 10" });
            }
        }

        const positionsArray = Array.isArray(currentPositions) ? currentPositions : JSON.parse(currentPositions);
        const testimonialsArray = Array.isArray(testimonials) ? testimonials : JSON.parse(testimonials);
        const skillsArray = skills ? (Array.isArray(skills) ? skills : JSON.parse(skills)) : [];

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
            userType,
            collegename: userType === "college" ? collegename : null,
            currentPositions: positionsArray,
            imageUrl,
            year: userType === "college" ? year : null,
            cgpa: userType === "college" ? parseFloat(cgpa) : null,  // Added CGPA
            testimonials: testimonialsArray,
            certificateUrls,
            skills: userType === "job" || userType === "development" ? skillsArray : null,
            linkedinUrl,   
            quote,         
            quoteAuthor    
        });

        const savedUser = await user.save();
        res.status(201).json({ success: true, message: "Data uploaded successfully", data: savedUser });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.get("/members", async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (err) {
        console.error("Error fetching members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.get("/members/college", async (req, res) => {
    try {
        const collegeUsers = await User.find({ userType: "college" });
        const formattedUsers = collegeUsers.map(user => ({
            fullname: user.fullname,
            collegename: user.collegename,
            year: user.year,
            cgpa: user.cgpa,  // Added CGPA
            imageUrl: user.imageUrl,
            linkedinUrl: user.linkedinUrl,  
            quote: user.quote,              
            quoteAuthor: user.quoteAuthor   
        }));
        res.json(formattedUsers);
    } catch (err) {
        console.error("Error fetching college members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.get("/members/job", async (req, res) => {
    try {
        const jobUsers = await User.find({ userType: "job" });
        const formattedUsers = jobUsers.map(user => ({
            fullname: user.fullname,
            currentPositions: user.currentPositions,
            skills: user.skills,
            imageUrl: user.imageUrl,
            linkedinUrl: user.linkedinUrl, 
            quote: user.quote,             
            quoteAuthor: user.quoteAuthor  
        }));
        res.json(formattedUsers);
    } catch (err) {
        console.error("Error fetching job members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.get("/members/marketing", async (req, res) => {
    try {
        const marketingUsers = await User.find({ userType: "marketing" });
        const formattedUsers = marketingUsers.map(user => ({
            fullname: user.fullname,
            testimonials: user.testimonials,
            imageUrl: user.imageUrl,
            linkedinUrl: user.linkedinUrl,  
            quote: user.quote,              
            quoteAuthor: user.quoteAuthor   
        }));
        res.json(formattedUsers);
    } catch (err) {
        console.error("Error fetching marketing members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.get("/members/development", async (req, res) => {
    try {
        const developmentUsers = await User.find({ userType: "development" });
        const formattedUsers = developmentUsers.map(user => ({
            fullname: user.fullname,
            skills: user.skills,
            certificateUrls: user.certificateUrls,
            imageUrl: user.imageUrl,
            linkedinUrl: user.linkedinUrl,  
            quote: user.quote,              
            quoteAuthor: user.quoteAuthor   
        }));
        res.json(formattedUsers);
    } catch (err) {
        console.error("Error fetching development members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.get("/members/:slug", async (req, res) => {
    try {
        const slug = req.params.slug;
        const members = await User.find({});

        const member = members.find(m => {
            const memberSlug = m.fullname.toLowerCase()
                .replace(/\s+/g, "-")    
                .replace(/\./g, "")      
                .normalize("NFD")        
                .replace(/[\u0300-\u036f]/g, ""); 

            return memberSlug === slug;
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                error: "Member not found"
            });
        }

        const formattedResponse = {
            fullname: member.fullname,
            imageUrl: member.imageUrl,
            userType: member.userType,
            currentPositions: member.currentPositions || [],
            skills: member.skills || [],
            testimonials: member.testimonials || [],
            certificateUrls: member.certificateUrls || [],
            collegename: member.collegename,
            year: member.year,
            cgpa: member.cgpa,  
            linkedinUrl: member.linkedinUrl,  
            quote: member.quote,              
            quoteAuthor: member.quoteAuthor   
        };

        res.json({ success: true, data: formattedResponse });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));