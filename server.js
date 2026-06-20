const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ✅ الاتصال بقاعدة البيانات Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// ✅ إعادة إنشاء جدول الموظفين (تنظيف كامل)
async function initDB() {

  // حذف الجدول القديم بالكامل
  await pool.query(`DROP TABLE IF EXISTS employees;`);

  // إنشاء جدول جديد نظيف
  await pool.query(`
    CREATE TABLE employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      national_id TEXT NOT NULL,
      email TEXT,
      position TEXT,
      department TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("✅ Employees table recreated successfully");
}

initDB();

// ✅ جلب جميع الموظفين
app.get("/employees", async (req, res) => {
  const result = await pool.query("SELECT * FROM employees ORDER BY id DESC");
  res.json(result.rows);
});

// ✅ إضافة موظف عبر POST
app.post("/employees", async (req, res) => {
  const { name, national_id, email, position, department } = req.body;

  if (!name || !national_id) {
    return res.status(400).json({ message: "name and national_id required" });
  }

  const result = await pool.query(
    "INSERT INTO employees (name, national_id, email, position, department) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [name, national_id, email || null, position || null, department || null]
  );

  res.json(result.rows[0]);
});

// ✅ تسجيل الدخول
app.post("/login", async (req, res) => {
  const { name, national_id } = req.body;

  if (!name || !national_id) {
    return res.status(400).json({ success: false });
  }

  const result = await pool.query(
    "SELECT * FROM employees WHERE name = $1 AND national_id = $2",
    [name, national_id]
  );

  if (result.rows.length > 0) {
    res.json({ success: true, employee: result.rows[0] });
  } else {
    res.status(401).json({ success: false });
  }
});

// ✅ إضافة موظف سريع من المتصفح (مؤقت للاختبار)
app.get("/add-employee", async (req, res) => {
  const { name, national_id } = req.query;

  if (!name || !national_id) {
    return res.send("يرجى تمرير name و national_id في الرابط");
  }

  await pool.query(
    "INSERT INTO employees (name, national_id) VALUES ($1,$2)",
    [name, national_id]
  );

  res.send("✅ تم إضافة الموظف بنجاح");
});

// ✅ حذف موظف
app.delete("/employees/:id", async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM employees WHERE id = $1", [id]);
  res.json({ message: "Employee deleted" });
});

// ✅ تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
