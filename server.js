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

const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// تهيئة قاعدة البيانات
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
  } catch (err) { console.error("❌ DB Error:", err); }
}

pool.connect().then(() => { initDB(); });

// تسجيل الدخول
app.post("/login", async (req, res) => {
  try {
    const { name, national_id } = req.body;
    const cleanName = String(name || "").trim().toLowerCase();
    const cleanNationalId = String(national_id || "").trim();

    if (cleanName === "admin" && cleanNationalId === "0000") {
      const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "8h" });
      return res.json({ success: true, token, user: { name: "admin", role: "admin" } });
    }

    const result = await pool.query(
      `SELECT * FROM employees WHERE LOWER(TRIM(name))=$1 AND national_id=$2`,
      [cleanName, cleanNationalId]
    );

    if (result.rows.length === 0) return res.status(401).json({ success: false });

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) { res.status(500).json({ success: false }); }
});

// جلب الموظفين (للمسؤول)
app.get("/employees", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM employees");
    res.json(result.rows);
  } catch (err) { res.status(500).json([]); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
