import type {
  Account,
  ActivityEvent,
  AuthorizedWithdrawalOperation,
  Branch,
  CeftOperation,
  Client,
  Continent,
  Country,
  Currency,
  CurrencyBalance,
  CurrentUser,
  DepositOperation,
  ExternalTransferOperation,
  FundTransferOperation,
  LedgerEntry,
  OperationPricing,
  OperationRules,
  Role,
  Session,
  SystemInfo,
  SystemLog,
  TrendPoint,
  User,
  WithdrawalOperation,
} from "@/lib/api/types";
import { MODULE_ACTIONS, PERMISSION_MODULES } from "@/lib/permissions";

/**
 * Deterministic development fixtures. Only loaded when
 * NEXT_PUBLIC_API_MODE=fixtures; never bundled into a real deployment path.
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260804);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));

const DAY = 86_400_000;
const NOW = new Date("2026-08-04T10:00:00Z").getTime();
const isoAgo = (days: number, jitterMs = 0) =>
  new Date(NOW - days * DAY - jitterMs).toISOString();

const FIRST_NAMES_AR = [
  "أحمد", "فاطمة", "محمد", "عائشة", "علي", "مريم", "خالد", "زينب",
  "عمر", "هالة", "يوسف", "سلمى", "إبراهيم", "نور", "مصطفى", "ليلى",
];
const LAST_NAMES_AR = [
  "المصراتي", "الزنتاني", "البرعصي", "الشريف", "القذافي", "التاجوري",
  "الورفلي", "بن سعيد", "الفيتوري", "الدرسي",
];
/** Latin forms of the same names, index for index: a KYC record holds two
 *  spellings of one person, not two people. */
const FIRST_NAMES_EN = [
  "Ahmed", "Fatima", "Mohamed", "Aisha", "Ali", "Mariam", "Khaled", "Zeinab",
  "Omar", "Hala", "Youssef", "Salma", "Ibrahim", "Nour", "Mustafa", "Layla",
];
const LAST_NAMES_EN = [
  "Al-Misrati", "Al-Zintani", "Al-Barassi", "Al-Sharif", "Al-Gaddafi",
  "Al-Tajouri", "Al-Werfalli", "Bin Saeed", "Al-Fituri", "Al-Darsi",
];

/**
 * One person, spelled both ways — the indices are drawn once and read from both
 * catalogues, so the Latin name is the Arabic name transliterated rather than
 * an unrelated draw.
 *
 * `withLatin: false` leaves the Latin name absent, which is what a client
 * onboarded before the field looks like. The fixtures keep some of those so the
 * fallback path is exercised rather than assumed.
 */
const bilingualName = (withLatin: boolean) => {
  const first = Math.floor(rand() * FIRST_NAMES_AR.length);
  const last = Math.floor(rand() * LAST_NAMES_AR.length);
  return {
    name: `${FIRST_NAMES_AR[first]} ${LAST_NAMES_AR[last]}`,
    nameEn: withLatin ? `${FIRST_NAMES_EN[first]} ${LAST_NAMES_EN[last]}` : null,
  };
};

export const branches: Branch[] = [
  { id: "brn_main", name: "الفرع الرئيسي", city: "طرابلس", region: "طرابلس" },
  { id: "brn_bng", name: "فرع بنغازي", city: "بنغازي", region: "برقة" },
  { id: "brn_msr", name: "فرع مصراتة", city: "مصراتة", region: "طرابلس" },
];

const CURRENCY_SEEDS: [string, string, string, string | null, number][] = [
  ["LYD", "434", "الدينار الليبي", "LY", 3],
  ["USD", "840", "الدولار الأمريكي", "US", 2],
  ["EUR", "978", "اليورو", null, 2],
  ["GBP", "826", "الجنيه الإسترليني", "GB", 2],
  ["TND", "788", "الدينار التونسي", "TN", 3],
  ["EGP", "818", "الجنيه المصري", "EG", 2],
  ["TRY", "949", "الليرة التركية", "TR", 2],
  ["AED", "784", "الدرهم الإماراتي", "AE", 2],
  ["SAR", "682", "الريال السعودي", "SA", 2],
  ["XDR", "960", "حقوق السحب الخاصة", null, 2],
];

