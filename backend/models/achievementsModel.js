const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    imageUrls: {
        type: [String],
        required: true,
    },
    date:{
        type:Date
    }
});

const Achievement = mongoose.model("Achievement", achievementSchema);

module.exports = Achievement;
