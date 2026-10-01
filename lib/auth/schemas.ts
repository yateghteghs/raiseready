import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));

const newPassword = z
  .string({ error: "Enter a password." })
  .min(PASSWORD_MIN_LENGTH, { error: `Use at least ${PASSWORD_MIN_LENGTH} characters.` })
  .max(72, { error: "Use at most 72 characters." });

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Enter your password." }).min(1, { error: "Enter your password." }),
});

export const registerSchema = z.object({
  full_name: z
    .string({ error: "Enter your name." })
    .trim()
    .min(2, { error: "Enter your name." })
    .max(100, { error: "Use at most 100 characters." }),
  email,
  password: newPassword,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirm_password: z.string({ error: "Confirm your new password." }),
  })
  .refine((v) => v.password === v.confirm_password, {
    error: "Passwords do not match.",
    path: ["confirm_password"],
  });
