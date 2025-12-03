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

  if (!imageUrl) {
    return res.status(400).json({ error: "Image URL is required" });
  }
  try {
    console.log("Using Vision API with image:", imageUrl);

    const [result] = await visionClient.labelDetection({
      image: {
        source: {
          imageUri: imageUrl
        }
      }
    });
    const labels = result.labelAnnotations || [];
    console.log("Labels:", labels.map(l => l.description));

    const category = getCategoryFromLabels(labels);

    if (category === "Unknown") {
      return res.json({
        category,
        message: "Cannot identify pet category"
      });
    }
    return res.json({ category });
  } catch (error) {
    console.error("Vision API error:", error);
    return res.status(500).json({
      error: "Image classification failed",
      details: error.message
    });
  }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
