const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log("Trying to connect...");
    console.log(process.env.MONGO_URI);

    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected");
    console.log(conn.connection.host);
  } catch (error) {
    console.error("DB Error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;