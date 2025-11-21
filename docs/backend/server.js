const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

// Import models
const User = require("./models/User");
const Grievance = require("./models/Grievance");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the parent directory (docs)
app.use(express.static(path.join(__dirname, '..')));

// ✅ MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/grievmitra")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const JWT_SECRET = "supersecret123"; // 🔑 change to env var in production

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

    res.json({ message: "✅ Login successful", token, role: user.role, name: user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

//-------------------------------------------------------------
// SERVER START
//-------------------------------------------------------------
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
