import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const connectionString = new URL(process.env.DATABASE_URL);
connectionString.searchParams.set("allowPublicKeyRetrieval", "true");

const adapter = new PrismaMariaDb(connectionString.toString());

export const prisma = new PrismaClient({ adapter });