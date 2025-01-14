const mongoose = require('mongoose');


const collegeSchema = new mongoose.Schema({
    collegename: { type: String, required: true },
    imageUrl: { type: String},
    linkedinUrl: String,
    projects: [{
        title: String,
        description: String,
        imageUrl: String,
        projectUrl: String
    }],
});

export const College = mongoose.model('College', collegeSchema);