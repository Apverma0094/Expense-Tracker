require("dotenv").config();
const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URI);
let db;

async function connectDB() {
  try {
    if (!db) {
      await client.connect();
       console.log("✅ MongoDB connected successfully.");
      db = client.db("expanceTracker");
    }

    return db;
  } catch (error) {
    console.error(
      "Database Connection Error:",
      error
    );

    throw error;
  }
}

module.exports = connectDB;