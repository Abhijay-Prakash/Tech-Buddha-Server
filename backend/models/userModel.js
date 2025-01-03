const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_DB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => {
        console.error("Error connecting to MongoDB Atlas:", err);
        process.exit(1);
    });

// Define the User schema
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
});


const User = mongoose.model('User', userSchema);

module.exports = User;
