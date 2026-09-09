import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

/**
 * Password hashing with scrypt from Node's own crypto module.
 *
 * scrypt rather than a plain hash because it is deliberately slow and
 * memory-hard: a leaked `passwordHash` column should cost an attacker real
 * hardware per guess, not a GPU afternoon. Node ships it, so there is no native
 * build step to fail on the low-end machines this project is deployed from, and
 * no third-party dependency in the one code path where a supply-chain problem
 * would be catastrophic.
 *
 * The stored string carries its own parameters, so raising the cost later does
 * not invalidate existing hashes — an old hash still verifies against the
 * settings it was made with.
 *
 * Format: scrypt$N$r$p$keylen$salt_b64$hash_b64
 */
const PREFIX = "scrypt";

/** OWASP's minimum for scrypt at the time of writing: N=2^17, r=8, p=1. */
const PARAMS = { N: 131072, r: 8, p: 1, keylen: 64 } as const;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const salt = randomBytes(16);
  const derived = (await scrypt(password.normalize("NFKC"), salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    // Node's default limit is below what N=2^17 needs, and without this the
    // call fails at runtime rather than at review time.
    maxmem: 256 * 1024 * 1024,
  })) as Buffer;

  return [
    PREFIX,
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    PARAMS.keylen,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns false for every failure — wrong password, malformed hash, unknown
 * algorithm — and never throws, so a caller cannot accidentally distinguish
 * "no such user" from "bad hash" in a way that leaks which accounts exist.
 * Comparison is constant-time.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 7 || parts[0] !== PREFIX) return false;

  const [, rawN, rawR, rawP, rawKeylen, saltB64, hashB64] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  const keylen = Number(rawKeylen);

  if (![N, r, p, keylen].every((value) => Number.isInteger(value) && value > 0)) {
    return false;
  }

  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    if (expected.length !== keylen) return false;

    const derived = (await scrypt(password.normalize("NFKC"), salt, keylen, {
      N,
      r,
      p,
      maxmem: 256 * 1024 * 1024,
    })) as Buffer;

    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * A dummy verification, run when no user matched.
 *
 * Without it, a request for an address that does not exist returns in
 * microseconds while a real one takes the full scrypt cost, and that difference
 * alone tells an attacker which email addresses are registered.
 */
export async function equaliseTiming(password: string): Promise<void> {
  await verifyPassword(password, await DUMMY_HASH);
}

const DUMMY_HASH = hashPassword("not-a-real-password-placeholder").catch(
  () => null,
);
