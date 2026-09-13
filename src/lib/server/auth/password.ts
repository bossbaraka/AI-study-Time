/**
 * Password hashing — Node-native scrypt (no third-party crypto).
 *
 * Storage format: `s2$<N>$<salt-hex>$<hash-base64url>` so parameters can
 * be raised later without breaking existing hashes (verify reads them
 * from the stored value). Comparison is constant-time.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(
    Buffer.from(password.normalize("NFKC"), "utf8"),
    salt,
    SCRYPT.keylen,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 },
  );
  return `s2$${SCRYPT.N}$${salt.toString("hex")}$${Buffer.from(derived).toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "s2") return false;
  const [, nStr, saltHex, hashB64] = parts;
  const N = Number(nStr);
  if (!Number.isFinite(N) || N <= 0) return false;
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(hashB64 ?? "", "base64url");
    actual = scryptSync(Buffer.from(password.normalize("NFKC"), "utf8"), Buffer.from(saltHex ?? "", "hex"), expected.length, {
      N,
      r: SCRYPT.r,
      p: SCRYPT.p,
      maxmem: 64 * 1024 * 1024,
    });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * A real hash compared against when the email is unknown, so response
 * time does not reveal whether an account exists.
 */
export const TIMING_DEFENDER_HASH = hashPassword("mureeh-timing-defender");
