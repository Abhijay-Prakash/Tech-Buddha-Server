require("dotenv").config();
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { s3UploadV3 } = require("./s3Service");
const cors = require('cors');
const connectToMongoDB = require("./connectToMongoDB");
const User = require('./models/userModel');
const Achievement = require('./models/achievementsModel');



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

connectToMongoDB();



const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
    { name: "image", maxCount: 10 },
    { name: "certificates", maxCount: 10 },
]);



app.post("/upload", upload, async (req, res) => {
    try {

        const { fullname, userType, collegename, currentPositions, year, testimonials, skills } = req.body;

        if (!fullname || !userType || !currentPositions || !req.files || !req.files.image) {

            return res.status(400).json({ success: false, error: "Required fields and image are missing" });
        }

        if (!["college", "job", "marketing", "development"].includes(userType)) {
            return res.status(400).json({ success: false, error: "Invalid userType" });
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
            testimonials: testimonialsArray,
            certificateUrls,
            skills: userType === "job" || userType === "development" ? skillsArray : null,
        });

        const savedUser = await user.save();
        res.status(201).json({ success: true, message: "Data uploaded successfully", data: savedUser });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// app.get("/members", async (req, res) => {
//     try {
//         const users = await User.find({});
//         res.json(users);
//     } catch (err) {
//         console.error("Error fetching members:", err);
//         res.status(500).json({ success: false, error: "Internal Server Error" });
//     }
// });



// Fetch all members
app.get("/members", async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (err) {
        console.error("Error fetching members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// Fetch college members
app.get("/members/college", async (req, res) => {
    try {
        const collegeUsers = await User.find({ userType: "college" });
        const formattedUsers = collegeUsers.map(user => ({
            fullname: user.fullname,
            collegename: user.collegename,
            year: user.year,
            imageUrl: user.imageUrl,
        }));
        res.json(formattedUsers);
    } catch (err) {
        console.error("Error fetching college members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// Fetch job members
app.get("/members/job", async (req, res) => {
    try {
        const jobUsers = await User.find({ userType: "job" });
        const formattedUsers = jobUsers.map(user => ({
            fullname: user.fullname,
            currentPositions: user.currentPositions,
            skills: user.skills,
            imageUrl: user.imageUrl,
        }));
        res.json(formattedUsers);
    } catch (err) {
        console.error("Error fetching job members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// Fetch marketing members
app.get("/members/marketing", async (req, res) => {
    try {
        const marketingUsers = await User.find({ userType: "marketing" });
        const formattedUsers = marketingUsers.map(user => ({
            fullname: user.fullname,
            testimonials: user.testimonials,
            imageUrl: user.imageUrl,
        }));
        res.json(formattedUsers);
    } catch (err) {
        console.error("Error fetching marketing members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// Fetch development members
app.get("/members/development", async (req, res) => {
    try {
        const developmentUsers = await User.find({ userType: "development" });
        const formattedUsers = developmentUsers.map(user => ({
            fullname: user.fullname,
            skills: user.skills,
            certificateUrls: user.certificateUrls,
            imageUrl: user.imageUrl,
        }));
        res.json(formattedUsers);
    } catch (err) {
        console.error("Error fetching development members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});


app.post("/achievements", upload, async (req, res) => {
    try {
        const { name, date } = req.body;

        if (!name || !req.files || !req.files.image) {
            return res.status(400).json({ success: false, error: "Name and images are required" });
        }

        const imageUrls = [];
        for (const file of req.files.image) {
            const { buffer, originalname } = file;
            const { objectUrl } = await s3UploadV3(buffer, originalname); 
            imageUrls.push(objectUrl);
        }

        const achievement = new Achievement({
            name,
            imageUrls,
            date
        });

        const savedAchievement = await achievement.save();
        res.status(201).json({ success: true, message: "Achievement added successfully", data: savedAchievement });
    } catch (err) {
        console.error("Error adding achievement:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});


app.get("/achievements", async (req, res) => {
    try {
        const achievements = await Achievement.find({});
        res.status(200).json({ success: true, data: achievements });
    } catch (err) {
        console.error("Error fetching achievements:", err);
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



app.delete("/members/:id", async (req, res) => {
    try {
        const { id } = req.params;
        
        const member = await User.findById(id);
        
        if (!member) {
            return res.status(404).json({
                success: false,
                error: "Member not found"
            });
        }

        await User.findByIdAndDelete(id);

        res.json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }
});


app.put("/members/:slug", upload, async (req, res) => {
    try {
        const { slug } = req.params;
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

        const updates = {};
        const fields = [
            'fullname', 'userType', 'collegename', 'position', 'year', 
            'cgpa', 'portfolioUrl', 'linkedinUrl'
        ];

        fields.forEach(field => {
            if (req.body[field]) {
                updates[field] = req.body[field];
            }
        });

        if (req.body.currentPositions) {
            updates.currentPositions = JSON.parse(req.body.currentPositions);
        }
        if (req.body.currentRoles) {
            updates.currentRoles = JSON.parse(req.body.currentRoles);
        }
        if (req.body.testimonials) {
            updates.testimonials = JSON.parse(req.body.testimonials);
        }
        if (req.body.skills) {
            updates.skills = JSON.parse(req.body.skills);
        }
        if (req.body.quotes) {
            updates.quotes = JSON.parse(req.body.quotes);
        }

        const updatedUser = await User.findByIdAndUpdate(
            member._id,
            { $set: updates },
            { new: true }
        );

        res.json({
            success: true,
            message: "User updated successfully",
            data: updatedUser
        });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }
});




app.put("/achievements/:id", upload, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, date } = req.body;

        const updates = { name, date };
        
        if (req.files && req.files.image) {
            const imageUrls = [];
            for (const file of req.files.image) {
                const { buffer, originalname } = file;
                const { objectUrl } = await s3UploadV3(buffer, originalname);
                imageUrls.push(objectUrl);
            }
            updates.imageUrls = imageUrls;
        }

        const updatedAchievement = await Achievement.findByIdAndUpdate(
            id,
            updates,
            { new: true }
        );

        if (!updatedAchievement) {
            return res.status(404).json({ success: false, error: "Achievement not found" });
        }

        res.json({ success: true, data: updatedAchievement });
    } catch (err) {
        console.error("Error updating achievement:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.delete("/achievements/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const achievement = await Achievement.findByIdAndDelete(id);
        
        if (!achievement) {
            return res.status(404).json({ success: false, error: "Achievement not found" });
        }

        res.json({ success: true, message: "Achievement deleted successfully" });
    } catch (err) {
        console.error("Error deleting achievement:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
