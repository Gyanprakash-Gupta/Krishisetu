const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Middleware (10MB limit to support Produce Image Base64 uploads)
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initial Seed Data
const initialData = {
  users: [],
  products: [
    {
      id: 1,
      name: "Organic Red Tomatoes",
      category: "vegetables",
      farmer: "Suresh Rao (Ayodhya)",
      farmerId: "KS-100201",
      farmerEarns: 22,
      consumerPrice: 28,
      mandiPrice: 42,
      qty: 250,
      unit: "kg",
      paymentMethods: ["UPI (GPay/PhonePe)", "Cash on Delivery"],
      img: "https://images.unsplash.com/photo-1546470427-0d4db154ceb7?w=400&q=80"
    },
    {
      id: 2,
      name: "Red Onions",
      category: "vegetables",
      farmer: "Anand Shinde (Maharajganj)",
      farmerId: "KS-100202",
      farmerEarns: 20,
      consumerPrice: 26,
      mandiPrice: 38,
      qty: 400,
      unit: "kg",
      paymentMethods: ["UPI (GPay/PhonePe)", "Bank / NEFT"],
      img: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&q=80"
    },
    {
      id: 3,
      name: "Fresh Oranges",
      category: "fruits",
      farmer: "Gurpreet Singh (Basti)",
      farmerId: "KS-100203",
      farmerEarns: 35,
      consumerPrice: 48,
      mandiPrice: 75,
      qty: 180,
      unit: "kg",
      paymentMethods: ["UPI (GPay/PhonePe)", "Bank / NEFT", "Cash on Delivery"],
      img: "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=400&q=80"
    },
    {
      id: 4,
      name: "Sharbati Wheat",
      category: "grains",
      farmer: "Babulal Meena (Gorakhpur)",
      farmerId: "KS-100204",
      farmerEarns: 32,
      consumerPrice: 40,
      mandiPrice: 58,
      qty: 600,
      unit: "kg",
      paymentMethods: ["UPI (GPay/PhonePe)", "Bank / NEFT"],
      img: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80"
    }
  ],
  orders: [],
  harvests: [],
  feedbacks: []
};

// Helper: Read & Write Database
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ==================== REST API ROUTES ====================

// 1. GET all Marketplace Products
app.get('/api/products', (req, res) => {
  const db = readDB();
  res.json(db.products);
});

// 2. POST New Harvest Listing (Sell Harvest with Image & Payment Methods)
app.post('/api/products', (req, res) => {
  const { name, category, farmer, farmerId, phone, farmerPrice, qty, paymentMethods, payoutDetails, img } = req.body;

  if (!name || !farmer || !farmerPrice || !qty) {
    return res.status(400).json({ error: "Missing required harvest fields." });
  }

  const db = readDB();
  const numericPrice = parseFloat(farmerPrice);
  const numericQty = parseInt(qty, 10);

  const newProduct = {
    id: Date.now(),
    name,
    category: category || "vegetables",
    farmer,
    farmerId: farmerId || "GUEST",
    phone: phone || "",
    farmerEarns: numericPrice,
    consumerPrice: Math.round(numericPrice * 1.22), // +22% direct logistics & platform
    mandiPrice: Math.round(numericPrice * 1.70),    // Traditional Mandi benchmark
    qty: numericQty,
    unit: "kg",
    paymentMethods: Array.isArray(paymentMethods) && paymentMethods.length ? paymentMethods : ["UPI (GPay/PhonePe)"],
    payoutDetails: payoutDetails || "",
    img: img || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80",
    createdAt: new Date().toLocaleString()
  };

  db.products.unshift(newProduct);

  const harvestRecord = {
    id: newProduct.id,
    userId: farmerId || "GUEST",
    crop: name,
    qty: numericQty,
    price: numericPrice,
    methods: newProduct.paymentMethods.join(', '),
    date: newProduct.createdAt
  };
  db.harvests.unshift(harvestRecord);

  writeDB(db);
  res.status(201).json({ message: "Harvest published successfully!", product: newProduct, harvest: harvestRecord });
});