/** ~170 rows, matching the real master-data volume that needs virtualization. */
export const currencies: Currency[] = Array.from({ length: 170 }, (_, i) => {
  if (i < CURRENCY_SEEDS.length) {
    const [code, numeric, name, country, precision] = CURRENCY_SEEDS[i];
    return {
      id: `cur_${code}`,
      name,
      country,
      alphabeticCode: code,
      numericCode: numeric,
      precision,
    };
  }
  const code = `C${String(i).padStart(2, "0")}`;
  return {
    id: `cur_${code}`,
    name: `عملة ${i}`,
    country: i % 7 === 0 ? null : `X${i % 90}`,
    alphabeticCode: code,
    numericCode: String(100 + i),
    precision: 2,
  };
});

const ACTIVE_CURRENCIES = ["LYD", "USD", "EUR", "GBP", "TND"] as const;

/** Street and district names, so an address reads like one rather than a slug. */
const STREETS = [
  "شارع عمر المختار",
  "شارع الجمهورية",
  "شارع النصر",
  "شارع طرابلس",
  "شارع البحر",
  "شارع الصريم",
];
const DISTRICTS = [
  "حي الأندلس",
  "حي النوفليين",
  "باب بن غشير",
  "قرقارش",
  "الظهرة",
  "سيدي خليفة",
];

export const clients: Client[] = Array.from({ length: 46 }, (_, i) => ({
  id: `cli_${1000 + i}`,
  ...bilingualName(i % 5 !== 4),
  // Deliberately mixed raw formats — the shared formatter normalizes them.
  phone:
    i % 3 === 0
      ? `09${intBetween(10, 99)}${intBetween(1000000, 9999999)}`
      : i % 3 === 1
        ? `+2189${intBetween(10, 99)}${intBetween(100000, 999999)}`
        : `9${intBetween(10, 99)}${intBetween(100000, 999999)}`,
  email: i % 4 === 0 ? null : `client${i}@example.ly`,
  // Mostly Libyan, with a spread of the correspondent countries the branches
  // actually deal with — and every seventh record missing one, because a KYC
  // file with a blank field is the case the drawer has to render too.
  nationalityCode:
    i % 7 === 6 ? null : ["LY", "LY", "LY", "TN", "EG", "TR", "IT"][i % 7],
  // Indexed off `i`, not drawn from `rand()`. The generator is seeded and every
  // later fixture — account numbers, balances, operation amounts — comes out of
  // the same stream, so a draw added here would silently rewrite all of them.
  address:
    i % 6 === 5
      ? null
      : `${STREETS[i % STREETS.length]}، ${DISTRICTS[(i * 3) % DISTRICTS.length]}، ${
          branches[i % branches.length].city
        }`,
  accountsCount: intBetween(1, 3),
  createdAt: isoAgo(intBetween(30, 800)),
}));

/**
 * Libyan IBAN: `LY` + two check digits + 21 digits (bank, branch, account).
 * The check digits are computed rather than invented, so a revealed fixture
 * IBAN passes the same `isValidIban` the transfer forms use.
 */
function libyanIban(bank: number, branch: number, account: number): string {
  const body = `${String(bank).padStart(3, "0")}${String(branch).padStart(
    3,
    "0",
  )}${String(account).padStart(15, "0")}`;
  // ISO 13616: move the country code and placeholder to the end, L=21, Y=34.
  const rearranged = `${body}213400`;
  let remainder = 0;
  for (const digit of rearranged) remainder = (remainder * 10 + Number(digit)) % 97;
  return `LY${String(98 - remainder).padStart(2, "0")}${body}`;
}

