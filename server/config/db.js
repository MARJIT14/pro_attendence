const mongoose = require('mongoose');

/**
 * Connect to MongoDB with retry logic.
 * Exits process if connection fails after retries.
 */
const connectDB = async () => {
  const MAX_RETRIES = 3;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        // Mongoose 8+ uses these defaults automatically
      });
      console.log(`✅ MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (err) {
      retries++;
      console.error(`❌ MongoDB connection attempt ${retries} failed:`, err.message);
      if (retries === MAX_RETRIES) {
        console.error('🚨 All retries exhausted. Exiting...');
        process.exit(1);
      }
      // Wait 3s before retrying
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
};

module.exports = connectDB;

