/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Database Reset Utility
 *
 * Run this in the browser console to clear and reset the IndexedDB
 * when you encounter schema errors or corruption.
 */

/* eslint-disable no-console */
export async function resetDatabaseFromConsole(): Promise<void> {
  console.log("=== Database Reset ===");
  console.log("This will delete all local data and recreate the database.");

  const confirmed = confirm(
    "⚠️ WARNING: This will delete all cached data including:\n" +
      "- Alert configurations\n" +
      "- Wallet scan cache\n" +
      "- Discovered contracts\n" +
      "- LP pairs database\n\n" +
      "The page will reload after reset.\n\n" +
      "Continue?"
  );

  if (!confirmed) {
    console.log("Reset cancelled.");
    return;
  }

  try {
    // Delete the database
    const { db } = await import("../services/db");
    await db.delete();

    console.log("✅ Database deleted successfully");

    // Clear error flag
    localStorage.removeItem("doge_db_error");

    console.log("🔄 Reloading page...");

    // Reload the page
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    console.error("❌ Reset failed:", error);
    console.log("Please manually clear IndexedDB:");
    console.log("1. Open DevTools (F12)");
    console.log("2. Go to Application tab");
    console.log("3. Expand IndexedDB");
    console.log("4. Right-click 'DogechainBubbleMapsDB'");
    console.log("5. Select 'Delete database'");
  }
}

// Make available globally
if (typeof window !== "undefined") {
  (window as any).resetDatabase = resetDatabaseFromConsole;
  console.log(
    "🔧 Database reset utility loaded. Run resetDatabase() to clear and reset the database."
  );
}

// Export as both named and default export
export { resetDatabaseFromConsole as resetDatabase };
export default resetDatabaseFromConsole;
