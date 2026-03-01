import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from 'url';
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("clinic.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'staff'
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mrn TEXT UNIQUE,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    contact TEXT,
    patient_type TEXT DEFAULT 'New',
    conditions TEXT,
    region TEXT,
    zone TEXT,
    woreda TEXT,
    kebele TEXT,
    treatment_type TEXT,
    diabetes_type TEXT,
    cvd_risk TEXT,
    cvd_treatment_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    visit_date DATE DEFAULT (DATE('now')),
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    heart_rate INTEGER,
    temperature REAL,
    respiratory_rate INTEGER,
    spo2 INTEGER,
    blood_sugar_level REAL,
    hba1c REAL,
    creatinine REAL,
    cholesterol REAL,
    triglycerides REAL,
    urinalysis TEXT,
    weight REAL,
    notes TEXT,
    complications TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
  );
`);

// Migration: Ensure all columns exist for existing databases
const ensureColumns = () => {
  const tables = {
    users: ['role'],
    patients: ['mrn', 'region', 'zone', 'woreda', 'kebele', 'treatment_type', 'diabetes_type', 'cvd_risk', 'cvd_treatment_type'],
    visits: ['heart_rate', 'temperature', 'respiratory_rate', 'spo2', 'hba1c', 'creatinine', 'cholesterol', 'triglycerides', 'urinalysis', 'complications']
  };

  for (const [table, columns] of Object.entries(tables)) {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    const existingColumns = info.map((c: any) => c.name);
    
    for (const column of columns) {
      if (!existingColumns.includes(column)) {
        try {
          db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${column === 'temperature' || column.includes('sugar') || column === 'hba1c' || column === 'creatinine' || column === 'cholesterol' || column === 'triglycerides' || column === 'weight' ? 'REAL' : (column === 'urinalysis' || column === 'complications' || column === 'mrn' || column === 'region' || column === 'zone' || column === 'woreda' || column === 'kebele' ? 'TEXT' : 'INTEGER')}`).run();
          console.log(`Added column ${column} to ${table}`);
        } catch (e) {
          console.error(`Error adding column ${column} to ${table}:`, e);
        }
      }
    }
  }
};

