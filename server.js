const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // ✅ يخدم ملفات HTML

/* ================================
   ✅ LOGIN VIA ODOO
================================ */

app.post("/login", async (req, res) => {

  const { name, national_id } = req.body;

  if (!name || !national_id) {
    return res.status(400).json({ success: false });
  }

  try {

    /* 1️⃣ Authenticate with Odoo */
    const loginResponse = await fetch("https://lanamed.odoo.com/web/session/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        params: {
          db: "lanamedicalco-main-4789102",
          login: "a.aljamai@lanamedical.com",
          password: "1234"
        }
      })
    });

    const loginData = await loginResponse.json();

    if (!loginData.result || !loginData.result.uid) {
      return res.status(401).json({ success: false });
    }

    /* 2️⃣ Search employee in hr.employee */
    const employeeResponse = await fetch("https://lanamed.odoo.com/web/dataset/call_kw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "hr.employee",
          method: "search_read",
          args: [[
            ["name", "=", name],
            ["identification_id", "=", national_id]
          ]],
          kwargs: {
            fields: ["name", "work_email", "job_title"]
          }
        }
      })
    });

    const employeeData = await employeeResponse.json();

    if (!employeeData.result || employeeData.result.length === 0) {
      return res.status(401).json({ success: false });
    }

    const employee = employeeData.result[0];

    /* 3️⃣ Issue JWT */
    const token = jwt.sign(
      { name: employee.name, role: "employee" },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      success: true,
      token,
      user: {
        name: employee.name,
        role: "employee"
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }

});

/* ================================
   ✅ START SERVER
================================ */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Odoo HR Server running");
});
