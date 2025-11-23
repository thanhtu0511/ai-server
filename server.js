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
function getCategoryAndBreedFromLabels(labels) {
  // Danh sách nhãn chung cho từng category
  const categoryLabels = {
    Dog: ["Dog", "Dog breed", "Canidae", "Puppy", "Mammal"],
    Cat: ["Cat", "Feline", "Mammal"],
    Fish: ["Fish", "Aquatic"],
    Bird: ["Bird", "Avian"]
  };

  let category = "";
  let breed = "Unknown";

  // 1️⃣ Xác định Category
  for (const [cat, commons] of Object.entries(categoryLabels)) {
    if (labels.some(l => commons.includes(l.description))) {
      category = cat;
      break;
    }
  }

  // 2️⃣ Xác định Breed (nhãn chi tiết không phải nhãn chung)
  if (category) {
    const commonLabels = categoryLabels[category];
    const detailedLabels = labels
      .filter(l => !commonLabels.includes(l.description) && l.score > 0.7)
      .sort((a, b) => b.score - a.score); // ưu tiên score cao
    if (detailedLabels.length) breed = detailedLabels[0].description;
  }

  return { category, breed };
}

app.post("/classify-image", async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "Image URL is required" });

  try {
    const [result] = await visionClient.labelDetection(imageUrl);
    const labels = result.labelAnnotations || [];

    console.log("Labels returned from Vision API:", labels.map(l => ({ desc: l.description, score: l.score })));

    const { category, breed } = getCategoryAndBreedFromLabels(labels);

    console.log(`Detected Category: ${category}, Breed: ${breed}`);

    return res.json({ category, breed });

  } catch (error) {
    console.error("Vision API error:", error);
    res.status(500).json({ error: "Image classification failed" });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
