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
    fullname: { type: String, required: true },
    userType: { 
        type: String, 
        enum: ["college", "job", "marketing", "development"], 
        required: true 
    },
    collegename: String,
    position: String,
    currentPositions: [String],
    currentRoles: [String],
    imageUrl: String,
    year: String,
    cgpa: { 
        type: Number, 
        min: 0, 
        max: 10 
    },
    testimonials: [String],
    certificateUrls: [String],
    skills: [String],
    portfolioUrl: String,
    linkedinUrl: String,
    quotes: [{
        quote: String,
        author: String
    }]
});

const User = mongoose.model("User", userSchema);

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, 
}).fields([
    { name: "image", maxCount: 1 },
    { name: "certificates", maxCount: 5 },
]);

app.post("/upload", upload, async (req, res) => {
    try {
        const { 
            fullname, 
            userType, 
            collegename,
            position,
            currentPositions, 
            currentRoles,
            year, 
            cgpa,
            testimonials, 
            skills,
            portfolioUrl,
            linkedinUrl,
            quotes
        } = req.body;

        if (!fullname || !userType || !req.files || !req.files.image) {
            return res.status(400).json({ success: false, error: "Required fields and image are missing" });
        }

        if (!["college", "job", "marketing", "development"].includes(userType)) {
            return res.status(400).json({ success: false, error: "Invalid userType" });
        }

        // Parse JSON strings if they're passed as strings
        const parsedQuotes = JSON.parse(quotes || "[]");
        const parsedCurrentPositions = currentPositions ? JSON.parse(currentPositions) : [];
        const parsedCurrentRoles = currentRoles ? JSON.parse(currentRoles) : [];
        const parsedTestimonials = testimonials ? JSON.parse(testimonials) : [];
        const parsedSkills = skills ? JSON.parse(skills) : [];

        // Upload image to S3
        const imageBuffer = req.files.image[0].buffer;
        const imageName = req.files.image[0].originalname;
        const { objectUrl: imageUrl } = await s3UploadV3(imageBuffer, imageName);

        // Upload certificates to S3 if any
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
            collegename: userType === "college" ? collegename : undefined,
            position: userType === "college" ? position : undefined,
            currentPositions: parsedCurrentPositions,
            currentRoles: parsedCurrentRoles,
            imageUrl,
            year: userType === "college" ? year : undefined,
            cgpa: userType === "college" && cgpa ? parseFloat(cgpa) : undefined,
            testimonials: parsedTestimonials,
            certificateUrls,
            skills: parsedSkills,
            portfolioUrl,
            linkedinUrl,
            quotes: parsedQuotes
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
            position: user.position,
            year: user.year,
            cgpa: user.cgpa,
            imageUrl: user.imageUrl,
            linkedinUrl: user.linkedinUrl,
            quotes: user.quotes
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
            currentRoles: user.currentRoles,
            skills: user.skills,
            imageUrl: user.imageUrl,
            linkedinUrl: user.linkedinUrl,
            quotes: user.quotes
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
            currentRoles: user.currentRoles,
            testimonials: user.testimonials,
            portfolioUrl: user.portfolioUrl,
            imageUrl: user.imageUrl,
            linkedinUrl: user.linkedinUrl,
            quotes: user.quotes
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
            currentRoles: user.currentRoles,
            skills: user.skills,
            portfolioUrl: user.portfolioUrl,
            certificateUrls: user.certificateUrls,
            imageUrl: user.imageUrl,
            linkedinUrl: user.linkedinUrl,
            quotes: user.quotes
        }));
        res.json(formattedUsers);
    } catch (err) {
        console.error("Error fetching development members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// app.get("/members/:slug", async (req, res) => {
//     try {
//         const slug = req.params.slug;
//         const members = await User.find({});

//         const member = members.find(m => {
//             const memberSlug = m.fullname.toLowerCase()
//                 .replace(/\s+/g, "-")
//                 .replace(/\./g, "")
//                 .normalize("NFD")
//                 .replace(/[\u0300-\u036f]/g, "");

//             return memberSlug === slug;
//         });

//         if (!member) {
//             return res.status(404).json({
//                 success: false,
//                 error: "Member not found"
//             });
//         }

//         const formattedResponse = {
//             fullname: member.fullname,
//             imageUrl: member.imageUrl,
//             userType: member.userType,
//             currentPositions: member.currentPositions || [],
//             currentRoles: member.currentRoles || [],
//             skills: member.skills || [],
//             testimonials: member.testimonials || [],
//             certificateUrls: member.certificateUrls || [],
//             collegename: member.collegename,
//             position: member.position,
//             year: member.year,
//             cgpa: member.cgpa,
//             portfolioUrl: member.portfolioUrl,
//             linkedinUrl: member.linkedinUrl,
//             quotes: member.quotes || []
//         };

//         res.json({ success: true, data: formattedResponse });
//     } catch (err) {
//         res.status(500).json({
//             success: false,
//             error: "Internal Server Error"
//         });
//     }
// });



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

        let roles = [];
        if (member.currentRoles && Array.isArray(member.currentRoles)) {
            roles = member.currentRoles;
        } else if (member.currentRoles) {
            try {
                roles = JSON.parse(member.currentRoles);
            } catch (e) {
                roles = [member.currentRoles];
            }
        }

        const formattedResponse = {
            fullname: member.fullname,
            imageUrl: member.imageUrl,
            userType: member.userType,
            currentPositions: member.currentPositions || [],
            currentRoles: roles, 
            skills: member.skills || [],
            testimonials: member.testimonials || [],
            certificateUrls: member.certificateUrls || [],
            collegename: member.collegename,
            position: member.position,
            year: member.year,
            cgpa: member.cgpa,
            portfolioUrl: member.portfolioUrl,
            linkedinUrl: member.linkedinUrl,
            quotes: Array.isArray(member.quotes) ? member.quotes : []
        };

        res.json({ success: true, data: formattedResponse });
    } catch (err) {
        console.error("Error in /members/:slug:", err);
        res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));