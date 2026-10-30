import { z } from "zod";

const envSchema = z.object({
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  DATABASE_URL: z.string().url(),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  OWNER_EMAIL: z.string().email(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

type EnvInfo = z.infer<typeof envSchema>;

let parsedEnv: EnvInfo;

if (process.env.SKIP_ENV_VALIDATION === "1") {
  parsedEnv = process.env as unknown as EnvInfo;
} else {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  parsedEnv = parsed.data;
}

export const env = parsedEnv;
