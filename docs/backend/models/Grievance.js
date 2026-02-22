const mongoose = require("mongoose");

const GrievanceSchema = new mongoose.Schema({
  reference_id: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  category: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    district: {
      type: String,
      required: true
    },
    pincode: {
      type: String,
      required: true
    },
    landmark: {
      type: String,
      default: ""
    }
  },
  status: {
    type: String,
    enum: ["submitted", "in_progress", "resolved", "rejected"],
    default: "submitted"
  },
  department: {
    type: String,
    enum: ["Public Works", "Health", "Revenue", "Education", "Transport", "Water Supply", "Electricity", "Environment", "Safety", "Other", ""],
    default: ""
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  assignedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Automatically update "updatedAt"
GrievanceSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Grievance", GrievanceSchema);
