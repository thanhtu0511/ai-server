// server.js
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import vision from "@google-cloud/vision";
import fs from "fs";
import admin from "firebase-admin";
import axios from "axios";

dotenv.config();

console.log("Vision key exists:", fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS));
console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS);

const app = express();
app.use(cors());
app.use(express.json());
const router = express.Router();
const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
app.use("/", router);

// Lấy danh sách user
router.get("/users", async (req, res) => {
  try {
    const results = await axios.get(
      "https://api.clerk.com/v1/users",
      {
        headers: { Authorization: `Bearer ${CLERK_SECRET}` }
      }
    );

    res.json(results.data);
  } catch (error) {
    console.log("Error fetching users:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// Xóa user
router.delete("/users/:id", async (req, res) => {
  try {
    console.log("Deleting user ID:", req.params.id);

    await axios.delete(
      `https://api.clerk.com/v1/users/${req.params.id}`,
      {
        headers: { Authorization: `Bearer ${CLERK_SECRET}` }
      }
    );

    console.log("Delete success:", req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.log("Error deleting user:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});
router.post("/users/:id/lock", async (req, res) => {
  try {
    const userId = req.params.id;

    await axios.patch(
      `https://api.clerk.com/v1/users/${userId}`,
      { locked: true },
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ message: "User locked successfully" });
  } catch (err) {
    console.log("Lock error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to lock user" });
  }
});

router.post("/users/:id/unlock", async (req, res) => {
  try {
    const userId = req.params.id;

    await axios.patch(
      `https://api.clerk.com/v1/users/${userId}`,
      { locked: false },
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ message: "User unlocked successfully" });
  } catch (err) {
    console.log("Unlock error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to unlock user" });
  }
});



// firebase admin
admin.initializeApp({
  credential: admin.credential.cert(process.env.FIREBASE_ADMIN_CREDENTIALS),
});

const firestore = admin.firestore();
// API tạo admin
app.post("/add-admin", async (req, res) => {
  try {
    const { username, email, password, imageUrl, dateOfBirth, role, createdBy } = req.body;

    if (!username || !email || !password || !imageUrl) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 1. Tạo user Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });

    // 2. Lưu vào Firestore
    await firestore.collection("Admin").doc(userRecord.uid).set({
      uid: userRecord.uid,
      username,
      email,
      imageUrl,
      dateofbirth: dateOfBirth,
      role,
      createdBy
    });

    res.json({ success: true, uid: userRecord.uid });
  } catch (err) {
    console.error("ADD ADMIN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// Tạo client GenAI
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
app.get("/", (req, res) => {
  res.json({ status: "Server is running" });
});

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });

  try {
    // Gọi Gemini AI
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash", // hoặc "gemini-2.0-flash" nếu bạn muốn
      contents: message,
    });

    // Lấy text từ response
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "Mình không hiểu, bạn thử nói lại nhé.";


    res.json({ text });
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "AI request failed" });
  }
});
// Tạo client Vision API từ Service Account

const visionClient = new vision.ImageAnnotatorClient();

// Chỉ lấy Category
function getCategoryFromLabels(labels) {
  const categoryLabels = {
    Dogs: ["Dog", "Dog breed", "Canidae", "Puppy", "Mammal"],
    Cats: ["Cat", "Feline", "Mammal"],
    Fish: ["Fish", "Aquatic"],
    Birds: ["Bird", "Avian"]
  };

  for (const [cat, commons] of Object.entries(categoryLabels)) {
    if (labels.some(l => commons.includes(l.description))) {
      return cat;
    }
  }

  return "Unknown"; // Nếu không xác định được
}

app.post("/classify-image", async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "Image URL is required" });

  try {
    const [result] = await visionClient.labelDetection(imageUrl);
    const labels = result.labelAnnotations || [];

    console.log("Labels returned from Vision API:", labels.map(l => ({ desc: l.description, score: l.score })));

    const category = getCategoryFromLabels(labels);

    if (category === "Unknown") {
      console.log(`Detected Category: Unknown`);
      return res.json({ category, message: "Cannot identify pet category" });
    }

    console.log(`Detected Category: ${category}`);
    return res.json({ category });

  } catch (error) {
    console.error("Vision API error:", error);
    res.status(500).json({ error: "Image classification failed" });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
