import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

const allowedOrigins = [
  "https://theinternetisdead.org",
  "https://www.theinternetisdead.org",
  "http://localhost:3000",
  "http://127.0.0.1:5500"
];

app.use(cors({
  origin(origin, callback) {
    // Allows curl/Postman/server-to-server requests with no Origin header.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  }
}));

app.use(express.json({ limit: "1mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const DEFAULT_OPENAI_MODEL = 'gpt-5.5-thinking';
const CLIENT_ALLOWED_MODELS = new Set([DEFAULT_OPENAI_MODEL]);

app.get("/", (req, res) => {
  res.type("text/plain").send("theinternetisdead API online. The machine is regrettably breathing.");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, systemPrompt, model } = req.body ?? {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing on the server."
      });
    }

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Missing message. Send JSON like: { \"message\": \"hello\" }"
      });
    }

    const requestedModel = typeof model === 'string' ? model.trim() : '';
    const selectedModel = process.env.OPENAI_MODEL ||
      (CLIENT_ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_OPENAI_MODEL);

    const input = [];

    if (systemPrompt && typeof systemPrompt === "string") {
      input.push({
        role: "system",
        content: systemPrompt.slice(0, 4000)
      });
    }

    input.push({
      role: "user",
      content: message.slice(0, 12000)
    });

    const response = await openai.responses.create({
      model: selectedModel,
      input
    });

    res.json({
      reply: response.output_text ?? "",
      model: selectedModel
    });
  } catch (err) {
    console.error("OpenAI request failed:", err);

    res.status(500).json({
      error: "OpenAI request failed.",
      detail: process.env.NODE_ENV === "production" ? undefined : String(err?.message || err)
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`theinternetisdead API listening on port ${port}`);
});