export const accounts: Account[] = clients.flatMap((client, ci) =>
  Array.from({ length: client.accountsCount }, (_, ai) => {
    const branch = branches[(ci + ai) % branches.length];
    const currency = ACTIVE_CURRENCIES[(ci + ai) % ACTIVE_CURRENCIES.length];
    return {
      id: `acc_${ci}_${ai}`,
      number: String(100000 + ci * 10 + ai),
      // Every fifth account has none, so the "not available" path stays visible.
      iban:
        ci % 5 === 4
          ? null
          : libyanIban(2 + (ci % 7), 1 + ((ci + ai) % 40), 100000 + ci * 10 + ai),
      clientId: client.id,
      clientName: client.name,
      clientNameEn: client.nameEn,
      clientPhone: client.phone,
      type: pick(["current", "savings"]),
      currency,
      balance: Number(between(500, 250_000).toFixed(3)),
      branchId: branch.id,
      branchName: branch.name,
    } satisfies Account;
  }),
);

const operationalAccounts = accounts.slice(0, 30);

function baseOp(i: number, type: string) {
  const account = operationalAccounts[i % operationalAccounts.length];
  const branch = branches[i % branches.length];
  const withFee = i % 3 !== 0;
  const amount = Number(between(50, 40_000).toFixed(3));
  return {
    id: `op_${type}_${i}_${Math.floor(rand() * 1e9).toString(16)}`,
    reference: `${type.slice(0, 3).toUpperCase()}-${String(24000 + i)}`,
    clientId: account.clientId,
    clientName: account.clientName,
    clientNameEn: account.clientNameEn,
    clientPhone: account.clientPhone,
    accountId: account.id,
    accountNumber: account.number,
    accountIban: account.iban,
    amount,
    currency: account.currency,
    // Zero-fee operations carry `null`, so fee columns can be hidden entirely.
    fee: withFee
      ? {
          type: (i % 2 === 0 ? "fixed" : "percentage") as "fixed" | "percentage",
          value: i % 2 === 0 ? 5 : 0.5,
          amount: Number((i % 2 === 0 ? 5 : amount * 0.005).toFixed(3)),
          currency: account.currency,
        }
      : null,
    branchId: branch.id,
    branchName: branch.name,
    createdAt: isoAgo(intBetween(0, 29), intBetween(0, DAY)),
    createdBy: pick(["سالم العجيلي", "منى الفقيه", "رامي بن عثمان"]),
    notes: null,
  };
}

export const withdrawals: WithdrawalOperation[] = Array.from(
  { length: 64 },
  (_, i) => ({ ...baseOp(i, "withdrawal"), type: "withdrawal" as const }),
);

export const deposits: DepositOperation[] = Array.from(
  { length: 58 },
  (_, i) => ({ ...baseOp(i, "deposit"), type: "deposit" as const }),
);

const STATUS_CYCLE = ["reserve", "confirmed", "cancelled"] as const;

export const authorizedWithdrawals: AuthorizedWithdrawalOperation[] =
  Array.from({ length: 42 }, (_, i) => {
    const status = STATUS_CYCLE[i % 3];
    const base = baseOp(i, "authorized");
    return {
      ...base,
      type: "authorizedWithdrawal" as const,
      status,
      beneficiary: {
        name: `${pick(FIRST_NAMES_AR)} ${pick(LAST_NAMES_AR)}`,
        phone: `09${intBetween(10, 99)}${intBetween(1000000, 9999999)}`,
      },
      // Pending rows spread across the 24h window, some already past it.
      expiresAt:
        status === "reserve"
          ? new Date(NOW + (i % 5) * 5 * 3600_000 - 6 * 3600_000).toISOString()
          : null,
      cancelledReason: status === "cancelled" ? "طلب العميل الإلغاء" : null,
    };
  });

