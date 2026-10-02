import bcrypt from "bcrypt";
import { getPrisma } from "../src/prisma.js";

// Local development only. Override with SEED_INITIAL_PASSWORD.
// This value is documented in the README and is never a real secret.
const INITIAL_PASSWORD =
  process.env.SEED_INITIAL_PASSWORD ?? "ChangeMe123";

// Placeholder written by the Lab 3 migration for users that existed in Lab 2.
const PLACEHOLDER_HASH = "!";

type Role = "REQUESTER" | "IT_STAFF" | "ADMIN";

interface SeedUser {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  // "ready" accounts skip the forced first-login password change so that
  // tests and demos can log in directly.
  ready: boolean;
}

const users: SeedUser[] = [
  { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", role: "REQUESTER", isActive: true, ready: true },
  { name: "Michael Brown", email: "michael.brown@example.com", role: "REQUESTER", isActive: true, ready: false },
  { name: "Sarah Johnson", email: "sarah.johnson@example.com", role: "REQUESTER", isActive: true, ready: false },
  { name: "David Lee", email: "david.lee@example.com", role: "REQUESTER", isActive: true, ready: false },
  { name: "Alex Ford", email: "alex.ford@example.com", role: "REQUESTER", isActive: false, ready: false },
  { name: "Priya Nair", email: "priya.nair@example.com", role: "IT_STAFF", isActive: true, ready: true },
  { name: "Marcus Chen", email: "marcus.chen@example.com", role: "IT_STAFF", isActive: true, ready: false },
  { name: "Elena Rossi", email: "elena.rossi@example.com", role: "IT_STAFF", isActive: true, ready: true },
  { name: "Tom Baker", email: "tom.baker@example.com", role: "IT_STAFF", isActive: false, ready: false },
  { name: "Admin User", email: "admin@example.com", role: "ADMIN", isActive: true, ready: true },
];

type Priority = "LOW" | "MEDIUM" | "HIGH";
type Status =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

interface SeedTicket {
  number: string;
  requester: string;
  category: string;
  system: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority;
  status: Status;
  owner: string | null;
  comment?: [author: string, text: string];
  note?: [author: string, text: string];
}

// Fixed numbers (TKT-2026-9000NN) cannot collide with generated numbers,
// which are based on the ticket id.
const tickets: SeedTicket[] = [
  { number: "TKT-2026-900001", requester: "jennifer.anderson@example.com", category: "Network", system: "Campus Wi-Fi", summary: "Wi-Fi drops in the library", description: "The campus Wi-Fi disconnects every few minutes on the second floor.", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "NEW", owner: null },
  { number: "TKT-2026-900002", requester: "jennifer.anderson@example.com", category: "Hardware", system: "Printer", summary: "Printer shows paper jam", description: "The office printer reports a paper jam but no paper is stuck.", requestedPriority: "LOW", itPriority: "LOW", status: "OPEN", owner: "priya.nair@example.com", comment: ["priya.nair@example.com", "Please try turning the printer off and on again."], note: ["priya.nair@example.com", "Sensor may need cleaning if it happens again."] },
  { number: "TKT-2026-900003", requester: "michael.brown@example.com", category: "Account and Access", system: "Email", summary: "Cannot sign in to email", description: "My email password is rejected since this morning.", requestedPriority: "HIGH", itPriority: "HIGH", status: "IN_PROGRESS", owner: "marcus.chen@example.com", note: ["marcus.chen@example.com", "Account was locked by the mail server; unlocked."] },
  { number: "TKT-2026-900004", requester: "michael.brown@example.com", category: "Software", system: "LEB2 App", summary: "LEB2 app crashes on open", description: "The LEB2 app closes itself right after the splash screen.", requestedPriority: "MEDIUM", itPriority: "HIGH", status: "WAITING_FOR_REQUESTER", owner: "elena.rossi@example.com", comment: ["elena.rossi@example.com", "Which version of the app are you using?"] },
  { number: "TKT-2026-900005", requester: "sarah.johnson@example.com", category: "Network", system: "VPN", summary: "VPN connection times out", description: "The VPN client times out when connecting from home.", requestedPriority: "HIGH", itPriority: "HIGH", status: "OPEN", owner: null },
  { number: "TKT-2026-900006", requester: "sarah.johnson@example.com", category: "Hardware", system: "Corporate Laptop", summary: "Laptop battery drains quickly", description: "The battery loses charge within 90 minutes of light use.", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "RESOLVED", owner: "priya.nair@example.com", comment: ["priya.nair@example.com", "The battery was replaced. Please confirm it works."] },
  { number: "TKT-2026-900007", requester: "david.lee@example.com", category: "Software", system: "Grade Submission App", summary: "Grade upload fails", description: "Uploading the grade file shows an unknown error.", requestedPriority: "HIGH", itPriority: "MEDIUM", status: "IN_PROGRESS", owner: "elena.rossi@example.com", note: ["elena.rossi@example.com", "File format looks fine; checking server logs."] },
  { number: "TKT-2026-900008", requester: "david.lee@example.com", category: "Account and Access", system: "Email", summary: "Need shared mailbox access", description: "Please add me to the department shared mailbox.", requestedPriority: "LOW", itPriority: "LOW", status: "CLOSED", owner: "marcus.chen@example.com" },
  { number: "TKT-2026-900009", requester: "jennifer.anderson@example.com", category: "Software", system: "Email", summary: "Email calendar not syncing", description: "Calendar events do not appear on my phone.", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "REOPENED", owner: "priya.nair@example.com" },
  { number: "TKT-2026-900010", requester: "michael.brown@example.com", category: "Hardware", system: "Printer", summary: "Order a new printer toner", description: "The toner is almost empty and needs replacing.", requestedPriority: "LOW", itPriority: "LOW", status: "CANCELLED", owner: null },
  { number: "TKT-2026-900011", requester: "sarah.johnson@example.com", category: "Network", system: "Campus Wi-Fi", summary: "No Wi-Fi in room B204", description: "There is no Wi-Fi signal at all in room B204.", requestedPriority: "HIGH", itPriority: "HIGH", status: "NEW", owner: null },
  { number: "TKT-2026-900012", requester: "david.lee@example.com", category: "Account and Access", system: "VPN", summary: "VPN account expired", description: "My VPN account says it has expired.", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "OPEN", owner: "marcus.chen@example.com" },
];

async function seedUsers() {
  const prisma = getPrisma();
  const initialHash = await bcrypt.hash(INITIAL_PASSWORD, 12);

  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          passwordHash: initialHash,
          mustChangePassword: !user.ready,
        },
      });
      continue;
    }

    // Existing accounts keep their password. Only users migrated from
    // Lab 2 (placeholder hash) receive the documented initial password.
    await prisma.user.update({
      where: { email: user.email },
      data:
        existing.passwordHash === PLACEHOLDER_HASH
          ? {
              name: user.name,
              role: user.role,
              isActive: user.isActive,
              passwordHash: initialHash,
              mustChangePassword: !user.ready,
            }
          : {
              name: user.name,
              role: user.role,
              isActive: user.isActive,
            },
    });
  }

  // Any other migrated Lab 2 user still has the placeholder hash.
  await prisma.user.updateMany({
    where: { passwordHash: PLACEHOLDER_HASH },
    data: {
      passwordHash: initialHash,
      mustChangePassword: true,
    },
  });
}

