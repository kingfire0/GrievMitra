const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const nodemailer = require("nodemailer");
require("dotenv").config();

// Import models
const User = require("./models/User");
const Grievance = require("./models/Grievance");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Session middleware for Passport
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Serve static files from the parent directory (docs)
app.use(express.static(path.join(__dirname, '..')));

// ✅ MongoDB Atlas Connection
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch(err => console.error("❌ MongoDB Atlas connection error:", err));

const JWT_SECRET = process.env.JWT_SECRET;

// Nodemailer transporter for email OTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

//-------------------------------------------------------------
// PASSPORT CONFIGURATION
//-------------------------------------------------------------

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with this Google ID
      let user = await User.findOne({ googleId: profile.id });

      if (user) {
        return done(null, user);
      }

      // Check if user exists with same email
      user = await User.findOne({ email: profile.emails[0].value });

      if (user) {
        // Link Google account to existing user
        user.googleId = profile.id;
        await user.save();
        return done(null, user);
      }

      // Create new user with OTP verification
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const newUser = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id,
        phone: "", // Will be updated later
        role: "citizen",
        isVerified: false,
        verificationToken: otp,
        tokenExpiry: new Date(Date.now() + 10 * 60 * 1000)
      });

      // Send OTP email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: newUser.email,
        subject: 'GrievMitra - Email Verification OTP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to GrievMitra!</h2>
            <p>Thank you for logging in with Google. Please verify your email address using the OTP below:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #333; font-size: 32px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <br>
            <p>Best regards,<br>GrievMitra Team</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);

      return done(null, newUser);
    } catch (error) {
      return done(error, null);
    }
  }
));

// Serialize and deserialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

//-------------------------------------------------------------
// AUTH ROUTES
//-------------------------------------------------------------

// Register
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone, role = "citizen" } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await User.create({
      name,
      email,
      password_hash: hash,
      phone,
      role,
      isVerified: false,
      verificationToken: otp,
      tokenExpiry
    });

    // Send OTP email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'GrievMitra - Email Verification OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to GrievMitra!</h2>
          <p>Thank you for registering. Please verify your email address using the OTP below:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #333; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <br>
          <p>Best regards,<br>GrievMitra Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

  res.json({ message: "✅ Registration successful! Please check your email for OTP verification.", email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify OTP
app.post("/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.isVerified) return res.status(400).json({ error: "Email already verified" });

    if (!user.verificationToken || user.verificationToken !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (new Date() > user.tokenExpiry) {
      return res.status(400).json({ error: "OTP expired" });
    }

    // Verify user
    user.isVerified = true;
    user.verificationToken = undefined;
    user.tokenExpiry = undefined;
    await user.save();

    // Send confirmation email
    const confirmationMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'GrievMitra - Account Verified Successfully!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to GrievMitra!</h2>
          <p>Congratulations! Your email address has been successfully verified.</p>
          <div style="background-color: #f0f9ff; padding: 20px; text-align: center; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1e40af; margin: 0;">Account Verified ✓</h3>
            <p style="margin: 10px 0 0;">You can now log in to your GrievMitra account and start submitting grievances.</p>
          </div>
          <p>You can now access all features of our platform to report and track grievances effectively.</p>
          <br>
          <p>Best regards,<br>GrievMitra Team</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(confirmationMailOptions);
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Don't fail the verification if email fails
    }

    res.json({ message: "✅ Email verified successfully! You can now log in." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid email" });

    if (!user.isVerified) return res.status(401).json({ error: "Please verify your email before logging in" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1h" });

    res.json({ message: "✅ Login successful", token, role: user.role, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Google Auth - Force Google account selection to ensure OAuth flow
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"], prompt: 'select_account' }));

app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/pages/login_screen.html" }), (req, res) => {
  // Check if user is verified
  if (!req.user.isVerified) {
    // Redirect to OTP verification page
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5000";
    res.redirect(`${frontendUrl}/pages/verify_otp.html?email=${encodeURIComponent(req.user.email)}`);
    return;
  }

  const token = jwt.sign({ id: req.user._id, role: req.user.role }, JWT_SECRET, { expiresIn: "1h" });

  // Redirect to frontend with token
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5000";
  res.redirect(`${frontendUrl}/pages/auth_callback.html?token=${token}&role=${req.user.role}&name=${encodeURIComponent(req.user.name)}&email=${encodeURIComponent(req.user.email)}`);
});

//-------------------------------------------------------------
// MIDDLEWARE
//-------------------------------------------------------------
function authenticate(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(403).json({ error: "No token provided" });

  const token = header.split(" ")[1];
  if (!token) return res.status(403).json({ error: "Invalid token format" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token invalid/expired" });
    req.user = user;
    next();
  });
}

//-------------------------------------------------------------
// GRIEVANCE ROUTES
//-------------------------------------------------------------

// Submit grievance (Citizen/Leader)
app.post("/grievances/create", authenticate, async (req, res) => {
  try {
    const { category, subject, description, location } = req.body;

    const refId = "GM-" + Date.now();

    const grievance = await Grievance.create({
      reference_id: refId,
      user: req.user.id,
      category,
      subject,
      description,
      location,
      status: "submitted"
    });

    res.json({ message: "✅ Grievance submitted", reference_id: refId, grievance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Track grievance by reference ID
app.get("/grievances/:refId", async (req, res) => {
  try {
    const grievance = await Grievance.findOne({ reference_id: req.params.refId })
      .populate("user", "name email role");

    if (!grievance) return res.status(404).json({ error: "Grievance not found" });

    res.json(grievance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin - view all grievances
app.get("/admin/grievances", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    const grievances = await Grievance.find().populate("user", "name email role");
    res.json(grievances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user profile (authenticated)
app.get("/auth/profile", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password_hash');

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profilePhotoUrl: user.profilePhotoUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile update endpoint (authenticated)
app.put("/auth/profile", authenticate, async (req, res) => {
  try {
    const { name, phone, profilePhotoUrl } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (profilePhotoUrl !== undefined) updateData.profilePhotoUrl = profilePhotoUrl;

    const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "✅ Profile updated successfully", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get grievances of logged-in user
app.get("/grievances/user", authenticate, async (req, res) => {
  try {
    const grievances = await Grievance.find({ user: req.user.id }).populate("user", "name email role");
    res.json(grievances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//-------------------------------------------------------------
// SERVER START
//-------------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
