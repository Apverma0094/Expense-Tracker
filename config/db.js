const { MongoClient } = require("mongodb");

const uri = "mongodb://127.0.0.1:27017";

const client = new MongoClient(uri);

let db;

async function connectDB() {
  try {
    if (!db) {
      await client.connect();

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