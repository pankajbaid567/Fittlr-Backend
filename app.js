require("dotenv").config();
require("express-async-errors");

const express = require("express");
const app = express();
const prisma = require("./db/connect");
const { StatusCodes } = require("http-status-codes");

//Routers


// Security Packages
const helmet = require("helmet");
const cors = require("cors");
const xss = require("xss-clean");
const rateLimiter = require("express-rate-limit");

// CORS Configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: StatusCodes.OK,
};

// Middleware
app.set("trust proxy", 1);
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json());
app.use(helmet());
app.use(cors(corsOptions));
app.use(xss());


//Routes Middelware




const port = process.env.PORT || 7900;

const start = async () => {
  try {
    await prisma.$connect();
    app.listen(port, () =>
      console.log(`Server is listening on http://localhost:${port}`)
    );
  } catch (error) {
    console.error("Failed to start the server:", error);
    process.exit(StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

start();