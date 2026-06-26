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

const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const CLIENT_ALLOWED_MODELS = new Set([DEFAULT_OPENAI_MODEL]);

function normalizeAllowedModel(value) {
  const model = typeof value === "string" ? value.trim() : "";
  return CLIENT_ALLOWED_MODELS.has(model) ? model : "";
}

const SERVER_OPENAI_MODEL = normalizeAllowedModel(process.env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
const CHAT_HISTORY_MAX_MESSAGE_CHARS = 12000;

function normalizeChatHistoryRole(value) {
  return value === "assistant" ? "assistant" : "user";
}

function normalizeChatHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const content = typeof entry.content === "string" ? entry.content.trim() : "";
  if (!content) return null;
  return {
    role: normalizeChatHistoryRole(entry.role),
    content: content.slice(0, CHAT_HISTORY_MAX_MESSAGE_CHARS)
  };
}

function normalizeChatHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeChatHistoryEntry).filter(Boolean);
}

app.get("/", (req, res) => {
  res.type("text/plain").send("theinternetisdead API online. The machine is regrettably breathing.");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: SERVER_OPENAI_MODEL
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, systemPrompt, model, history } = req.body ?? {};
    const normalizedHistory = normalizeChatHistory(history);

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing on the server."
      });
    }

    if ((!message || typeof message !== "string") && normalizedHistory.length === 0) {
      return res.status(400).json({
        error: "Missing message. Send JSON like: { \"message\": \"hello\" }"
      });
    }

    const selectedModel = normalizeAllowedModel(model) || SERVER_OPENAI_MODEL;

    const input = [
      {
        role: "system",
        content: `The active API model requested for this chat is ${selectedModel}. If asked what model you are, answer based on that active model value. Do not describe yourself as GPT-4 or GPT-4 architecture.`
      }
    ];

    if (systemPrompt && typeof systemPrompt === "string") {
      input.push({
        role: "system",
        content: systemPrompt.slice(0, 4000)
      });
    }

    if (normalizedHistory.length) {
      input.push(...normalizedHistory);
    } else {
      input.push({
        role: "user",
        content: message.slice(0, CHAT_HISTORY_MAX_MESSAGE_CHARS)
      });
    }

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
