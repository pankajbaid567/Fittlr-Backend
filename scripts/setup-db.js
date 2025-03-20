const { execSync } = require("child_process");
const path = require("path");

/**
 * Script to set up the database tables using Prisma
 */
async function setupDatabase() {
  try {
    console.log("🔄 Setting up database...");

    // Run Prisma migration to create tables
    console.log("📊 Creating database tables...");
    execSync("npx prisma migrate dev --name init", {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });

    console.log("✅ Database setup complete!");
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    process.exit(1);
  }
}

setupDatabase();
