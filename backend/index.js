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
    currentPositions: [String],
    currentRoles: [String],
    imageUrl: { type: String, required: true },
    certificateUrls: [String],
    year: String,
    cgpa: {
        type: Number,
        min: 0,
        max: 10,
        validate: {
            validator: function(v) {
                return this.userType !== 'college' || (v >= 0 && v <= 10);
            },
            message: 'CGPA must be between 0 and 10'
        }
    },
    testimonials: [String],
    skills: [String],
    portfolioUrl: String,
    linkedinUrl: String,
    quotes: [{
        quote: { type: String, required: true },
        author: { type: String, required: true }
    }]
}, {
    timestamps: true
});

const User = mongoose.model("User", userSchema);

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.fieldname === "image") {
        if (!file.mimetype.startsWith('image/')) {
            cb(new Error('Profile image must be an image file'), false);
        } else {
            cb(null, true);
        }
    } else if (file.fieldname === "certificates") {
        if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
            cb(new Error('Certificates must be image or PDF files'), false);
        } else {
            cb(null, true);
        }
    } else {
        cb(new Error('Unexpected field'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, 
        files: 6 
    }
}).fields([
    { name: "image", maxCount: 1 },
    { name: "certificates", maxCount: 5 }
]);

app.post("/upload", async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            upload(req, res, (err) => {
                if (err instanceof multer.MulterError) {
                    reject(new Error(`Upload error: ${err.message}`));
                } else if (err) {
                    reject(err);
                }
                resolve();
            });
        });

        if (!req.files?.image?.[0]) {
            return res.status(400).json({
                success: false,
                error: "Profile image is required"
            });
        }

        const {
            fullname,
            userType,
            collegename,
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

        if (!fullname || !userType) {
            return res.status(400).json({
                success: false,
                error: "Full name and user type are required"
            });
        }

        const imageBuffer = req.files.image[0].buffer;
        const imageName = `profile-${Date.now()}-${req.files.image[0].originalname}`;
        const { objectUrl: imageUrl } = await s3UploadV3(imageBuffer, imageName);

        const certificateUrls = [];
        if (req.files.certificates) {
            for (const file of req.files.certificates) {
                const { buffer, originalname } = file;
                const certName = `cert-${Date.now()}-${originalname}`;
                const { objectUrl } = await s3UploadV3(buffer, certName);
                certificateUrls.push(objectUrl);
            }
        }

        const parsedData = {
            currentPositions: Array.isArray(currentPositions) ? currentPositions : JSON.parse(currentPositions || '[]'),
            currentRoles: Array.isArray(currentRoles) ? currentRoles : JSON.parse(currentRoles || '[]'),
            testimonials: Array.isArray(testimonials) ? testimonials : JSON.parse(testimonials || '[]'),
            skills: Array.isArray(skills) ? skills : JSON.parse(skills || '[]'),
            quotes: Array.isArray(quotes) ? quotes : JSON.parse(quotes || '[]')
        };

        const userData = {
            fullname,
            userType,
            imageUrl,
            certificateUrls,
            linkedinUrl,
            quotes: parsedData.quotes,
            ...(userType === 'college' && {
                collegename,
                year,
                cgpa: cgpa ? parseFloat(cgpa) : undefined
            }),
            ...(userType === 'job' && {
                currentPositions: parsedData.currentPositions,
                currentRoles: parsedData.currentRoles,
                skills: parsedData.skills
            }),
            ...(userType === 'marketing' && {
                testimonials: parsedData.testimonials,
                portfolioUrl
            }),
            ...(userType === 'development' && {
                skills: parsedData.skills,
                portfolioUrl,
                currentPositions: parsedData.currentPositions
            })
        };

        const user = new User(userData);
        const savedUser = await user.save();

        res.status(201).json({
            success: true,
            message: "User data uploaded successfully",
            data: savedUser
        });

    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({
            success: false,
            error: err.message || "Internal server error"
        });
    }
});

app.get("/members", async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: "Failed to fetch members"
        });
    }
});

app.get("/members/:type", async (req, res) => {
    try {
        const { type } = req.params;
        if (!["college", "job", "marketing", "development"].includes(type)) {
            return res.status(400).json({
                success: false,
                error: "Invalid member type"
            });
        }

        const users = await User.find({ userType: type }).sort({ createdAt: -1 });
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: `Failed to fetch ${req.params.type} members`
        });
    }
});

app.get("/member/:slug", async (req, res) => {
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

        res.json({ success: true, data: member });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: "Failed to fetch member"
        });
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: "Something went wrong!"
    });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));