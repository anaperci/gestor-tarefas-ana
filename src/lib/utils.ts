import crypto from "crypto";

export function genId(): string {
  return crypto.randomBytes(4).toString("hex");
}
