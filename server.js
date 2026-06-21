const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const multer = require("multer");
const xlsx = require("xlsx");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* ================================
   ✅ DATABASE
================================ */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
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
}

initDB();

/* ================================
   ✅ JWT
================================ */

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(403).json({ message: "No token" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/* ================================
   ✅ LOGIN
================================ */

app.post("/login", async (req, res) => {

  const { name, national_id, birth_year } = req.body;

  const result = await pool.query(
    `SELECT * FROM employees 
     WHERE TRIM(name)=TRIM($1) 
     AND national_id=$2 
     AND birth_year=$3`,
    [name, national_id, birth_year]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ success: false });
  }

  const user = result.rows[0];

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role
    }
  });
});

/* ================================
   ✅ EXCEL UPLOAD
================================ */

const upload = multer({ storage: multer.memoryStorage() });

app.post("/upload-employees", verifyToken, upload.single("file"), async (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }

  const workbook = xlsx.read(req.file.buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);

  for (const row of data) {

    await pool.query(
      `INSERT INTO employees 
      (employee_code, name, national_id, nationality, birth_year, salary) 
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (national_id) DO NOTHING`,
      [
        row.employee_code,
        row.name,
        row.national_id,
        row.nationality,
        row.birth_year,
        row.salary
      ]
    );
  }

  res.json({ message: "Employees uploaded successfully" });
});

/* ================================
   ✅ START
================================ */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 HR Excel Server running");
});
