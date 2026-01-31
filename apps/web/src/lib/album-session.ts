/**
 * Album Session Management
 *
 * Provides secure session-based authentication for password-protected albums.
 * Uses JWT tokens stored in HTTP-only cookies for stateless authentication.
 *
 * Security Features:
 * - Cryptographically secure JWT tokens
 * - HTTP-only cookie storage
 * - 24-hour token expiration
 * - Minimal payload to reduce token size
 */

import jwt from "jsonwebtoken";

/**
 * Album session payload structure
 */
export interface AlbumSessionPayload {
  albumId: string;
  albumSlug: string;
  iat: number; // issued at
  exp: number; // expires at
  type: "album-access";
}

/**
 * Album session data type alias for backward compatibility
 */
export type AlbumSessionData = AlbumSessionPayload;

/**
 * Get JWT secret from environment variable
 * Throws error if not configured in production
 */
function getJWTSecret(): string {
  const secret = process.env.ALBUM_SESSION_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ALBUM_SESSION_SECRET environment variable is required in production",
      );
    }
    // 开发环境：使用随机生成的密钥（每次重启会变化，更安全）
    // 注意：开发环境重启后现有 session 会失效，需要重新验证密码
    if (!global._devAlbumSessionSecret) {
      global._devAlbumSessionSecret = Array.from(
        { length: 32 },
        () =>
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[
            Math.floor(Math.random() * 62)
          ],
      ).join("");
      console.warn(
        "⚠️ ALBUM_SESSION_SECRET not set, using auto-generated development secret (sessions will invalidate on restart)",
      );
    }
    return global._devAlbumSessionSecret;
  }

  if (secret.length < 32) {
    throw new Error("ALBUM_SESSION_SECRET must be at least 32 characters long");
  }

  return secret;
}

// 声明全局变量类型
/* eslint-disable no-var */
declare global {
  // Using var for global variable declaration as required by TypeScript
  var _devAlbumSessionSecret: string | undefined;
}
/* eslint-enable no-var */

/**
 * Generate a secure session token for album access
 *
 * @param albumId - The album ID
 * @param albumSlug - The album slug
 * @param expiresInHours - Token expiration time in hours (default: 24)
 * @returns JWT token string
 */
export function generateAlbumSessionToken(
  albumId: string,
  albumSlug: string,
  expiresInHours: number = 24,
): string {
  const secret = getJWTSecret();

  const payload: Omit<AlbumSessionPayload, "iat" | "exp"> = {
    albumId,
    albumSlug,
    type: "album-access",
  };

  const token = jwt.sign(payload, secret, {
    expiresIn: `${expiresInHours}h`,
    algorithm: "HS256",
  });

  return token;
}
/**
 * Validate and decode an album session token
 *
 * @param token - JWT token string
 * @returns Decoded payload if valid, null if invalid or expired
 */
export function validateAlbumSessionToken(
  token: string,
): AlbumSessionPayload | null {
  try {
    const secret = getJWTSecret();

    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as AlbumSessionPayload;

    // Verify token type
    if (decoded.type !== "album-access") {
      console.warn("Invalid token type:", decoded.type);
      return null;
    }

    // Verify required fields
    if (!decoded.albumId || !decoded.albumSlug) {
      console.warn("Missing required fields in token payload");
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log("Token expired:", error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn("Invalid token:", error.message);
    } else {
      console.error("Token validation error:", error);
    }
    return null;
  }
}

/**
 * Cookie configuration for session tokens
 */
export const ALBUM_SESSION_COOKIE_NAME = "album-session";

export interface AlbumSessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  maxAge: number;
  path: string;
}

/**
 * Get secure cookie options for session tokens
 * Automatically adjusts for development vs production
 */
export function getSessionCookieOptions(): AlbumSessionCookieOptions {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true, // Prevent XSS access
    secure: isProduction, // HTTPS only in production
    sameSite: "lax", // CSRF protection while allowing normal navigation
    maxAge: 24 * 60 * 60, // 24 hours in seconds
    path: "/", // Available site-wide
  };
}