/** code, Arabic name, English name, dial digits (no `+`), continent. */
const COUNTRY_SEEDS: [string, string, string, string, Continent][] = [
  ["TN", "تونس", "Tunisia", "216", "africa"],
  ["EG", "مصر", "Egypt", "20", "africa"],
  ["TR", "تركيا", "Türkiye", "90", "asia"],
  ["GB", "المملكة المتحدة", "United Kingdom", "44", "europe"],
  ["AE", "الإمارات", "United Arab Emirates", "971", "asia"],
  ["DE", "ألمانيا", "Germany", "49", "europe"],
];

export const externalTransfers: ExternalTransferOperation[] = Array.from(
  { length: 38 },
  (_, i) => {
    const status = STATUS_CYCLE[i % 3];
    const [code, , ] = COUNTRY_SEEDS[i % COUNTRY_SEEDS.length];
    const base = baseOp(i, "external");
    return {
      ...base,
      type: "externalTransfer" as const,
      status,
      beneficiary: {
        name: `${pick(FIRST_NAMES_AR)} ${pick(LAST_NAMES_AR)}`,
        phone: `+2189${intBetween(10, 99)}${intBetween(100000, 999999)}`,
        countryCode: code,
        bankName: pick([
          "Banque de Tunisie",
          "National Bank of Egypt",
          "Ziraat Bankası",
          "Barclays",
          "Emirates NBD",
          "Deutsche Bank",
        ]),
        accountNumber: String(intBetween(10_000_000, 99_999_999)),
        iban: `${code}${intBetween(10, 99)}${String(intBetween(1000, 9999))}${String(intBetween(100000000, 999999999))}`,
      },
      expiresAt:
        status === "reserve"
          ? new Date(NOW + (i % 6) * 9 * 3600_000 - 8 * 3600_000).toISOString()
          : null,
      cancelledReason: status === "cancelled" ? "بيانات مستفيد غير صحيحة" : null,
    };
  },
);

export const fundTransfers: FundTransferOperation[] = Array.from(
  { length: 47 },
  (_, i) => {
    const base = baseOp(i, "transfer");
    const receiver = operationalAccounts[(i + 7) % operationalAccounts.length];
    return {
      ...base,
      type: "fundTransfer" as const,
      receiverAccountId: receiver.id,
      receiverAccountNumber: receiver.number,
      receiverClientName: receiver.clientName,
      receiverClientNameEn: receiver.clientNameEn,
      receiverClientPhone: receiver.clientPhone,
    };
  },
);

export const ceftOperations: CeftOperation[] = Array.from(
  { length: 33 },
  (_, i) => {
    const base = baseOp(i, "ceft");
    const receiver = operationalAccounts[(i + 11) % operationalAccounts.length];
    const rate =
      base.currency === receiver.currency ? 1 : Number(between(0.2, 5.2).toFixed(5));
    return {
      ...base,
      type: "currencyExchangeTransfer" as const,
      receiverAccountId: receiver.id,
      receiverAccountNumber: receiver.number,
      receiverClientName: receiver.clientName,
      receiverClientNameEn: receiver.clientNameEn,
      receiverClientPhone: receiver.clientPhone,
      sentAmount: base.amount,
      convertedAmount: Number((base.amount * rate).toFixed(3)),
      convertedCurrency: receiver.currency,
      exchangeRate: rate,
    };
  },
);

const LEDGER_EVENTS = [
  "fundDeposit",
  "fundWithdrawal",
  "authorizedFundWithdrawalReserve",
  "authorizedFundWithdrawalSettlement",
  "externalFundTransferReserve",
  "externalFundTransferSettlement",
  "fundTransfer",
  "currencyExchangeFundTransfer",
  "roundingIncome",
  "feeIncome",
] as const;

const LEDGER_TYPES = [
  "deposit",
  "withdrawal",
  "authorizedWithdrawal",
  "externalTransfer",
  "fundTransfer",
  "currencyExchangeTransfer",
] as const;

