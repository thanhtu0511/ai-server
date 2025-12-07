// server.js
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import vision from "@google-cloud/vision";
import fs from "fs";
import admin from "firebase-admin";
dotenv.config();

console.log("Vision key exists:", fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS));
console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS);

const app = express();
app.use(cors());
app.use(express.json());
// firebase admin
admin.initializeApp({
  credential: admin.credential.cert(process.env.FIREBASE_ADMIN_CREDENTIALS),
});

const db = admin.firestore();
app.post("/create-admin", async (req, res) => {
  try {
    const { uid, username, email, imageUrl, dateofbirth, role, createdBy } = req.body;

    await db.collection("Admin").doc(uid).set({
      uid,
      username,
      email,
      imageUrl,
      dateofbirth,
      role,
      createdBy
    });

    return res.json({ message: "Admin created!" });
  } catch (error) {
    console.error("Create admin error:", error);
    return res.status(500).json({ error: error.message });
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
    Dog: ["Dog", "Dog breed", "Canidae", "Puppy", "Mammal"],
    Cat: ["Cat", "Feline", "Mammal"],
    Fish: ["Fish", "Aquatic"],
    Bird: ["Bird", "Avian"]
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