async function seedTickets() {
  const prisma = getPrisma();

  const userIds = new Map(
    (await prisma.user.findMany()).map((u) => [u.email, u.id])
  );
  const categoryIds = new Map(
    (await prisma.category.findMany()).map((c) => [c.name, c.id])
  );
  const systemIds = new Map(
    (await prisma.relatedSystem.findMany()).map((s) => [s.name, s.id])
  );

  for (const t of tickets) {
    const existing = await prisma.ticket.findUnique({
      where: { ticketNumber: t.number },
    });

    if (existing) continue;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: t.number,
        requesterId: userIds.get(t.requester)!,
        categoryId: categoryIds.get(t.category)!,
        relatedSystemId: systemIds.get(t.system)!,
        summary: t.summary,
        description: t.description,
        requestedPriority: t.requestedPriority,
        itPriority: t.itPriority,
        currentStatus: t.status,
        ownerId: t.owner ? userIds.get(t.owner)! : null,
      },
    });

    if (t.comment) {
      await prisma.ticketComment.create({
        data: {
          ticketId: ticket.id,
          authorId: userIds.get(t.comment[0])!,
          body: t.comment[1],
        },
      });
    }

    if (t.note) {
      await prisma.ticketInternalNote.create({
        data: {
          ticketId: ticket.id,
          authorId: userIds.get(t.note[0])!,
          body: t.note[1],
        },
      });
    }
  }
}

async function main() {
  const prisma = getPrisma();

  const categories = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const relatedSystems = [
    "Email",
    "Campus Wi-Fi",
    "VPN",
    "LEB2 App",
    "Grade Submission App",
    "Printer",
    "Corporate Laptop",
  ];

  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: {
        name,
        isActive: true,
      },
    });
  }

  await seedUsers();
  await seedTickets();

  console.log(
    "Seeded TokTickIT categories, related systems, users, tickets, comments, and notes."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