ensureColumns();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Serve Logo
  app.get("/api/image/logo", (req, res) => {
    // Using a professional medical logo placeholder
    res.redirect("https://img.icons8.com/color/480/medical-doctor.png");
  });

  // Authentication Routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { username, password, full_name, role } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const userRole = role || 'staff';
      const info = db.prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)").run(username, hashedPassword, full_name || username, userRole);
      
      res.json({ id: info.lastInsertRowid, username, full_name: full_name || username, role: userRole });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "Username already exists" });
      }
      console.error("Signup error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      let user: any = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
      
      if (user) {
        // User exists, check password
        if (!bcrypt.compareSync(password, user.password)) {
          return res.status(401).json({ error: "Invalid password" });
        }
      } else {
        // User doesn't exist, auto-register
        const hashedPassword = bcrypt.hashSync(password, 10);
        const role = username.toLowerCase().includes('admin') ? 'admin' : 'staff';
        const info = db.prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)").run(username, hashedPassword, username, role);
        user = { id: info.lastInsertRowid, username, full_name: username, role };
      }
      
      res.json({ id: user.id, username: user.username, full_name: user.full_name, role: user.role });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all patients
  app.get("/api/patients", (req, res) => {
    const patients = db.prepare(`
      SELECT p.*, MAX(v.visit_date) as last_visit 
      FROM patients p 
      LEFT JOIN visits v ON p.id = v.patient_id 
      GROUP BY p.id 
      ORDER BY p.name ASC
    `).all();
    res.json(patients);
  });

  // Search patients
  app.get("/api/patients/search", (req, res) => {
    const query = req.query.q || "";
    const patients = db.prepare(`
      SELECT p.*, MAX(v.visit_date) as last_visit 
      FROM patients p 
      LEFT JOIN visits v ON p.id = v.patient_id 
      WHERE p.name LIKE ? OR p.contact LIKE ? OR p.conditions LIKE ? OR p.mrn LIKE ?
      GROUP BY p.id 
      ORDER BY p.name ASC
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
    res.json(patients);
  });

  // Add new patient
  app.post("/api/patients", (req, res) => {
    try {
      const { mrn, name, age, gender, contact, conditions, patient_type, region, zone, woreda, kebele, treatment_type, diabetes_type, cvd_risk, cvd_treatment_type, created_at } = req.body;
      const finalMrn = mrn || Math.floor(100000 + Math.random() * 900000).toString();
      const info = db.prepare(
        "INSERT INTO patients (mrn, name, age, gender, contact, conditions, patient_type, region, zone, woreda, kebele, treatment_type, diabetes_type, cvd_risk, cvd_treatment_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(finalMrn, name, age, gender, contact, conditions, patient_type || 'New', region, zone, woreda, kebele, treatment_type, diabetes_type, cvd_risk, cvd_treatment_type, created_at || new Date().toISOString());
      res.json({ id: info.lastInsertRowid, mrn: finalMrn });
    } catch (err) {
      console.error("Error creating patient:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete patient
  app.delete("/api/patients/:id", (req, res) => {
    try {
      const { id } = req.params;
      const patientId = parseInt(id);
      
      console.log(`[API] Attempting to delete patient with ID: ${patientId}`);
      
      if (isNaN(patientId)) {
        return res.status(400).json({ error: "Invalid patient ID" });
      }

      // Use a transaction for safety
      const deleteVisits = db.prepare("DELETE FROM visits WHERE patient_id = ?");
      const deletePatient = db.prepare("DELETE FROM patients WHERE id = ?");
      
      const transaction = db.transaction((id) => {
        deleteVisits.run(id);
        deletePatient.run(id);
      });

      transaction(patientId);
      
      console.log(`[API] Successfully deleted patient ${patientId} and all their visits`);
      res.json({ success: true, message: "Patient and records deleted successfully" });
    } catch (err) {
      console.error("[API] Error deleting patient:", err);
      res.status(500).json({ error: "Internal server error: " + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // Delete visit
  app.delete("/api/visits/:id", (req, res) => {
    try {
      const { id } = req.params;
      const visitId = parseInt(id);
      
      console.log(`[API] Attempting to delete visit with ID: ${visitId}`);
      
      if (isNaN(visitId)) {
        return res.status(400).json({ error: "Invalid visit ID" });
      }

      const info = db.prepare("DELETE FROM visits WHERE id = ?").run(visitId);
      
      if (info.changes === 0) {
        return res.status(404).json({ error: "Visit not found" });
      }
      
      console.log(`[API] Successfully deleted visit ${visitId}`);
      res.json({ success: true, message: "Visit deleted successfully" });
    } catch (err) {
      console.error("[API] Error deleting visit:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update patient
  app.put("/api/patients/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { mrn, name, age, gender, contact, conditions, patient_type, region, zone, woreda, kebele, treatment_type, diabetes_type, cvd_risk, cvd_treatment_type } = req.body;
      
      db.prepare(`
        UPDATE patients SET 
          mrn = ?, name = ?, age = ?, gender = ?, contact = ?, 
          conditions = ?, patient_type = ?, region = ?, zone = ?, 
          woreda = ?, kebele = ?, treatment_type = ?, diabetes_type = ?, cvd_risk = ?, cvd_treatment_type = ?
        WHERE id = ?
      `).run(mrn, name, age, gender, contact, conditions, patient_type, region, zone, woreda, kebele, treatment_type, diabetes_type, cvd_risk, cvd_treatment_type, id);
      
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating patient:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add visit
  app.post("/api/visits", (req, res) => {
    try {
      const { 
        patient_id, systolic_bp, diastolic_bp, heart_rate, temperature, 
        respiratory_rate, spo2, blood_sugar_level, hba1c, creatinine, 
        cholesterol, triglycerides, urinalysis, weight, notes, complications 
      } = req.body;
      
      // Helper to convert empty strings to null
      const n = (val: any) => (val === '' || val === undefined) ? null : val;
      
      // Update patient type to 'Repeat' if they have a visit
      db.prepare("UPDATE patients SET patient_type = 'Repeat' WHERE id = ?").run(patient_id);
      
      const info = db.prepare(`
        INSERT INTO visits (
          patient_id, systolic_bp, diastolic_bp, heart_rate, temperature, 
          respiratory_rate, spo2, blood_sugar_level, hba1c, creatinine, 
          cholesterol, triglycerides, urinalysis, weight, notes, complications
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patient_id, n(systolic_bp), n(diastolic_bp), n(heart_rate), n(temperature), 
        n(respiratory_rate), n(spo2), n(blood_sugar_level), n(hba1c), n(creatinine), 
        n(cholesterol), n(triglycerides), urinalysis, n(weight), notes, complications
      );
      
      res.json({ id: info.lastInsertRowid });
    } catch (err) {
      console.error("Error creating visit:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get reports data
  app.get("/api/reports/summary", (req, res) => {
    try {
      const { month, year } = req.query;
      let patientWhere = "";
      let visitWhere = "";
      const params: any[] = [];

      if (month && year) {
        // SQLite strftime format: %m is 01-12, %Y is YYYY
        // We expect month to be 1-12 from frontend, so we pad it
        const paddedMonth = month.toString().padStart(2, '0');
        patientWhere = " WHERE strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?";
        visitWhere = " WHERE strftime('%m', visit_date) = ? AND strftime('%Y', visit_date) = ?";
        params.push(paddedMonth, year);
      }

      const totalPatients = db.prepare(`SELECT COUNT(*) as count FROM patients${patientWhere}`).get(...params).count;
      const newPatients = db.prepare(`SELECT COUNT(*) as count FROM patients${patientWhere}${patientWhere ? ' AND' : ' WHERE'} patient_type = 'New'`).get(...params).count;
      const repeatPatients = db.prepare(`SELECT COUNT(*) as count FROM patients${patientWhere}${patientWhere ? ' AND' : ' WHERE'} patient_type = 'Repeat'`).get(...params).count;
      
      const conditionCounts = db.prepare(`
        SELECT 
          SUM(CASE WHEN conditions LIKE '%Hypertension%' AND conditions NOT LIKE '%Diabetes%' THEN 1 ELSE 0 END) as hypertension_only,
          SUM(CASE WHEN conditions LIKE '%Diabetes%' AND conditions NOT LIKE '%Hypertension%' THEN 1 ELSE 0 END) as diabetes_only,
          SUM(CASE WHEN conditions LIKE '%Hypertension%' AND conditions LIKE '%Diabetes%' THEN 1 ELSE 0 END) as both
        FROM patients${patientWhere}
      `).get(...params);

      const genderDistribution = db.prepare(`
        SELECT 
          SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) as male,
          SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) as female,
          SUM(CASE WHEN gender = 'Other' THEN 1 ELSE 0 END) as other
        FROM patients${patientWhere}
      `).get(...params);

      const genderByCondition = {
        hypertension: db.prepare(`
          SELECT 
            SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) as male,
            SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) as female,
            SUM(CASE WHEN gender = 'Other' THEN 1 ELSE 0 END) as other
          FROM patients WHERE conditions LIKE '%Hypertension%' ${patientWhere ? ' AND ' + patientWhere.substring(7) : ''}
        `).get(...params),
        diabetes: db.prepare(`
          SELECT 
            SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) as male,
            SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) as female,
            SUM(CASE WHEN gender = 'Other' THEN 1 ELSE 0 END) as other
          FROM patients WHERE conditions LIKE '%Diabetes%' ${patientWhere ? ' AND ' + patientWhere.substring(7) : ''}
        `).get(...params)
      };

      const recentVisits = db.prepare(`
        SELECT v.*, p.name as patient_name 
        FROM visits v 
        JOIN patients p ON v.patient_id = p.id 
        ${visitWhere}
        ORDER BY v.visit_date DESC LIMIT 10
      `).all(...params);

      res.json({
        totalPatients,
        newPatients,
        repeatPatients,
        conditionCounts: {
          hypertension_only: conditionCounts.hypertension_only || 0,
          diabetes_only: conditionCounts.diabetes_only || 0,
          both: conditionCounts.both || 0
        },
        genderDistribution: {
          male: genderDistribution.male || 0,
          female: genderDistribution.female || 0,
          other: genderDistribution.other || 0
        },
        genderByCondition: {
          hypertension: {
            male: genderByCondition.hypertension.male || 0,
            female: genderByCondition.hypertension.female || 0,
            other: genderByCondition.hypertension.other || 0
          },
          diabetes: {
            male: genderByCondition.diabetes.male || 0,
            female: genderByCondition.diabetes.female || 0,
            other: genderByCondition.diabetes.other || 0
          }
        },
        recentVisits
      });
    } catch (err) {
      console.error("Error fetching report summary:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
