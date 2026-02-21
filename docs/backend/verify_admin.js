require("dotenv").config();

const mongoose = require("mongoose");

const User = require("./models/User");

const MONGODB_URI = process.env.MONGODB_URI;

async function verifyAdmin() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ Connected to MongoDB");

    const admin = await User.findOneAndUpdate(
      { email: "admin@grievmitra.gov.in" },
      { isVerified: true, verificationToken: undefined, tokenExpiry: undefined },
      { new: true }
    );

    if (admin) {
      console.log("✅ Admin verified successfully!");
      console.log("Admin details:", {
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isVerified: admin.isVerified
      });
    } else {
      console.log("❌ Admin user not found");
    }

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

verifyAdmin();
