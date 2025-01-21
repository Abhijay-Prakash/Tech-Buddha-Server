require("dotenv").config();
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { s3UploadV3 } = require("./s3Service");
const cors = require('cors');
const connectToMongoDB = require("./connectToMongoDB");
const User = require('./models/userModel');
const Achievement = require('./models/achievementsModel');
const { College } = require("./models/college");



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
    { name: "10th", maxCount: 1 },
    { name: "12th", maxCount: 1 },
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
            quotes,
        } = req.body;

        if (!fullname || !userType || !currentPositions || !currentRoles || !req.files || !req.files.image) {
            return res.status(400).json({ success: false, error: "Required fields and image are missing" });
        }

        if (!["college", "job", "marketing", "development"].includes(userType)) {
            return res.status(400).json({ success: false, error: "Invalid userType" });
        }

        const parsedCurrentPositions = currentPositions ? JSON.parse(currentPositions) : [];
        const parsedCurrentRoles = currentRoles ? JSON.parse(currentRoles) : [];
        const parsedTestimonials = testimonials ? JSON.parse(testimonials) : [];
        const parsedSkills = skills ? JSON.parse(skills) : [];
        const parsedQuotes = quotes ? JSON.parse(quotes) : [];

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


        const tenthCertificateUrl = req.files['10th'] ? await s3UploadV3(req.files['10th'][0].buffer, req.files['10th'][0].originalname).objectUrl : null;
        const twelfthCertificateUrl = req.files['12th'] ? await s3UploadV3(req.files['12th'][0].buffer, req.files['12th'][0].originalname).objectUrl : null;

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
            quotes: parsedQuotes,
            _10thCertificateUrl: tenthCertificateUrl,
            _12thCertificateUrl: twelfthCertificateUrl
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



app.get("/members", async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (err) {
        console.error("Error fetching members:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});


app.post("/add-colleges", async (req, res) => {
    try {
        const users = await User.find({ userType: "college" });

        for (const user of users) {
            const collegename = user.collegename;
            if (collegename) {
                const existingCollege = await College.findOne({ collegename: collegename });

                if (!existingCollege) {
                    const newCollege = new College({
                        collegename: collegename
                    });

                    await newCollege.save();
                    console.log(`Added new college: ${collegename}`);
                } else {
                    console.log(`College already exists: ${collegename}`);
                }
            }
        }

        res.status(200).json({ success: true, message: "Colleges added/checked successfully." });
    } catch (err) {
        console.error("Error adding colleges:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" ,err});
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
            testimonials: user.testimonials,
            cgpa: user.cgpa,
            imageUrl: user.imageUrl,
            linkedinUrl: user.linkedinUrl,
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
            quotes: Array.isArray(member.quotes) ? member.quotes : [],
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

        if (req.files && req.files.image) {
            const imageBuffer = req.files.image[0].buffer;
            const imageName = req.files.image[0].originalname;
            const { objectUrl: imageUrl } = await s3UploadV3(imageBuffer, imageName);
            updates.imageUrl = imageUrl;
        }

        if (req.files && req.files.certificates) {
            const certificateUrls = [];
            for (const file of req.files.certificates) {
                const { buffer, originalname } = file;
                const { objectUrl } = await s3UploadV3(buffer, originalname);
                certificateUrls.push(objectUrl);
            }
            updates.certificateUrls = certificateUrls;
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


app.put("/addCollege", async (req, res) => {
    try {
        const { collegename, imageUrl, linkedinUrl, projects } = req.body;

        if(!collegename){
            return res.status(400).json({
                success: false,
                message: "College Name is required"
            });
        }
        const existingCollege = await College.findOne({ collegename });

        if (existingCollege) {
            return res.status(409).json({
                success: false,
                message: "College already exists"
            });
        }

        const newCollege = new College({
            collegename,
            imageUrl,
            linkedinUrl,
            projects
        });
        await newCollege.save();

        res.status(201).json({ 
            success: true, 
            message: "College added successfully" 
        });

    } catch (err) {
        console.error("Error adding college:", err);
        res.status(500).json({ 
            success: false, 
            error: "Internal Server Error" 
        });
    }
});

app.get("/colleges", async(req,res)=>{
    try {
        const colleges = await College.find({});
        res.json(colleges);
    } catch (err) {
        console.error("Error fetching colleges:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
})




app.post("/addProject", async (req, res) => {
    try {
        const { collegename, project } = req.body;

        if (!collegename || !project || !project.title || !project.description) {
            return res.status(400).json({
                success: false,
                message: "College name and project details (title, description) are required",
            });
        }

        const college = await College.findOne({ collegename });
        if (!college) {
            return res.status(404).json({
                success: false,
                message: "College not found",
            });
        }
        college.projects.push(project);
        await college.save();
        res.status(200).json({
            success: true,
            message: "Project added successfully",
            updatedCollege: college,
        });

    } catch (err) {
        console.error("Error adding project:", err);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
        });
    }
});

app.get("/getProjects", async (req, res) => {
    try {
        const { collegename } = req.query;

        if (!collegename) {
            return res.status(400).json({
                success: false,
                message: "College name is required",
            });
        }

        const college = await College.findOne({ collegename });
        if (!college) {
            return res.status(404).json({
                success: false,
                message: "College not found",
            });
        }

        res.status(200).json({
            success: true,
            projects: college.projects,
        });

    } catch (err) {
        console.error("Error getting projects:", err);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
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
app.listen(PORT, () => console.log(`LISTENING  ON PORT ${PORT}`));
