/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Database Reset Utility
 *
 * Run this in the browser console to clear and reset the IndexedDB
 * when you encounter schema errors or corruption.
 */

/* eslint-disable no-console */
export async function resetDatabaseFromConsole(): Promise<void> {
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
    return;
  }

  try {
    // Delete the database
    const { db } = await import("../services/db");
    await db.delete();

    // Clear error flag
    localStorage.removeItem("doge_db_error");

    // Reload the page
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch {
    // Error handled silently
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
