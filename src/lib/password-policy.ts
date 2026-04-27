import { z } from "zod";

const MIN_LEN = 8;
const MAX_LEN = 128;

export const passwordSchema = z
  .string()
  .min(MIN_LEN, `Senha deve ter ao menos ${MIN_LEN} caracteres`)
  .max(MAX_LEN, `Senha não pode exceder ${MAX_LEN} caracteres`)
  .refine((p) => /[A-Z]/.test(p), "Senha deve ter ao menos 1 letra maiúscula")
  .refine((p) => /[a-z]/.test(p), "Senha deve ter ao menos 1 letra minúscula")
  .refine((p) => /[0-9]/.test(p), "Senha deve ter ao menos 1 dígito");
