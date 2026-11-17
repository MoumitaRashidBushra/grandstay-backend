import bcrypt from "bcryptjs";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({
  where: { email: "admin@grandstay.example" },
  select: { passwordHash: true },
});
const hash = user.passwordHash;
console.log("prefix", hash.slice(0, 7), "len", hash.length);
const bcryptOk = await bcrypt.compare("Password@123", hash);
console.log("bcrypt Password@123", bcryptOk);
try {
  const argonOk = await argon2.verify(hash, "Password@123");
  console.log("argon2 verify returned", argonOk);
} catch (error) {
  console.log("argon2 verify threw", error.message);
}
await prisma.$disconnect();
