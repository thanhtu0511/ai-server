// server.js
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import vision from "@google-cloud/vision";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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

app.post("/classify-image", async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "Image URL is required" });

  try {
    // Gọi Vision API
    const [result] = await visionClient.labelDetection(imageUrl);
    const labels = result.labelAnnotations?.map(l => l.description) || [];

    console.log("Labels returned from Vision API:", labels);

    // 1️⃣ Xác định Pet Category dựa trên nhãn chung
    let category = "";
    if (labels.some(l => ["Dog", "Dog breed", "Canidae", "Puppy"].includes(l))) {
      category = "Dog";
    } else if (labels.some(l => ["Cat", "Feline"].includes(l))) {
      category = "Cat";
    } else if (labels.some(l => ["Fish", "Aquatic"].includes(l))) {
      category = "Fish";
    } else if (labels.some(l => ["Bird", "Avian"].includes(l))) {
      category = "Bird";
    }

    // 2️⃣ Xác định Breed
    let breed = "Unknown";
    if (category === "Dog") {
      // Lấy nhãn nào không phải nhãn chung của Dog làm breed
      const dogLabels = labels.filter(l => !["Dog", "Dog breed", "Canidae", "Puppy"].includes(l));
      if (dogLabels.length) breed = dogLabels[0];
    } else if (category === "Cat") {
      const catLabels = labels.filter(l => !["Cat", "Feline"].includes(l));
      if (catLabels.length) breed = catLabels[0];
    }

    console.log(`Detected Category: ${category}, Breed: ${breed}`);

    // 3️⃣ Trả kết quả
    return res.json({
      category,
      breed
    });

  } catch (error) {
    console.error("Vision API error:", error);
    res.status(500).json({ error: "Image classification failed" });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
