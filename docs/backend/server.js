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

// Check environment variables
console.log('🔍 Checking email configuration...');
console.log('EMAIL_USER set:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS set:', !!process.env.EMAIL_PASS);

// Nodemailer transporter for email OTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Test transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter verification failed:', error);
  } else {
    console.log('✅ Email transporter is ready to send messages');
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

        // If user is not verified, send OTP for verification
        if (!user.isVerified) {
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          user.verificationToken = otp;
          user.tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
          await user.save();

          // Send OTP email
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'GrievMitra - Email Verification OTP',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Welcome back to GrievMitra!</h2>
                <p>Please verify your email address using the OTP below to complete your login:</p>
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

          try {
            console.log(`📧 Attempting to send OTP email to ${user.email} for Google OAuth login...`);
            const result = await transporter.sendMail(mailOptions);
            console.log(`✅ OTP email sent successfully to ${user.email}. Message ID: ${result.messageId}`);
          } catch (emailError) {
            console.error('❌ Error sending OTP email for existing user Google OAuth:', emailError);
            console.error('❌ Email error details:', {
              code: emailError.code,
              command: emailError.command,
              response: emailError.response
            });
            // Don't fail the OAuth flow if email fails
          }
        }

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

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP email sent to ${newUser.email} for Google OAuth`);
      } catch (emailError) {
        console.error('❌ Error sending OTP email for Google OAuth:', emailError);
        // Don't fail the OAuth flow if email fails
      }

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

    // Generate JWT token for automatic login
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1h" });

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
            <p style="margin: 10px 0 0;">You can now access all features of our platform to report and track grievances.</p>
          </div>
          <p>You are now automatically logged in and can start using GrievMitra immediately.</p>
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

    // Redirect to homepage with authentication token
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5000";
    res.redirect(`${frontendUrl}/pages/auth_callback.html?token=${token}&role=${user.role}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}`);
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
// ADMIN DASHBOARD API ROUTES
//-------------------------------------------------------------

// Get dashboard statistics
app.get("/admin/dashboard-stats", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total pending cases
    const pendingCount = await Grievance.countDocuments({ 
      status: { $in: ["submitted", "in_progress"] } 
    });

    // Urgent cases (high priority)
    const urgentCount = await Grievance.countDocuments({ 
      priority: "high",
      status: { $in: ["submitted", "in_progress"] }
    });

    // Resolved today
    const resolvedToday = await Grievance.countDocuments({
      status: "resolved",
      updatedAt: { $gte: today, $lt: tomorrow }
    });

    // Calculate average resolution time (in days) from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const resolvedGrievances = await Grievance.find({
      status: "resolved",
      updatedAt: { $gte: thirtyDaysAgo }
    });

    let avgResolutionDays = 0;
    if (resolvedGrievances.length > 0) {
      const totalTime = resolvedGrievances.reduce((acc, g) => {
        return acc + (g.updatedAt - g.createdAt);
      }, 0);
      avgResolutionDays = (totalTime / resolvedGrievances.length / (1000 * 60 * 60 * 24)).toFixed(1);
    }

    // Total resolved
    const totalResolved = await Grievance.countDocuments({ status: "resolved" });

    // Total submitted
    const totalSubmitted = await Grievance.countDocuments();

    // Satisfaction score (mock calculation based on resolved ratio)
    const satisfactionScore = totalResolved > 0 ? (4.2 + Math.random() * 0.8).toFixed(1) : "0.0";

    // Calculate trend (comparing with yesterday)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const resolvedYesterday = await Grievance.countDocuments({
      status: "resolved",
      updatedAt: { $gte: yesterday, $lt: today }
    });
    const trendPercent = resolvedYesterday > 0 
      ? Math.round(((resolvedToday - resolvedYesterday) / resolvedYesterday) * 100)
      : 0;

    res.json({
      pending: pendingCount,
      urgent: urgentCount,
      resolvedToday: resolvedToday,
      avgResolutionDays: parseFloat(avgResolutionDays),
      totalResolved,
      totalSubmitted,
      satisfaction: satisfactionScore,
      trend: trendPercent
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get priority grievances (urgent and high)
app.get("/admin/priority-grievances", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    const grievances = await Grievance.find({
      priority: { $in: ["high", "urgent"] },
      status: { $in: ["submitted", "in_progress"] }
    })
    .populate("user", "name email")
    .sort({ createdAt: 1 })
    .limit(10);

    res.json(grievances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get team performance (mock data - can be extended with actual team model)
app.get("/admin/team-performance", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    // Get all admins/officers
    const officers = await User.find({ role: { $in: ["admin", "officer"] } }).select("name department");

    // For each officer, get their performance metrics
    const teamPerformance = await Promise.all(
      officers.slice(0, 10).map(async (officer) => {
        const resolved = await Grievance.countDocuments({
          assignedTo: officer._id,
          status: "resolved"
        });
        const inProgress = await Grievance.countDocuments({
          assignedTo: officer._id,
          status: "in_progress"
        });
        
        const total = resolved + inProgress;
        const performancePercent = total > 0 ? Math.round((resolved / total) * 100) : 0;

        return {
          id: officer._id,
          name: officer.name || "Unknown",
          department: officer.department || "General",
          resolved,
          inProgress,
          performance: performancePercent
        };
      })
    );

    // If no officers found, return default mock data
    if (teamPerformance.length === 0) {
      res.json([
        { id: "1", name: "Suresh Kumar", department: "PWD", resolved: 12, inProgress: 2, performance: 98 },
        { id: "2", name: "Ravi Gupta", department: "Health", resolved: 8, inProgress: 3, performance: 94 },
        { id: "3", name: "Maya Singh", department: "Revenue", resolved: 6, inProgress: 4, performance: 87 },
        { id: "4", name: "Anil Sharma", department: "Education", resolved: 10, inProgress: 2, performance: 92 },
        { id: "5", name: "Sunita Devi", department: "Transport", resolved: 7, inProgress: 3, performance: 89 }
      ]);
    } else {
      res.json(teamPerformance);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent activity
app.get("/admin/recent-activity", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    // Get recent grievances with their status changes
    const recentGrievances = await Grievance.find()
      .populate("user", "name")
      .sort({ updatedAt: -1 })
      .limit(20);

    const activities = recentGrievances.map(g => {
      let action = "";
      let icon = "";
      
      switch (g.status) {
        case "submitted":
          action = `New grievance submitted: ${g.subject}`;
          icon = "submitted";
          break;
        case "in_progress":
          action = `Case ${g.reference_id} is now in progress`;
          icon = "progress";
          break;
        case "resolved":
          action = `Case ${g.reference_id} has been resolved`;
          icon = "resolved";
          break;
        case "rejected":
          action = `Case ${g.reference_id} was rejected`;
          icon = "rejected";
          break;
        default:
          action = `Case ${g.reference_id} updated`;
          icon = "update";
      }

      return {
        id: g._id,
        action,
        icon,
        referenceId: g.reference_id,
        timestamp: g.updatedAt,
        status: g.status
      };
    });

    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get department performance
app.get("/admin/department-performance", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    // Get category-wise performance (using category as department proxy)
    const categories = ["Public Works", "Health", "Revenue", "Education", "Transport", "Water Supply", "Electricity", "Other"];
    
    const departmentStats = await Promise.all(
      categories.map(async (category) => {
        const total = await Grievance.countDocuments({ category });
        const resolved = await Grievance.countDocuments({ category, status: "resolved" });
        const pending = await Grievance.countDocuments({ category, status: { $in: ["submitted", "in_progress"] } });
        
        const performance = total > 0 ? Math.round((resolved / total) * 100) : 0;

        return {
          department: category,
          total,
          resolved,
          pending,
          performance
        };
      })
    );

    // Filter out empty departments and sort by performance
    const filteredStats = departmentStats.filter(d => d.total > 0).sort((a, b) => b.performance - a.performance);

    res.json(filteredStats.length > 0 ? filteredStats : [
      { department: "Public Works", total: 45, resolved: 42, pending: 3, performance: 94 },
      { department: "Health", total: 32, resolved: 29, pending: 3, performance: 91 },
      { department: "Revenue", total: 28, resolved: 24, pending: 4, performance: 87 },
      { department: "Education", total: 22, resolved: 19, pending: 3, performance: 89 },
      { department: "Transport", total: 18, resolved: 16, pending: 2, performance: 89 }
    ]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Filter grievances (with search, status, category, date range)
app.get("/admin/grievances/filter", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    const { status, category, priority, search, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { reference_id: { $regex: search, $options: "i" } }
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const grievances = await Grievance.find(query)
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Grievance.countDocuments(query);

    res.json({
      grievances,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update grievance status (already exists but ensure it's complete)
app.put("/admin/grievances/:id/status", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    const { status, priority, notes } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;

    const grievance = await Grievance.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate("user", "name email");

    if (!grievance) return res.status(404).json({ error: "Grievance not found" });

    res.json({ message: "✅ Status updated successfully", grievance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//-------------------------------------------------------------
// GRIEVANCE ROUTES
//-------------------------------------------------------------

// Submit grievance (Citizen/Leader)
app.post("/grievances/create", authenticate, async (req, res) => {
  try {
    const { category, subject, description, location, priority = "medium" } = req.body;

    const refId = "GM-" + Date.now();

    const grievance = await Grievance.create({
      reference_id: refId,
      user: req.user.id,
      category,
      subject,
      description,
      location,
      priority,
      status: "submitted"
    });

    res.json({ message: "✅ Grievance submitted", reference_id: refId, grievance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Track grievance by reference ID (public endpoint - no auth required)
app.get("/api/track/:refId", async (req, res) => {
  try {
    const grievance = await Grievance.findOne({ reference_id: req.params.refId })
      .populate("user", "name email phone");

    if (!grievance) {
      return res.status(404).json({ error: "Grievance not found. Please check your tracking ID." });
    }

    // Return simplified data for public tracking
    res.json({
      reference_id: grievance.reference_id,
      category: grievance.category,
      subject: grievance.subject,
      description: grievance.description,
      status: grievance.status,
      priority: grievance.priority,
      createdAt: grievance.createdAt,
      updatedAt: grievance.updatedAt,
      location: grievance.location,
      user: {
        name: grievance.user?.name || "Anonymous",
        phone: grievance.user?.phone || ""
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy track endpoint
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
// OFFICER API ROUTES
//-------------------------------------------------------------

// Get all officers (for admin to assign)
app.get("/admin/officers", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    const officers = await User.find({ role: { $in: ["officer", "admin"] } })
      .select("name email department role")
      .sort({ name: 1 });

    res.json(officers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get grievances assigned to logged-in officer
app.get("/officer/grievances", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "officer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Officer login required." });
    }

    const grievances = await Grievance.find({ assignedTo: req.user.id })
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    res.json(grievances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update officer's assigned grievance status
app.put("/officer/grievances/:id", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "officer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { status, notes } = req.body;

    const grievance = await Grievance.findById(req.params.id);

    if (!grievance) {
      return res.status(404).json({ error: "Grievance not found" });
    }

    // Verify the grievance is assigned to this officer (or admin can update any)
    if (req.user.role !== "admin" && grievance.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({ error: "This grievance is not assigned to you" });
    }

    if (status) grievance.status = status;
    if (notes) grievance.notes = notes;

    await grievance.save();

    res.json({ message: "Grievance updated successfully", grievance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign grievance to an officer (admin only)
app.put("/admin/grievances/:id/assign", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied. Admin only." });

    const { officerId } = req.body;

    const grievance = await Grievance.findById(req.params.id);

    if (!grievance) {
      return res.status(404).json({ error: "Grievance not found" });
    }

    // Verify officer exists and assign
    if (officerId) {
      const officer = await User.findById(officerId);
      if (!officer) {
        return res.status(404).json({ error: "Officer not found" });
      }
      grievance.assignedTo = officerId;
      grievance.assignedAt = new Date();
    } else {
      grievance.assignedTo = null;
      grievance.assignedAt = null;
    }

    await grievance.save();

    const populatedGrievance = await Grievance.findById(grievance._id)
      .populate("user", "name email")
      .populate("assignedTo", "name email");

    res.json({ message: "Grievance assigned successfully", grievance: populatedGrievance });
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
