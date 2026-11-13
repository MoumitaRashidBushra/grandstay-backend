// GrandStay seed data (development only). Re-runnable: it wipes all tables first.
//   npx prisma db seed
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

//import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEV_PASSWORD = 'Password@123';
const DAY = 24 * 60 * 60 * 1000;

// Deterministic PRNG so every run produces the same data.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261105);
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const at = (d, hour) => new Date(d.getTime() + hour * 3600 * 1000);
const yymmdd = (d) =>
  `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

const CATEGORIES = [
  { name: 'Standard', nightlyPrice: 2500, capacity: 2, description: 'Comfortable room with a queen bed.', facilities: ['Wi-Fi', 'AC', 'TV', 'Breakfast'] },
  { name: 'Deluxe', nightlyPrice: 4000, capacity: 3, description: 'Spacious room with a city view.', facilities: ['Wi-Fi', 'AC', 'TV', 'Breakfast', 'Mini bar'] },
  { name: 'Suite', nightlyPrice: 7000, capacity: 4, description: 'Luxury suite with a separate living area.', facilities: ['Wi-Fi', 'AC', 'TV', 'Breakfast', 'Mini bar', 'Bathtub', 'Lounge access'] },
];

const CUSTOMERS = [
  'Rahim Uddin', 'Karim Hossain', 'Fatima Begum', 'Nusrat Jahan', 'Tanvir Ahmed',
  'Sadia Islam', 'Imran Khan', 'Mehzabin Chowdhury', 'Arif Rahman', 'Shirin Akter',
  'Hasan Mahmud', 'Farhana Yasmin', 'Rafiq Sarker', 'Tasnim Sultana', 'Jahid Hasan',
];

async function wipe() {
  await prisma.auditLog.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomCategory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.hotelSettings.deleteMany();
  // Restart id sequences so reseeding gives stable ids.
  for (const t of ['room_categories', 'rooms', 'users', 'bookings', 'payments', 'refunds', 'invoices', 'audit_logs']) {
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE "${t}_id_seq" RESTART WITH 1`);
  }
}