/** ~3,700 rows — the volume the All Operations ledger must virtualize. */
export const ledger: LedgerEntry[] = Array.from({ length: 3_712 }, (_, i) => {
  const account = accounts[i % accounts.length];
  const branch = branches[i % branches.length];
  return {
    id: `led_${i}`,
    reference: `LED-${String(100000 + i)}`,
    type: LEDGER_TYPES[i % LEDGER_TYPES.length],
    event: LEDGER_EVENTS[i % LEDGER_EVENTS.length],
    clientName: account.clientName,
    clientNameEn: account.clientNameEn,
    accountNumber: account.number,
    amount: Number(between(10, 60_000).toFixed(3)),
    currency: account.currency,
    feeAmount: i % 3 === 0 ? null : Number(between(1, 60).toFixed(3)),
    branchName: branch.name,
    createdAt: isoAgo(intBetween(0, 120), intBetween(0, DAY)),
  };
});

export const activity: ActivityEvent[] = Array.from({ length: 20 }, (_, i) => ({
  id: `act_${i}`,
  event: LEDGER_EVENTS[i % LEDGER_EVENTS.length],
  description: `${LEDGER_EVENTS[i % LEDGER_EVENTS.length]} — ${accounts[i % accounts.length].number}`,
  actor: pick(["سالم العجيلي", "منى الفقيه", "رامي بن عثمان"]),
  createdAt: isoAgo(0, i * 37 * 60_000),
}));

export const systemLogs: SystemLog[] = Array.from({ length: 120 }, (_, i) => ({
  id: `log_${i}`,
  level: (["info", "info", "warning", "error"] as const)[i % 4],
  tags: [pick(["sms", "auth", "ledger", "cbl", "export"]), pick(["system", "user"])],
  title: pick([
    "تم إرسال رسالة نصية",
    "محاولة تسجيل دخول فاشلة",
    "تم ترحيل قيد محاسبي",
    "فشل الاتصال بمصرف ليبيا المركزي",
    "تم تصدير تقرير",
  ]),
  message: `event=${LEDGER_EVENTS[i % LEDGER_EVENTS.length]} ref=LED-${100000 + i} status=ok`,
  // Every entry has a timestamp, including SMS events (blank in the old UI).
  createdAt: isoAgo(intBetween(0, 20), intBetween(0, DAY)),
}));

export const pricing: OperationPricing[] = [
  { id: "pr_1", operation: "deposit", hasFee: false, feeType: null, feeValue: null, currency: null },
  { id: "pr_2", operation: "withdrawal", hasFee: true, feeType: "fixed", feeValue: 5, currency: "LYD" },
  { id: "pr_3", operation: "authorizedWithdrawal", hasFee: true, feeType: "fixed", feeValue: 10, currency: "LYD" },
  { id: "pr_4", operation: "externalTransfer", hasFee: true, feeType: "percentage", feeValue: 1.5, currency: null },
  { id: "pr_5", operation: "fundTransfer", hasFee: false, feeType: null, feeValue: null, currency: null },
  { id: "pr_6", operation: "currencyExchangeTransfer", hasFee: true, feeType: "percentage", feeValue: 0.75, currency: null },
];

export const operationRules: OperationRules = {
  authorizedWithdrawalExpiryHours: 24,
  externalTransferExpiryHours: 48,
};

const fullPermissions = Object.fromEntries(
  PERMISSION_MODULES.map((m) => [m, MODULE_ACTIONS[m]]),
);

export const roles: Role[] = [
  {
    id: "role_admin",
    name: "مدير النظام",
    description: "صلاحيات كاملة على جميع الوحدات",
    assignedUsers: 2,
    permissions: fullPermissions,
  },
  {
    id: "role_teller",
    name: "صرّاف",
    description: "تسجيل العمليات اليومية دون اعتماد",
    assignedUsers: 4,
    permissions: {
      dashboard: ["view"],
      clients: ["view"],
      accounts: ["view"],
      withdrawal: ["view", "create"],
      deposits: ["view", "create"],
      fundTransfer: ["view", "create"],
      ceft: ["view", "create"],
      authorizedWithdrawal: ["view", "create"],
      externalTransfer: ["view", "create"],
    },
  },
];

