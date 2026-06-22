require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const multer = require("multer");
const xlsx = require("xlsx");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key";

// إعداد الاتصال بقاعدة البيانات
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// تهيئة الجدول
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        employee_code TEXT,
        name TEXT,
        national_id TEXT UNIQUE,
        nationality TEXT,
        birth_year INTEGER,
        salary NUMERIC,
        role TEXT DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Database Ready");
  } catch (err) {
    console.error("❌ Database Init Error:", err);
  }
}

// التحقق من التوكن
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(403).json({ message: "No token" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/* ================= LOGIN ================= */
app.post("/login", async (req, res) => {
  const { name, national_id } = req.body;
  const cleanName = String(name || "").trim().toLowerCase();
  const cleanNationalId = String(national_id || "").trim();

  // Admin Login
  if (cleanName === "admin" && cleanNationalId === "0000") {
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "8h" });
    return res.json({ success: true, token, user: { name: "admin", role: "admin" } });
  }

  // Employee Login
  const result = await pool.query(
    `SELECT * FROM employees WHERE LOWER(TRIM(name))=$1 AND national_id=$2`,
    [cleanName, cleanNationalId]
  );

  if (result.rows.length === 0) return res.status(401).json({ success: false });
  const user = result.rows[0];
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role } });
});

/* ================= EMPLOYEES LIST ================= */
app.get("/employees", verifyToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  try {
    const result = await pool.query("SELECT * FROM employees");
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ================= UPLOAD ================= */
const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload-employees", verifyToken, upload.single("file"), async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  
  const workbook = xlsx.read(req.file.buffer);
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  for (const row of data) {
    await pool.query(
      `INSERT INTO employees (employee_code, name, national_id, nationality, birth_year, salary, role) 
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (national_id) DO NOTHING`,
      [row.employee_code, row.name, row.national_id, row.nationality, row.birth_year, row.salary, row.role || "employee"]
    );
  }
  res.json({ message: "Success" });
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
async function start() {
  await initDB();
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}
start();
