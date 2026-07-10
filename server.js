require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function wrapHandler(fn) {
  return async (req, res) => {
    const event = {
      httpMethod: req.method,
      path: req.path,
      body: JSON.stringify(req.body),
      headers: req.headers,
      queryStringParameters: req.query,
    };

    try {
      const result = await fn(event, {});
      res.status(result.statusCode);

      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          res.set(key, value);
        }
      }

      if (result.body) {
        try {
          res.json(JSON.parse(result.body));
        } catch {
          res.send(result.body);
        }
      } else {
        res.end();
      }
    } catch (err) {
      console.error("Handler error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

const auth = require("./netlify/functions/auth").handler;
app.post("/api/auth/register", wrapHandler(auth));
app.post("/api/auth/login", wrapHandler(auth));
app.get("/api/auth/me", wrapHandler(auth));
app.post("/api/auth/logout", wrapHandler(auth));
app.post("/api/auth/recover", wrapHandler(auth));

const profiles = require("./netlify/functions/profiles").handler;
app.get("/api/profiles/:id", wrapHandler(profiles));
app.put("/api/profiles/:id", wrapHandler(profiles));

const products = require("./netlify/functions/products").handler;
app.get("/api/products/:id", wrapHandler(products));
app.get("/api/products", wrapHandler(products));

const reviews = require("./netlify/functions/reviews").handler;
app.post("/api/products/:productId/reviews", wrapHandler(reviews));
app.get("/api/products/:productId/reviews", wrapHandler(reviews));
app.put("/api/products/:productId/reviews", wrapHandler(reviews));
app.delete("/api/products/:productId/reviews", wrapHandler(reviews));

const diagnosis = require("./netlify/functions/diagnosis").handler;
app.post("/api/diagnosis", wrapHandler(diagnosis));
app.get("/api/diagnosis", wrapHandler(diagnosis));

const routines = require("./netlify/functions/routines").handler;
app.post("/api/routines/generate", wrapHandler(routines));
app.get("/api/routines", wrapHandler(routines));
app.get("/api/routines/:id", wrapHandler(routines));

const favorites = require("./netlify/functions/favorites").handler;
app.post("/api/favorites", wrapHandler(favorites));
app.get("/api/favorites", wrapHandler(favorites));
app.delete("/api/favorites/:productId", wrapHandler(favorites));

const cart = require("./netlify/functions/cart").handler;
app.post("/api/cart", wrapHandler(cart));
app.get("/api/cart", wrapHandler(cart));
app.put("/api/cart/:productId", wrapHandler(cart));
app.delete("/api/cart/:productId", wrapHandler(cart));

const orders = require("./netlify/functions/orders").handler;
app.post("/api/orders", wrapHandler(orders));
app.get("/api/orders", wrapHandler(orders));
app.get("/api/orders/:id", wrapHandler(orders));

const diary = require("./netlify/functions/diary").handler;
app.post("/api/diary", wrapHandler(diary));
app.get("/api/diary", wrapHandler(diary));
app.get("/api/diary/:date", wrapHandler(diary));
app.delete("/api/diary/:date", wrapHandler(diary));

const dermatologists = require("./netlify/functions/dermatologists").handler;
app.get("/api/dermatologists", wrapHandler(dermatologists));
app.get("/api/dermatologists/:id", wrapHandler(dermatologists));

const consultas = require("./netlify/functions/consultas").handler;
app.post("/api/consultas", wrapHandler(consultas));
app.get("/api/consultas", wrapHandler(consultas));
app.get("/api/consultas/:id", wrapHandler(consultas));

const community = require("./netlify/functions/community").handler;
app.post("/api/community-routines", wrapHandler(community));
app.get("/api/community-routines", wrapHandler(community));
app.get("/api/community-routines/:id", wrapHandler(community));
app.delete("/api/community-routines/:id", wrapHandler(community));

// Admin routes
const adminDashboard = require("./netlify/functions/admin-dashboard").handler;
app.get("/api/admin/dashboard", wrapHandler(adminDashboard));

const adminProducts = require("./netlify/functions/admin-products").handler;
app.post("/api/admin/products", wrapHandler(adminProducts));
app.put("/api/admin/products/:id", wrapHandler(adminProducts));
app.delete("/api/admin/products/:id", wrapHandler(adminProducts));

const adminUsers = require("./netlify/functions/admin-users").handler;
app.get("/api/admin/users", wrapHandler(adminUsers));
app.put("/api/admin/users/:id", wrapHandler(adminUsers));

const adminConsultas = require("./netlify/functions/admin-consultas").handler;
app.get("/api/admin/consultas", wrapHandler(adminConsultas));
app.put("/api/admin/consultas/:id", wrapHandler(adminConsultas));

const adminOrders = require("./netlify/functions/admin-orders").handler;
app.get("/api/admin/orders", wrapHandler(adminOrders));
app.put("/api/admin/orders/:id", wrapHandler(adminOrders));

const adminReviews = require("./netlify/functions/admin-reviews").handler;
app.put("/api/admin/reviews/:id", wrapHandler(adminReviews));
app.get("/api/admin/reviews/reported", wrapHandler(adminReviews));

const quizRecommendations = require("./netlify/functions/quiz-recommendations").handler;
app.get("/api/quiz-recommendations", wrapHandler(quizRecommendations));

const adminQuizRec = require("./netlify/functions/admin-quiz-recommendations").handler;
app.get("/api/admin/quiz-recommendations", wrapHandler(adminQuizRec));
app.post("/api/admin/quiz-recommendations", wrapHandler(adminQuizRec));
app.put("/api/admin/quiz-recommendations/:id", wrapHandler(adminQuizRec));
app.delete("/api/admin/quiz-recommendations/:id", wrapHandler(adminQuizRec));

const functionHandlers = {
  hello: require("./netlify/functions/hello").handler,
  user: require("./netlify/functions/user").handler,
  contact: require("./netlify/functions/contact").handler,
  payment: require("./netlify/functions/payment").handler,
};

app.all("/api/:funcName", async (req, res) => {
  const { funcName } = req.params;
  const handler = functionHandlers[funcName];

  if (!handler) {
    return res.status(404).json({ error: `Function '${funcName}' not found` });
  }

  const netlifyEvent = {
    httpMethod: req.method,
    path: `/.netlify/functions/${funcName}`,
    body: JSON.stringify(req.body),
    headers: req.headers,
    queryStringParameters: req.query,
  };

  const netlifyContext = {};

  try {
    const result = await handler(netlifyEvent, netlifyContext);
    res.status(result.statusCode);

    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.set(key, value);
      }
    }

    if (result.body) {
      try {
        const parsed = JSON.parse(result.body);
        res.json(parsed);
      } catch {
        res.send(result.body);
      }
    } else {
      res.end();
    }
  } catch (err) {
    console.error(`Error in /api/${funcName}:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
