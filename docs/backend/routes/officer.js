// Officer API Routes
// These routes handle officer-specific functionality

module.exports = function(app, authenticate) {
  // Get all officers (for admin to assign)
  app.get("/admin/officers", authenticate, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

      const User = req.app.locals.User;
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

      const Grievance = req.app.locals.Grievance;
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

      const Grievance = req.app.locals.Grievance;
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

      const Grievance = req.app.locals.Grievance;
      const User = req.app.locals.User;
      const { officerId } = req.body;

      const grievance = await Grievance.findById(req.params.id);

      if (!grievance) {
        return res.status(404).json({ error: "Grievance not found" });
      }

      // Verify officer exists
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

  console.log("✅ Officer routes loaded");
};
