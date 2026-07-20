/**
 * Shén Zhèn Airdrop — Database Seed Script
 *
 * Seeds:
 * 1. Default upgrades (tap power, max energy, energy regen)
 * 2. First admin user (from env vars)
 *
 * Run: pnpm db:seed
 * Idempotent — safe to run multiple times (uses upsert).
 */

import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Hash password with bcrypt — matches the admin panel's bcrypt.compare().
 */
function hashPassword(password: string): string {
  return hashSync(password, 10);
}

async function seedUpgrades(): Promise<void> {
  console.log("🔧 Seeding upgrades...");

  const upgrades = [
    {
      slug: "tap_power",
      name: "Tap Power",
      description: "Increase points earned per tap",
      type: "tap_power",
      baseCost: 100,
      costMultiplier: 1.5,
      baseEffect: 1, // +1 tap power per level
      maxLevel: 20,
      iconEmoji: "💪",
      sortOrder: 1,
    },
    {
      slug: "max_energy",
      name: "Energy Capacity",
      description: "Increase maximum energy storage",
      type: "max_energy",
      baseCost: 150,
      costMultiplier: 1.4,
      baseEffect: 200, // +200 max energy per level
      maxLevel: 15,
      iconEmoji: "🔋",
      sortOrder: 2,
    },
    {
      slug: "energy_regen",
      name: "Energy Recharge",
      description: "Faster energy regeneration",
      type: "energy_regen",
      baseCost: 200,
      costMultiplier: 1.6,
      baseEffect: 0.5, // +0.5 energy/sec per level
      maxLevel: 10,
      iconEmoji: "⚡",
      sortOrder: 3,
    },
  ];

  for (const upgrade of upgrades) {
    await prisma.upgrade.upsert({
      where: { slug: upgrade.slug },
      update: upgrade,
      create: upgrade,
    });
    console.log(`  ✅ ${upgrade.name} (${upgrade.slug})`);
  }
}

async function seedAdminUser(): Promise<void> {
  console.log("👤 Seeding admin user...");

  const username = process.env["ADMIN_USERNAME"] ?? "admin";
  const password = process.env["ADMIN_PASSWORD"] ?? "changeme123";

  const passwordHash = hashPassword(password);

  await prisma.adminUser.upsert({
    where: { username },
    update: {}, // don't overwrite existing admin
    create: {
      username,
      passwordHash,
      role: "admin",
    },
  });

  console.log(`  ✅ Admin user '${username}' ready`);
  console.log(`  ⚠️  Change the default password after first login!`);
}

async function main(): Promise<void> {
  console.log("🌱 Seeding Shén Zhèn Airdrop database...\n");

  await seedUpgrades();
  console.log();
  await seedAdminUser();

  console.log("\n✨ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
