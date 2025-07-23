const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const db = new sqlite3.Database("./recipe-system.db");

app.use(cors());
app.use(express.json());

app.post("/recipes/:id/reviews", (req, res) => {
  const recipe_id = req.params.id;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }

  const sql = `INSERT INTO reviews (recipe_id, rating, comment) VALUES (?, ?, ?)`;
  db.run(sql, [recipe_id, rating, comment || ""], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ id: this.lastID, recipe_id, rating, comment });
  });
});

app.get("/recipes/:id/reviews", (req, res) => {
  const recipe_id = req.params.id;
  const sql = `SELECT * FROM reviews WHERE recipe_id = ? ORDER BY created_at DESC`;
  db.all(sql, [recipe_id], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// recipes with average rating
app.get("/recipes", (req, res) => {
  let sql = `
      SELECT r.*, IFNULL(AVG(rv.rating),0) AS avg_rating, COUNT(rv.id) AS review_count
      FROM recipes r
      LEFT JOIN reviews rv ON r.id = rv.recipe_id
    `;
  const params = [];

  if (req.query.sort === "rating") {
    sql += " GROUP BY r.id ORDER BY avg_rating DESC";
  } else {
    sql += " GROUP BY r.id ORDER BY r.id DESC";
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

app.post("/addrecipe", (req, res) => {
  const { title, description, category_id } = req.body;

  if (!title || !description) {
    return res
      .status(400)
      .json({ error: "Title and description are required" });
  }

  const sql = `INSERT INTO recipes (title, description, category_id) VALUES (?, ?, ?)`;
  const params = [title, description, category_id || null];

  db.run(sql, params, function (err) {
    if (err) {
      console.error("Error inserting recipe:", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    res.status(201).json({ message: "Recipe added", id: this.lastID });
  });
});

app.delete("/deleterecipe/:id", (req, res) => {
  const id = req.params.id;

  db.run("DELETE FROM recipes WHERE id = ?", id, function (err) {
    if (err) {
      console.error("Error deleting recipe:", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    res.json({ message: "Recipe deleted", id });
  });
});

app.put("/editrecipe/:id", (req, res) => {
  const id = req.params.id;
  const { title, description, category_id, status } = req.body;

  if (!title || !description) {
    return res
      .status(400)
      .json({ error: "Title and description are required" });
  }

  const sql = `
      UPDATE recipes
      SET title = ?, description = ?, category_id = ?, status = ?
      WHERE id = ?
    `;
  const params = [title, description, category_id || null, status || null, id];

  db.run(sql, params, function (err) {
    if (err) {
      console.error("Error updating recipe:", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    res.json({ message: "Recipe updated", id });
  });
});

app.get("/api/search", (req, res) => {
  const q = req.query.q || "";
  const searchTerm = `%${q.toLowerCase()}%`;

  const sql = `
      SELECT recipes.*, categories.name AS category_name
      FROM recipes
      LEFT JOIN categories ON recipes.category_id = categories.id
      WHERE LOWER(recipes.title) LIKE ?
        OR LOWER(recipes.description) LIKE ?
        OR LOWER(categories.name) LIKE ?
    `;

  db.all(sql, [searchTerm, searchTerm, searchTerm], (err, rows) => {
    if (err) {
      console.error("Search query error:", err.message);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/suggest", async (req, res) => {
  const { ingredients } = req.body;

  if (!ingredients) {
    return res.status(400).json({ error: "Ingredients are required" });
  }

  try {
    const prompt = `I have these ingredients: ${ingredients}. Suggest a simple recipe I can cook using these.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    });

    res.json({ suggestion: completion.choices[0].message.content });
  } catch (error) {
    if (error.code === "insufficient_quota") {
      res
        .status(429)
        .json({ error: "OpenAI quota exceeded, please try later." });
    } else {
      console.error("OpenAI API error:", error);
      res.status(500).json({ error: "AI service error" });
    }
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
