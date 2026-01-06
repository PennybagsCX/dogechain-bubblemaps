import { z } from "zod";

/**
 * Validation schemas for Dogechain BubbleMaps
 * Provides type-safe input validation and sanitization
 */

// Ethereum/Dogechain address validation (checksummed)
export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, {
    message: "Invalid address format. Must be a valid 0x-prefixed hexadecimal address.",
  })
  .transform((val) => val.toLowerCase().trim());

// Token/NFT name validation
export const tokenNameSchema = z
  .string()
  .min(1, "Token name is required")
  .max(100, "Token name too long")
  .transform((val) => val.trim())
  .transform((val) => {
    // Remove any HTML tags to prevent XSS
    return val.replace(/<[^>]*>/g, "");
  });

// Token symbol validation
export const tokenSymbolSchema = z
  .string()
  .min(1, "Token symbol is required")
  .max(20, "Token symbol too long")
  .transform((val) => val.trim().toUpperCase())
  .transform((val) => {
    // Remove any HTML tags to prevent XSS
    return val.replace(/<[^>]*>/g, "");
  });

// Search query validation
export const searchQuerySchema = z
  .string()
  .min(1, "Search query is required")
  .max(200, "Search query too long")
  .transform((val) => val.trim())
  .transform((val) => {
    // Remove any HTML tags to prevent XSS
    return val.replace(/<[^>]*>/g, "");
  });

// Wallet address input validation (user-provided)
export const walletAddressInputSchema = z
  .string()
  .min(1, "Wallet address is required")
  .max(42, "Invalid address length")
  .transform((val) => val.trim())
  .transform((val) => {
    // Remove any HTML tags to prevent XSS
    return val.replace(/<[^>]*>/g, "");
  })
  .refine((val) => /^0x[a-fA-F0-9]{40}$/.test(val), {
    message: "Invalid wallet address format",
  })
  .transform((val) => val.toLowerCase());

// Asset type validation
export const assetTypeSchema = z.enum(["TOKEN", "NFT"], {
  message: "Invalid asset type. Must be TOKEN or NFT.",
});

// Alert configuration validation
export const alertConfigSchema = z.object({
  walletAddress: addressSchema,
  threshold: z.number().min(0).max(1000000000, "Threshold out of range"),
  condition: z.enum(["above", "below"], {
    message: "Invalid condition. Must be above or below.",
  }),
  assetType: assetTypeSchema.optional().default("TOKEN"),
});

// Pagination parameters
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Combined search parameters validation
export const searchParamsSchema = z.object({
  query: searchQuerySchema,
  type: assetTypeSchema.optional().default("TOKEN"),
});

/**
 * Sanitize HTML content to prevent XSS attacks
 * This is a basic sanitizer - for production use DOMPurify
 */
export const sanitizeHTML = (html: string): string => {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

/**
 * Validate and sanitize token address
 */
export const validateTokenAddress = (address: string): string => {
  try {
    return addressSchema.parse(address);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message || "Invalid token address");
    }
    throw error;
  }
};

/**
 * Validate and sanitize wallet address
 */
export const validateWalletAddress = (address: string): string => {
  try {
    return walletAddressInputSchema.parse(address);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message || "Invalid wallet address");
    }
    throw error;
  }
};

/**
 * Validate and sanitize search query
 */
export const validateSearchQuery = (query: string): string => {
  try {
    return searchQuerySchema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message || "Invalid search query");
    }
    throw error;
  }
};

/**
 * Validate alert configuration
 */
export const validateAlertConfig = (config: unknown) => {
  try {
    return alertConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message || "Invalid alert configuration");
    }
    throw error;
  }
};
