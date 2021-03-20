const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const port = process.env.PORT || 8080;
const db = require("./server/db/database");
const cors = require("cors");
const deduplicate = require("./server/service/cartSvc");

app.use(express.static(path.join(__dirname, "build")));

app.use(cors());

app.get("/health", function (req, res) {
  return res.send("ok");
});

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// Get product info API
app.get("/product", function (req, res) {
  let sql = `UPDATE product SET obsoleted = True where type="B" and price>20;`;
  db.run(sql, function (err) {
    if (err) {
      return console.error(err.message);
    }
    console.log(`Row(s) updated: ${this.changes}`);
  });

  db.all("SELECT * FROM product where obsoleted is not True", (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(200).json({ data: rows });
  });
});

//Get membership info
app.get("/membership", function (req, res) {
  var grade = req.query.grade;
  let sql = `SELECT * FROM membership`;
  let data = [];
  if (grade === "DIAMOND" || grade === "GOLD" || grade === "SILVER") {
    data = [grade];
    sql = `SELECT * FROM membership where grade = ?`;
  }

  db.all(sql, data, (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(200).json({ data: rows });
  });
});

// Add product to cart API with query params productId
let SQL_get_all = `SELECT p.id,p.name,p.price,ct.number FROM cart_item ct INNER JOIN product p on ct.product_id = p.id`;

app.post("/cart", function (req, res) {
  if (typeof req.query.productId === "undefined") {
    res.status(400).json({ error: "Missing query param - productId" });
    return;
  }
  db.run(
    `INSERT INTO cart_item (product_id, number) VALUES (${req.query.productId}, 1) ON CONFLICT(product_id) DO UPDATE SET number = number + 1`,
    (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      db.all(SQL_get_all, (err, rows) => {
        res.status(201).json({ data: rows });
      });
    }
  );
});

// Get cart's product
app.get("/cart", function (req, res) {
  db.all(SQL_get_all, (err, rows) => {
    const result = deduplicate(rows);

    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(200).json({ data: result });
  });
});

//Delet cart's prodcut
app.delete("/cart", function (req, res) {
  db.run(`DELETE FROM cart_item`, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
  });

  db.all(SQL_get_all, (err, rows) => {
    res.status(201).json({ data: rows });
  });
});

app.listen(port, () => {
  console.log(`Start listening on port ${port}...`);
});

module.exports = { app };