export const users: User[] = [
  {
    id: "usr_1",
    name: "سالم العجيلي",
    username: "salem",
    phone: "0912345678",
    userType: "systemAdmin",
    roleIds: ["role_admin"],
    roleNames: ["مدير النظام"],
    active: true,
    defaultBranchId: "brn_main",
    defaultBranchName: "الفرع الرئيسي",
    avatarUrl: null,
  },
  {
    id: "usr_2",
    name: "منى الفقيه",
    username: "mona",
    phone: "+218918765432",
    userType: "branchManager",
    roleIds: ["role_admin"],
    roleNames: ["مدير النظام"],
    active: true,
    defaultBranchId: "brn_bng",
    defaultBranchName: "فرع بنغازي",
    avatarUrl: null,
  },
  {
    id: "usr_3",
    name: "رامي بن عثمان",
    username: "rami",
    phone: "925556677",
    userType: "teller",
    roleIds: ["role_teller"],
    roleNames: ["صرّاف"],
    active: false,
    defaultBranchId: "brn_msr",
    defaultBranchName: "فرع مصراتة",
    avatarUrl: null,
  },
];

export const currentUser: CurrentUser = {
  ...users[0],
  permissions: fullPermissions,
};

export const sessions: Session[] = [
  { id: "ses_1", device: "Chrome — macOS", ip: "41.208.72.11", lastActiveAt: isoAgo(0), current: true },
  { id: "ses_2", device: "Safari — iPhone", ip: "41.208.72.44", lastActiveAt: isoAgo(2), current: false },
];

export const countries: Country[] = COUNTRY_SEEDS.map(
  ([code, name, nameEn, phone, continent]) => ({
    code,
    name,
    nameEn,
    phoneCode: phone,
    continent,
  }),
).concat([
  { code: "LY", name: "ليبيا", nameEn: "Libya", phoneCode: "218", continent: "africa" },
  { code: "MA", name: "المغرب", nameEn: "Morocco", phoneCode: "212", continent: "africa" },
  { code: "IT", name: "إيطاليا", nameEn: "Italy", phoneCode: "39", continent: "europe" },
  { code: "MT", name: "مالطا", nameEn: "Malta", phoneCode: "356", continent: "europe" },
  { code: "US", name: "الولايات المتحدة", nameEn: "United States", phoneCode: "1", continent: "northAmerica" },
  { code: "CA", name: "كندا", nameEn: "Canada", phoneCode: "1", continent: "northAmerica" },
  { code: "BR", name: "البرازيل", nameEn: "Brazil", phoneCode: "55", continent: "southAmerica" },
  { code: "AU", name: "أستراليا", nameEn: "Australia", phoneCode: "61", continent: "oceania" },
]);

export const systemInfo: SystemInfo = {
  companyName: "شركة صرّاف للصرافة",
  logoUrl: null,
  address: "شارع عمر المختار، طرابلس",
  countryCode: "LY",
  latitude: 32.8872,
  longitude: 13.1913,
  emails: ["info@saraf.ly", "support@saraf.ly"],
  phones: ["0213334455", "0912345678"],
};

/** 90 days — the widest window the Dashboard's range selector asks for. */
export const trends: TrendPoint[] = Array.from({ length: 90 }, (_, i) => ({
  date: new Date(NOW - (89 - i) * DAY).toISOString().slice(0, 10),
  deposits: Math.round(between(20_000, 180_000)),
  withdrawals: Math.round(between(15_000, 160_000)),
  exchange: Math.round(between(5_000, 90_000)),
}));

export const currencyBalances: CurrencyBalance[] = ACTIVE_CURRENCIES.map(
  (currency) => {
    const rows = accounts.filter((a) => a.currency === currency);
    return {
      currency,
      total: Number(rows.reduce((sum, a) => sum + a.balance, 0).toFixed(3)),
      accounts: rows.length,
    };
  },
);
