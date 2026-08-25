import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

let sqlClient: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    sqlClient = postgres(url, { max: 10 });
    dbInstance = drizzle(sqlClient, { schema });
  }
  return dbInstance;
}

export function resetDbInstanceForTests(): void {
  dbInstance = null;
  sqlClient = null;
}
