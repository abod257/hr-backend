const express = require('express');
const path = require('path');
const app = express();

// إعداد المجلد العام للملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

// مسار الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تشغيل الخادم
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`النظام يعمل الآن: http://localhost:${PORT}`);
});
