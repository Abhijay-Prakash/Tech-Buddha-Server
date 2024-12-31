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
        default: null,
    },
    year: {
        type: [String],
        default: [],
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
});

const User = mongoose.model("User", userSchema);

module.exports = User;
