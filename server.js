// server.js
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

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
app.post("/classify-image", async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "Image URL is required" });

  try {
    const prompt = `
Nhìn vào hình ảnh này: ${imageUrl}.
Phân loại con vật này thành một trong các category: "Dogs", "Cats", "Fish", "Birds".
Trả về duy nhất 1 JSON với 2 key:
- "category": giá trị là "Dogs", "Cats", "Fish" hoặc "Birds"
- "breed": tên giống loài nếu biết, hoặc "" nếu không biết
Ví dụ output đúng:
{ "category": "Dogs", "breed": "Poodle" }
Chỉ trả JSON, không thêm lời giải thích.
`;

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';

    let categoryJson = {};
    try {
      categoryJson = JSON.parse(text); // { category: "Dogs", breed: "Poodle" }
    } catch (e) {
      console.error("JSON parse failed:", text);
      categoryJson = { category: "", breed: "" };
    }

    res.json(categoryJson);

  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "AI classification failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
