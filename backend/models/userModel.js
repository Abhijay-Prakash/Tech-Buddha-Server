const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true,
    },
    userType: {
        type: String,
        enum: ["college", "job", "marketing", "development"],
        required: true,
    },
    collegename: {
        type: String,
        default: null,
    },
    currentPositions: {
        type: [String],
        default: [],
    },
    imageUrl: {
        type: String,
        required: true,
    },
    year: {
        type: String,
        default: null,
    },
    testimonials: {
        type: [String],
        default: [],
    },
    certificateUrls: {
        type: [String],
        default: [],
    },
    skills: {
        type: [String],
        default: [],
    },
    currentRoles: {
        type: [String],
        default: [],
    },
    position: {
        type: String,
        default: null,
    },
    cgpa: {
        type: Number,
        default: null,
    },
    portfolioUrl: {
        type: String,
        default: null,
    },
    linkedinUrl: {
        type: String,
        default: null,
    },
    quotes: {
        type: [String],
        default: [],
    }
}, {
    timestamps: true 
});

const User = mongoose.model("User", userSchema);

module.exports = User;