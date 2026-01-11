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

      // Create new user
      const newUser = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id,
        phone: "", // Will be updated later
        role: "citizen"
      });

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

    const user = await User.create({
      name,
      email,
      password_hash: hash,
      phone,
      role
    });

    res.json({ message: "✅ User registered successfully", user: { id: user._id, name: user.name, role: user.role } });
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
app.listen(PORT, () => {
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  console.log(`🚀 Server running on http://${host}:${PORT}`);
});
