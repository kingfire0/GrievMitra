const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password_hash: {
    type: String,
    required: false
  },
  googleId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  phone: {
    type: String,
    required: false,
    trim: true
  },
  role: {
    type: String,
    enum: ["citizen", "leader", "admin"],
    default: "citizen"
  },
  profilePhotoUrl: {
    type: String,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", UserSchema);
