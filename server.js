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

/* ========= Upload Setup ========= */
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* ========= Database ========= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      national_id TEXT NOT NULL UNIQUE,
      email TEXT,
      position TEXT,
      department TEXT,
      salary NUMERIC DEFAULT 0,
      role TEXT DEFAULT 'employee',
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
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
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      file_name TEXT,
      file_path TEXT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("✅ Database Ready");
}

initDB();

/* ========= LOGIN ========= */

app.post("/login", async (req, res) => {
  const { name, national_id } = req.body;

  const result = await pool.query(
    "SELECT * FROM employees WHERE TRIM(name)=TRIM($1) AND national_id=$2 AND status='active'",
    [name, national_id]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ success: false });
  }

  const user = result.rows[0];

  res.json({
    success: true,
    role: user.role,
    user: user
  });
});

/* ========= EMPLOYEES ========= */

app.get("/employees", async (req, res) => {
  const result = await pool.query("SELECT * FROM employees ORDER BY id DESC");
  res.json(result.rows);
});

app.post("/employees", async (req, res) => {
  const { name, national_id, email, position, department, salary, role } = req.body;

  const result = await pool.query(
    `INSERT INTO employees (name,national_id,email,position,department,salary,role)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, national_id, email || null, position || null, department || null, salary || 0, role || "employee"]
  );

  res.json(result.rows[0]);
});

app.put("/employees/:id", async (req, res) => {
  const { name, department, position, salary, status } = req.body;

  await pool.query(
    "UPDATE employees SET name=$1,department=$2,position=$3,salary=$4,status=$5 WHERE id=$6",
    [name, department, position, salary, status, req.params.id]
  );

  res.json({ message: "Employee updated" });
});

app.put("/employees/archive/:id", async (req, res) => {
  await pool.query(
    "UPDATE employees SET status='archived' WHERE id=$1",
    [req.params.id]
  );

  res.json({ message: "Employee archived" });
});

/* ========= REQUESTS ========= */

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
  `);
  res.json(result.rows);
});

app.get("/requests/:employeeId", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM requests WHERE employee_id=$1 ORDER BY id DESC",
    [req.params.employeeId]
  );
  res.json(result.rows);
});

app.put("/requests/:id", async (req, res) => {
  const { status, admin_reply } = req.body;

  await pool.query(
    "UPDATE requests SET status=$1, admin_reply=$2 WHERE id=$3",
    [status, admin_reply, req.params.id]
  );

  res.json({ message: "Request updated" });
});

/* ========= FILES ========= */

app.post("/upload-file", upload.single("file"), async (req, res) => {
  await pool.query(
    "INSERT INTO files (employee_id,file_name,file_path) VALUES ($1,$2,$3)",
    [req.body.employee_id, req.file.originalname, req.file.filename]
  );

  res.json({ message: "File uploaded" });
});

app.get("/files", async (req, res) => {
  const result = await pool.query(`
    SELECT files.*, employees.name
    FROM files
    JOIN employees ON files.employee_id = employees.id
  `);
  res.json(result.rows);
});

/* ========= START ========= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running");
});