// 3. POST User Registration (Generates Unique KS-ID & Simulates SMS/Email Dispatch)
app.post('/api/auth/register', (req, res) => {
  const { role, name, phone, email, deliveryChannel, password } = req.body;

  if (!name || !phone || !email || !password) {
    return res.status(400).json({ error: "All registration fields are required." });
  }

  const db = readDB();
  const existing = db.users.find(
    u => u.email.toLowerCase() === email.toLowerCase() || u.phone === phone
  );

  if (existing) {
    return res.status(409).json({ error: "User with this Phone or Email already exists. Please login." });
  }

  const generatedId = "KS-" + Math.floor(100000 + Math.random() * 900000);

  const newUser = {
    id: generatedId,
    role: role || "Consumer",
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
    deliveryChannel: deliveryChannel || "Both Phone SMS & Email",
    password,
    defaultPayMode: "UPI (GPay / PhonePe / Paytm)",
    upi: `${phone.trim()}@upi`,
    bank: "",
    createdAt: new Date().toLocaleString()
  };

  db.users.push(newUser);
  writeDB(db);

  console.log(`[SMS/EMAIL DISPATCH] Sent User ID ${generatedId} to ${phone} & ${email} via ${deliveryChannel}`);

  const { password: _, ...safeUser } = newUser;
  res.status(201).json({
    message: `Registration successful! ID ${generatedId} dispatched via ${deliveryChannel}.`,
    user: safeUser
  });
});

// 4. POST User Login (Supports KS-ID, Email, or Phone)
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: "Identifier and password are required." });
  }

  const db = readDB();
  const cleanId = identifier.trim().toLowerCase();

  const found = db.users.find(
    u =>
      (u.id.toLowerCase() === cleanId ||
        u.email.toLowerCase() === cleanId ||
        u.phone === cleanId) &&
      u.password === password
  );

  if (!found) {
    return res.status(401).json({ error: "Invalid User ID / Email / Phone or Password." });
  }

  const { password: _, ...safeUser } = found;
  res.json({ message: "Login successful!", user: safeUser });
});

// 5. PUT Update User Payment Preferences
app.put('/api/users/:id/payment', (req, res) => {
  const { id } = req.params;
  const { defaultPayMode, upi, bank } = req.body;

  const db = readDB();
  const userIndex = db.users.findIndex(u => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  db.users[userIndex].defaultPayMode = defaultPayMode || db.users[userIndex].defaultPayMode;
  db.users[userIndex].upi = upi !== undefined ? upi : db.users[userIndex].upi;
  db.users[userIndex].bank = bank !== undefined ? bank : db.users[userIndex].bank;

  writeDB(db);
  const { password: _, ...safeUser } = db.users[userIndex];
  res.json({ message: "Payment preferences updated!", user: safeUser });
});

// 6. POST Place Direct Consumer Order
app.post('/api/orders', (req, res) => {
  const { userId, items, total, farmerPayout, paymentMethod } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: "Cart cannot be empty." });
  }

  const db = readDB();
  const orderId = "ORD-" + Math.floor(10000 + Math.random() * 90000);

  // Deduct stock quantities
  items.forEach(cartItem => {
    const prod = db.products.find(p => p.id === cartItem.id);
    if (prod && prod.qty >= cartItem.qty) {
      prod.qty -= cartItem.qty;
    }
  });

  const newOrder = {
    orderId,
    userId: userId || "GUEST",
    items: items.map(i => `${i.name} (${i.qty}kg)`).join(', '),
    total,
    farmerPayout,
    paymentMethod: paymentMethod || "UPI (GPay/PhonePe)",
    date: new Date().toLocaleString()
  };

  db.orders.unshift(newOrder);
  writeDB(db);

  res.status(201).json({ message: "Order confirmed!", order: newOrder, updatedProducts: db.products });
});

// 7. GET User History (Orders & Harvests)
app.get('/api/history', (req, res) => {
  const { userId } = req.query;
  const db = readDB();

  if (userId) {
    const userOrders = db.orders.filter(o => o.userId === userId || o.userId === "GUEST");
    const userHarvests = db.harvests.filter(h => h.userId === userId || h.userId === "GUEST");
    return res.json({ orders: userOrders, harvests: userHarvests });
  }

  res.json({ orders: db.orders, harvests: db.harvests });
});

// 8. POST Contact Us / Developer Feedback
app.post('/api/contact', (req, res) => {
  const { name, contact, category, rating, message } = req.body;

  if (!name || !contact || !message) {
    return res.status(400).json({ error: "Name, contact info, and message are required." });
  }

  const db = readDB();
  const ticketId = "DEV-" + Math.floor(1000 + Math.random() * 9000);

  const feedbackEntry = {
    ticketId,
    name,
    contact,
    category: category || "Platform Feedback",
    rating: rating || "5",
    message,
    developerReply: `Hi ${name}, thank you for contacting the KrishiSetu Developer Team regarding "${category}". Your ticket #${ticketId} is logged and confirmation has been sent to ${contact}. Our team will follow up within 2 hours.`,
    createdAt: new Date().toLocaleString()
  };

  db.feedbacks.unshift(feedbackEntry);
  writeDB(db);

  res.status(201).json({
    message: "Feedback received by developer!",
    ticket: feedbackEntry
  });
});

app.listen(PORT, () => {
  console.log(`✅ KrishiSetu Backend Server running at http://localhost:${PORT}`);
});