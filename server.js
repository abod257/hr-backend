const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بقاعدة البيانات من Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// إنشاء جدول الموظفين إذا لم يكن موجود
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      position TEXT,
      department TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Employees table ready");
}

initDB();

// ✅ جلب جميع الموظفين
app.get("/employees", async (req, res) => {
  const result = await pool.query("SELECT * FROM employees ORDER BY id DESC");
  res.json(result.rows);
});

// ✅ إضافة موظف جديد
app.post("/employees", async (req, res) => {
  const { name, email, position, department } = req.body;

  const result = await pool.query(
    "INSERT INTO employees (name, email, position, department) VALUES ($1, $2, $3, $4) RETURNING *",
    [name, email, position, department]
  );

  res.json(result.rows[0]);
});

// ✅ حذف موظف
app.delete("/employees/:id", async (req, res) => {
  const { id } = req.params;

  await pool.query("DELETE FROM employees WHERE id = $1", [id]);

  res.json({ message: "Employee deleted" });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
