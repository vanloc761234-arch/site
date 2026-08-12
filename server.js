const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Lấy mã tiếp theo chưa được cấp
app.post("/api/get-key", async (req, res) => {
  try {
    const { tool } = req.body;

    if (!tool) {
      return res.status(400).json({
        error: "Thiếu tên tool"
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT id, key_value
         FROM key_list
         WHERE tool = $1
         AND issued = FALSE
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [tool]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Đã hết mã"
        });
      }

      const key = result.rows[0];

      await client.query(
        `UPDATE key_list
         SET issued = TRUE,
             issued_at = NOW()
         WHERE id = $1`,
        [key.id]
      );

      await client.query("COMMIT");

      res.json({
        success: true,
        tool: tool,
        key: key.key_value
      });

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Lỗi server"
    });
  }
});

app.get("/", (req, res) => {
  res.send("Key server đang hoạt động!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server chạy tại port ${PORT}`);
});
