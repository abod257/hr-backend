const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

/* =============================
   Multer Setup
============================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* =============================
   Database
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
   Authentication
============================= */

app.post("/login", async (req, res) => {
  const { name, national_id } = req.body;

  const result = await pool.query(
    "SELECT * FROM employees WHERE TRIM(name)=TRIM($1) AND national_id=$2 AND status='active'",
    [name, national_id]
  );

  if (result.rows.length > 0) {
    res.json({ success: true, user: result.rows[0] });
  } else {
    res.status(401).json({ success: false });
  }
});

/* =============================
   Employees
============================= */

app.get("/employees", async (req, res) => {
  const result = await pool.query("SELECT * FROM employees ORDER BY id DESC");
  res.json(result.rows);
});

app.post("/employees", async (req, res) => {
  const { name, national_id, email, position, department, salary, role } = req.body;

  const result = await pool.query(
    `INSERT INTO employees (name, national_id, email, position, department, salary, role)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, national_id, email, position, department, salary, role || "employee"]
  );

  res.json(result.rows[0]);
});

app.put("/employees/:id", async (req, res) => {
  const { name, department, position, salary, status } = req.body;

  await pool.query(
    `UPDATE employees
     SET name=$1, department=$2, position=$3, salary=$4, status=$5
     WHERE id=$6`,
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

/* =============================
   Salary History
============================= */

app.put("/employees/salary/:id", async (req, res) => {
  const { salary } = req.body;

  await pool.query(
    "UPDATE employees SET salary=$1 WHERE id=$2",
    [salary, req.params.id]
  );

  res.json({ message: "Salary updated" });
});

/* =============================
   Requests
============================= */

app.get("/requests", async (req, res) => {
  const result = await pool.query(`
    SELECT requests.*, employees.name
    FROM requests
    JOIN employees ON requests.employee_id = employees.id
    ORDER BY requests.id DESC
  `);
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

/* =============================
   CSV Bulk Upload
============================= */

app.post("/bulk-upload", upload.single("file"), async (req, res) => {
  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      for (const row of results) {
        await pool.query(
          `INSERT INTO employees (name, national_id, department, position, salary)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (national_id)
           DO UPDATE SET department=$3, position=$4, salary=$5`,
          [row.name, row.national_id, row.department, row.position, row.salary]
        );
      }

      res.json({ message: "Bulk upload completed", count: results.length });
    });
});

/* =============================
   Company Settings
============================= */

app.post("/company-logo", upload.single("logo"), async (req, res) => {
  await pool.query(
    "INSERT INTO company_settings (company_name, logo_path) VALUES ($1,$2)
     ON CONFLICT (id) DO UPDATE SET logo_path=$2",
    ["شركة لانا الطبية", req.file.filename]
  );
  res.json({ message: "Logo updated" });
});

app.get("/company-settings", async (req, res) => {
  const result = await pool.query("SELECT * FROM company_settings LIMIT 1");
  res.json(result.rows[0] || {});
});

/* ============================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
