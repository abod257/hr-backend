const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

/* =============================
   إعداد رفع الملفات
============================= */

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

/* =============================
   قاعدة البيانات
============================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      national_id TEXT NOT NULL,
      email TEXT,
      position TEXT,
      department TEXT,
      salary NUMERIC,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      type TEXT,
      details TEXT,
      status TEXT DEFAULT 'pending',
      admin_reply TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      file_name TEXT,
      file_path TEXT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id SERIAL PRIMARY KEY,
      company_name TEXT,
      logo_path TEXT
    )
  `);

  console.log("✅ Database Ready");
}

initDB();

/* =============================
   الموظفين
============================= */

app.get("/employees", async (req, res) => {
  const result = await pool.query("SELECT * FROM employees ORDER BY id DESC");
  res.json(result.rows);
});

app.post("/employees", async (req, res) => {
  const { name, national_id, email, position, department, salary } = req.body;

  const result = await pool.query(
    `INSERT INTO employees 
    (name, national_id, email, position, department, salary) 
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, national_id, email || null, position || null, department || null, salary || null]
  );

  res.json(result.rows[0]);
});

app.put("/employees/:id", async (req, res) => {
  const { id } = req.params;
  const { name, department, position, salary, status } = req.body;

  await pool.query(
    `UPDATE employees 
     SET name=$1, department=$2, position=$3, salary=$4, status=$5
     WHERE id=$6`,
    [name, department, position, salary, status, id]
  );

  res.json({ message: "Employee updated" });
});

app.delete("/employees/:id", async (req, res) => {
  await pool.query("DELETE FROM employees WHERE id=$1", [req.params.id]);
  res.json({ message: "Employee deleted" });
});

/* =============================
   تسجيل الدخول
============================= */

app.post("/login", async (req, res) => {
  const { name, national_id } = req.body;

  const result = await pool.query(
    "SELECT * FROM employees WHERE TRIM(name)=TRIM($1) AND national_id=$2",
    [name, national_id]
  );

  if (result.rows.length > 0) {
    res.json({ success: true, employee: result.rows[0] });
  } else {
    res.status(401).json({ success: false });
  }
});

/* =============================
   الطلبات
============================= */

app.post("/requests", async (req, res) => {
  const { employee_id, type, details } = req.body;

  await pool.query(
    "INSERT INTO requests (employee_id,type,details) VALUES ($1,$2,$3)",
    [employee_id, type, details]
  );

  res.json({ message: "Request submitted" });
});

app.get("/requests", async (req, res) => {
  const result = await pool.query(`
    SELECT requests.*, employees.name 
    FROM requests 
    JOIN employees ON requests.employee_id = employees.id
    ORDER BY requests.id DESC
