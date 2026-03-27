const cors = require("cors");
const express = require("express");
const db = require("./db");

const app = express();

// Render için CORS ayarını en geniş haliyle bırakıyoruz ki hata vermesin
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 🔹 Ana test
app.get("/", (req, res) => {
  res.send("Mahsun Usta Vale Sistemi Aktif");
});

// 🔹 Araç ekleme
app.post("/vehicles", (req, res) => {
  const { plate, location } = req.body;
  if (!plate) return res.status(400).json({ error: "Plaka gerekli" });

  db.get(
    "SELECT * FROM vehicles WHERE plate = ? AND status = 'parked'",
    [plate],
    (err, row) => {
      if (err) return res.status(500).json(err);
      if (row) return res.status(400).json({ error: "Bu araç zaten parkta!" });

      const id = Date.now().toString();
      const checkin_time = new Date().toISOString();
      
      db.run(
        `INSERT INTO vehicles (id, plate, location, status, checkin_time) VALUES (?, ?, ?, ?, ?)`,
        [id, plate, location || "", "parked", checkin_time],
        function (err) {
          if (err) return res.status(500).json(err);
          res.json({ id, plate, location, status: "parked", checkin_time });
        }
      );
    }
  );
});

// 🔹 Müşteri Aracı Çağırıyor
app.put("/vehicles/request/:plate", (req, res) => {
  const plate = req.params.plate.toUpperCase();
  db.run(
    "UPDATE vehicles SET status = 'requested' WHERE plate = ? AND status = 'parked'",
    [plate],
    function (err) {
      if (err) return res.status(500).json(err);
      if (this.changes === 0) return res.status(404).json({ error: "Parkta araç bulunamadı!" });
      res.json({ message: "Talebiniz alındı, vale aracınızı hazırlıyor! 🚗" });
    }
  );
});

// 🔹 Müşteri Durum Sorgulama
app.get("/vehicles/status/:plate", (req, res) => {
  const plate = req.params.plate.toUpperCase();
  db.get(
    "SELECT id, status, location, checkin_time, checkout_time FROM vehicles WHERE plate = ? ORDER BY checkin_time DESC LIMIT 1",
    [plate],
    (err, row) => {
      if (err) return res.status(500).json(err);
      if (!row) return res.status(404).json({ error: "Araç bulunamadı" });
      res.json(row); 
    }
  );
});

// 🔹 Araçları Listele (Admin Paneli)
app.get("/vehicles", (req, res) => {
  db.all("SELECT * FROM vehicles ORDER BY checkin_time DESC", [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

// 🔹 Araç Teslim Et (Checkout)
app.put("/vehicles/:id/checkout", (req, res) => {
  const id = req.params.id;
  const checkout_time = new Date().toISOString();
  db.run(
    "UPDATE vehicles SET status = 'delivered', checkout_time = ? WHERE id = ?",
    [checkout_time, id],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ message: "Araç teslim edildi" });
    }
  );
});

// ==========================================
// 💬 CHAT VE SARI ÇİZGİ BİLDİRİM SİSTEMİ
// ==========================================
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate TEXT,
    sender TEXT,
    message TEXT,
    is_read INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0`, (err) => {
    if (!err) console.log("✅ Chat bildirim sistemi (is_read) aktif edildi.");
  });
});

app.post("/chat/send", (req, res) => {
  const { plate, sender, message } = req.body;
  db.run(
    "INSERT INTO messages (plate, sender, message, is_read) VALUES (?, ?, ?, 0)",
    [plate.toUpperCase(), sender, message],
    function(err) {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

app.get("/chat/:plate", (req, res) => {
  const plate = req.params.plate.toUpperCase();
  db.all("SELECT * FROM messages WHERE plate = ? ORDER BY timestamp ASC", [plate], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows || []);
  });
});

app.get("/chat-alerts", (req, res) => {
  db.all("SELECT plate FROM messages WHERE sender = 'customer' AND is_read = 0 GROUP BY plate", [], (err, rows) => {
    if (err) return res.json([]); 
    res.json(rows || []);
  });
});

app.post("/chat/read", (req, res) => {
  const { plate } = req.body;
  db.run("UPDATE messages SET is_read = 1 WHERE plate = ? AND sender = 'customer'", [plate.toUpperCase()], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// 🔥 KRİTİK DEĞİŞİKLİK BURASI: Render portu otomatik atar, 3000'de ısrar edersek çalışmaz.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Mahsun Usta Server ${PORT} portunda yayında!`);
});
