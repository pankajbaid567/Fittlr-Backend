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
const passport = require("./services/passport"); // Fixed import path
const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");
const authenticate = require("./middleware/authentication");

app.use(cookieParser(process.env.COOKIE_SECRET || "fittlr-cookie-secret"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fittlr-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
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
const googleFitRoutere = require("./routes/googlefit");
const profile = require("./routes/profile");
const ticket = require("./routes/ticket");
const booking = require("./routes/booking");
const fallback = require("./routes/fallback");

const postRoutes = require("./routes/community/postRoutes");
const commentRoutes = require("./routes/community/commentRoutes");
const likeRoutes = require("./routes/community/likeRoutes");
const challengeRoutes = require("./routes/challengeRoutes");
const followRoutes = require("./routes/community/followRoutes");

app.use("/api/v1/user/auth/google/fit", authenticate, googleFitRoutere);
app.use("/api/v1/user/profile", authenticate, profile);
// app.use("/api/v1/user/ticket", authenticate, ticket);
app.use("/api/v1/user/ticket", ticket);
app.use("/api/v1/user/auth/fallback", fallback);
app.use("/api/v1/user/booking", booking);

app.use("/api/v1/user/auth/google", googleAuth);

app.use("/api/v1/user/community/posts", postRoutes);
app.use("/api/v1/user/community/comments", commentRoutes);
app.use("/api/v1/user/community/likes", likeRoutes);
app.use("/api/v1/user/challenges", challengeRoutes);
app.use("/api/v1/user/users", followRoutes);

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
      console.error(
        `Database connection attempt ${
          retries + 1
        } failed, retrying in ${retryDelay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
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
