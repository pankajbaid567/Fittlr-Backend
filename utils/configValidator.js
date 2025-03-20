/**
 * Validates required configuration variables are set
 * Exits the application if critical configuration is missing
 */
const validateConfig = () => {
  const requiredVars = [
    { name: "DATABASE_URL", critical: true },
    { name: "GOOGLE_CLIENT_ID", critical: true },
    { name: "GOOGLE_CLIENT_SECRET", critical: true },
    { name: "JWT_SECRET", critical: true },
    { name: "SESSION_SECRET", critical: false },
    { name: "COOKIE_SECRET", critical: false },
  ];

  const missingCritical = [];
  const missingRecommended = [];

  requiredVars.forEach((variable) => {
    if (!process.env[variable.name]) {
      if (variable.critical) {
        missingCritical.push(variable.name);
      } else {
        missingRecommended.push(variable.name);
      }
    }
  });

  if (missingCritical.length > 0) {
    console.error("\n========== CRITICAL CONFIGURATION ERROR ==========");
    console.error("The following required environment variables are missing:");
    missingCritical.forEach((name) => console.error(`- ${name}`));
    console.error("\nPlease set these variables in your .env file.");
    console.error("See .env.example for a template.");
    console.error("=================================================\n");
    process.exit(1);
  }

  if (missingRecommended.length > 0) {
    console.warn("\n========== CONFIGURATION WARNING ==========");
    console.warn(
      "The following recommended environment variables are missing:"
    );
    missingRecommended.forEach((name) => console.warn(`- ${name}`));
    console.warn(
      "\nApplication will use default values, but it's recommended to set these for security."
    );
    console.warn("===========================================\n");
  }

  return true;
};

module.exports = validateConfig;
