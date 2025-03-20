require("dotenv").config();
require("express-async-errors");

// Validate configuration
const validateConfig = require("./utils/configValidator");
validateConfig();

const express = require("express");
const app = express();
const prisma = require("./db/connect");
const { StatusCodes } = require("http-status-codes");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const passport = require("./services/passport.service");
const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");

// Setup cookie parser for signed cookies
app.use(cookieParser(process.env.COOKIE_SECRET || "fittlr-cookie-secret"));

// Session setup for Passport.js
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fittlr-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

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

// Routes
const googleAuth = require("./routes/googleAuth");
app.use("/api/v1/user/auth/google", googleAuth);

// Root route
app.get("/", (req, res) => {
  res.status(StatusCodes.OK).json({ msg: "Fittlr API - Welcome!" });
});

// Error handling middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 7900;

const maxRetries = 5;
const retryDelay = 2000; // 2 seconds

const connectWithRetry = async (retries = 0) => {
  try {
    await prisma.$connect();
    console.log("Connected to database successfully!");
    return true;
  } catch (error) {
    if (retries < maxRetries) {
      console.error(`Database connection attempt ${retries + 1} failed, retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return connectWithRetry(retries + 1);
    }
    throw error;
  }
};

const start = async () => {
  try {
    await connectWithRetry();
    app.listen(port, () =>
      console.log(`Server is listening on http://localhost:${port}`)
    );
  } catch (error) {
    console.error("Failed to start the server after multiple retries:", error);
    process.exit(StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

start();
