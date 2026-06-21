import { hash, verify } from "@node-rs/argon2";

// Argon2id mit soliden Default-Parametern.
const opts = {
  memoryCost: 19456, // ~19 MB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, opts);
}

export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain);
  } catch {
    return false;
  }
}
