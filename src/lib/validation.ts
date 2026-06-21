import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name erforderlich").max(80),
    email: z.string().trim().toLowerCase().email("Ungültige E-Mail"),
    password: z.string().min(10, "Mindestens 10 Zeichen"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirm"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail"),
  password: z.string().min(1, "Passwort erforderlich"),
});

export const totpSchema = z.object({
  code: z.string().trim().min(6, "6-stelligen Code eingeben"),
});

export const requestResetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(10, "Mindestens 10 Zeichen"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirm"],
  });

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Name erforderlich").max(80),
  broker: z.string().trim().max(80).optional().or(z.literal("")),
  baseCurrency: z.string().trim().length(3, "3-Buchstaben-Code").toUpperCase(),
});

// Hilfsfunktion: FormData → Record<string,string>
export function formObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") obj[k] = v;
  }
  return obj;
}