async function main() {
  await wipe();
  //const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const passwordHash = await argon2.hash(DEV_PASSWORD, {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,       // 2 iterations
  parallelism: 1,
});

  // Hotel settings (single row)
  await prisma.hotelSettings.create({
    data: {
      id: 1,
      name: 'GrandStay Hotel',
      address: '12 Gulshan Avenue, Dhaka 1212, Bangladesh',
      phone: '+8801700000000',
      email: 'info@grandstay.example',
    },
  });

  // Categories
  const categories = {};
  for (const c of CATEGORIES) categories[c.name] = await prisma.roomCategory.create({ data: c });

  // 50 rooms: floors 1-2 Standard, 3-4 Deluxe, 5 Suite (10 per floor)
  const rooms = [];
  for (let floor = 1; floor <= 5; floor++) {
    const category = floor <= 2 ? 'Standard' : floor <= 4 ? 'Deluxe' : 'Suite';
    for (let i = 1; i <= 10; i++) {
      const number = `${floor}${String(i).padStart(2, '0')}`;
      const data = { number, floor, categoryId: categories[category].id };
      if (number === '210') { data.status = 'MAINTENANCE'; data.statusNote = 'AC repair'; }
      if (number === '410') { data.status = 'RETIRED'; data.statusNote = 'Under renovation'; }
      const room = await prisma.room.create({ data });
      rooms.push({ ...room, category: categories[category] });
    }
  }

  // Staff
  const admin = await prisma.user.create({
    data: { fullName: 'System Admin', email: 'admin@grandstay.example', mobile: '01711000001', passwordHash, role: 'ADMIN' },
  });
  const receptionists = [];
  for (const [i, name] of ['Rubina Akter', 'Sohel Rana'].entries()) {
    receptionists.push(await prisma.user.create({
      data: { fullName: name, email: `reception${i + 1}@grandstay.example`, mobile: `0172200000${i + 1}`, passwordHash, role: 'RECEPTIONIST' },
    }));
  }

  // Customers
  const customers = [];
  for (const [i, name] of CUSTOMERS.entries()) {
    customers.push(await prisma.user.create({
      data: {
        fullName: name,
        email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
        mobile: `0183${String(1000000 + i * 7919).slice(-7)}`.padEnd(11, '0').slice(0, 11),
        passwordHash,
        role: 'CUSTOMER',
      },
    }));
  }

  // Bookings: for each bookable room, lay stays end to end from ~45 days ago to ~30 days ahead,
  // so no two active bookings on one room can overlap (the DB would reject them).
  let seq = 0;
  let invoiceSeq = 0;
  const counts = { CONFIRMED: 0, CHECKED_IN: 0, CHECKED_OUT: 0, CANCELLED: 0 };

  for (const room of rooms.filter((r) => r.status === 'AVAILABLE')) {
    let cursor = addDays(today, -45 + randInt(0, 10));
    while (cursor < addDays(today, 30)) {
      const nights = randInt(1, 5);
      const checkIn = cursor;
      const checkOut = addDays(checkIn, nights);
      cursor = addDays(checkOut, randInt(2, 12));

      const customer = pick(customers);
      const guests = randInt(1, room.category.capacity);
      const nightlyPrice = Number(room.category.nightlyPrice);
      const totalAmount = nightlyPrice * nights;

      const confirmedAt = new Date(Math.min(now.getTime(), at(checkIn, 10).getTime() - randInt(1, 14) * DAY));
      let status;
      if (rand() < 0.1) status = 'CANCELLED';
      else if (checkOut <= today) status = 'CHECKED_OUT';
      else if (checkIn <= today) status = 'CHECKED_IN';
      else status = 'CONFIRMED';
      counts[status]++;

      seq++;
      const reference = `GS-${yymmdd(confirmedAt)}-${seq.toString(36).toUpperCase().padStart(5, '0')}`;
      const staff = pick(receptionists);

      const data = {
        reference,
        customerId: customer.id,
        roomId: room.id,
        checkIn,
        checkOut,
        guests,
        leadGuestName: customer.fullName,
        leadGuestMobile: customer.mobile,
        nightlyPrice,
        totalAmount,
        status,
        confirmedAt,
        payment: { create: { amount: totalAmount, cardLast4: String(randInt(1000, 9999)), paidAt: confirmedAt } },
      };

      if (status === 'CANCELLED') {
        const cancelledAt = new Date(Math.min(now.getTime(), confirmedAt.getTime() + randInt(1, 3) * DAY));
        data.cancelledAt = cancelledAt;
        data.refund = { create: { amount: totalAmount, refundedAt: cancelledAt } };
      }
      if (status === 'CHECKED_IN' || status === 'CHECKED_OUT') {
        data.checkedInAt = at(checkIn, 14);
        data.checkedInById = staff.id;
      }
      if (status === 'CHECKED_OUT') {
        data.checkedOutAt = at(checkOut, 12);
        data.checkedOutById = staff.id;
        invoiceSeq++;
        data.invoice = {
          create: {
            number: `INV-${checkOut.getUTCFullYear()}-${String(invoiceSeq).padStart(6, '0')}`,
            totalAmount,
            paidAmount: totalAmount,
            issuedAt: at(checkOut, 12),
            issuedById: staff.id,
          },
        };
      }

      await prisma.booking.create({ data });
    }
  }

  console.log('Seed complete.');
  console.log(`  rooms: ${rooms.length}, users: 1 admin + ${receptionists.length} receptionists + ${customers.length} customers`);
  console.log(`  bookings: ${seq}`, counts);
  console.log(`  login password for every seeded user: ${DEV_PASSWORD}`);
  console.log(`  admin: ${admin.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
