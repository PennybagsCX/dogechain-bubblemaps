import React from "react";

/**
 * Highlight matching text in search results
 *
 * Highlights the portion of text that matches the search query with a colored background.
 * Useful for visual feedback in autocomplete dropdowns.
 *
 * @param text - The text to highlight (e.g., token symbol, name)
 * @param query - The search query to match against
 * @returns JSX element with highlighted matches wrapped in <mark> tags
 *
 * @example
 * highlightMatch("Dogecoin", "dog") // Returns: <mark>Dog</>ecoin
 * highlightMatch("USDC", "usd") // Returns: <mark>USD</>C
 */
export function highlightMatch(text: string, query: string): React.ReactElement {
  if (!text || !query) {
    return <>{text}</>;
  }

  // Escape special regex characters in the query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Create case-insensitive regex for the query
  const regex = new RegExp(`(${escapedQuery})`, "gi");

  // Split text by matches
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        // Check if this part matches the query (case-insensitive)
        const isMatch = regex.test(part);

        if (isMatch) {
          return (
            <mark key={index} className="bg-purple-500/30 text-white rounded px-0.5 font-semibold">
              {part}
            </mark>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

/**
 * Highlight multiple search terms in text
 *
 * Useful for highlighting all words in a multi-word search query.
 *
 * @param text - The text to highlight
 * @param queries - Array of search queries to highlight
 * @returns JSX element with all matches highlighted
 *
 * @example
 * highlightMultiple("Dogecoin USD Stablecoin", ["dog", "usd"])
 * // Returns: <mark>Dog</>ecoin <mark>USD</> Stablecoin
 */
export function highlightMultiple(text: string, queries: string[]): React.ReactElement {
  if (!text || !queries || queries.length === 0) {
    return <>{text}</>;
  }

  // Create a pattern that matches any of the queries
  const escapedQueries = queries.map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escapedQueries.join("|")})`, "gi");

  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = queries.some((q) => part.toLowerCase() === q.toLowerCase());

        if (isMatch) {
          return (
            <mark key={index} className="bg-purple-500/30 text-white rounded px-0.5 font-semibold">
              {part}
            </mark>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </>
  );
}
