/**
 * Domain types for the admin panel.
 *
 * These mirror the shapes this UI consumes. The backend already exists but its
 * OpenAPI contract was not available in this repo — every type below is the
 * single place to reconcile once it is. Nothing outside `src/lib/api` should
 * define API shapes.
 */

export type Id = string;

/**
 * One page of a server-side result set. `total` counts every matching record,
 * not the length of `items` — the pager and the record count both read it, so a
 * truncated response can never masquerade as a complete one.
 */
export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type SortDirection = "asc" | "desc";

/** `null` means "server default order". */
export type SortState = { key: string; direction: SortDirection } | null;

/** Wire format for the `sort` query parameter: `createdAt:desc`. */
export function serializeSort(sort: SortState): string | undefined {
  return sort ? `${sort.key}:${sort.direction}` : undefined;
}

export function parseSort(value: unknown): SortState {
  if (typeof value !== "string" || !value) return null;
  const [key, direction] = value.split(":");
  if (!key) return null;
  return { key, direction: direction === "asc" ? "asc" : "desc" };
}

export type Money = {
  amount: number;
  currency: string;
};

export type OperationStatus =
  | "reserve"
  | "confirmed"
  | "cancelled"
  | "expired"
  | "pending"
  | "completed"
  | "failed";

export type OperationType =
  | "deposit"
  | "withdrawal"
  | "authorizedWithdrawal"
  | "externalTransfer"
  | "fundTransfer"
  | "currencyExchangeTransfer";

export type FeeType = "fixed" | "percentage";

export type Fee = {
  type: FeeType;
  value: number;
  amount: number;
  currency: string;
};

export type Branch = {
  id: Id;
  name: string;
  city: string;
  region: string;
};

export type Currency = {
  id: Id;
  name: string;
  country: string | null;
  alphabeticCode: string;
  numericCode: string;
  precision: number;
};

export type Client = {
  id: Id;
  name: string;
  phone: string;
  email: string | null;
  accountsCount: number;
  createdAt: string;
};

export type Account = {
  id: Id;
  number: string;
  /**
   * Nullable: older accounts predate IBAN assignment, and a backend that does
   * not publish the field at all leaves it absent. Every surface renders it
   * masked with an explicit reveal, exactly like a beneficiary IBAN.
   */
  iban: string | null;
  clientId: Id;
  clientName: string;
  clientPhone: string;
  type: string;
  currency: string;
  balance: number;
  branchId: Id;
  branchName: string;
};

export type Beneficiary = {
  name: string;
  phone: string | null;
};

export type ExternalBeneficiary = Beneficiary & {
  countryCode: string;
  bankName: string;
  accountNumber: string;
  iban: string;
};

/** Base shape shared by every money-movement list row. */
export type OperationBase = {
  id: Id;
  reference: string;
  type: OperationType;
  clientId: Id;
  clientName: string;
  clientPhone: string;
  accountId: Id;
  accountNumber: string;
  /** IBAN of the debited/credited account — see `Account.iban`. */
  accountIban: string | null;
  amount: number;
  currency: string;
  fee: Fee | null;
  branchId: Id;
  branchName: string;
  createdAt: string;
  createdBy: string;
  notes: string | null;
};

export type WithdrawalOperation = OperationBase & { type: "withdrawal" };
export type DepositOperation = OperationBase & { type: "deposit" };

export type AuthorizedWithdrawalOperation = OperationBase & {
  type: "authorizedWithdrawal";
  status: OperationStatus;
  beneficiary: Beneficiary;
  expiresAt: string | null;
  cancelledReason: string | null;
};

export type ExternalTransferOperation = OperationBase & {
  type: "externalTransfer";
  status: OperationStatus;
  beneficiary: ExternalBeneficiary;
  expiresAt: string | null;
  cancelledReason: string | null;
};

export type FundTransferOperation = OperationBase & {
  type: "fundTransfer";
  receiverAccountId: Id;
  receiverAccountNumber: string;
  receiverClientName: string;
  receiverClientPhone: string;
};

export type CeftOperation = OperationBase & {
  type: "currencyExchangeTransfer";
  receiverAccountId: Id;
  receiverAccountNumber: string;
  receiverClientName: string;
  receiverClientPhone: string;
  /** Amount debited from the sender, in `currency`. */
  sentAmount: number;
  /** Amount credited to the receiver, in `convertedCurrency`. */
  convertedAmount: number;
  convertedCurrency: string;
  exchangeRate: number;
};

export type AnyOperation =
  | WithdrawalOperation
  | DepositOperation
  | AuthorizedWithdrawalOperation
  | ExternalTransferOperation
  | FundTransferOperation
  | CeftOperation;

export type LedgerEntry = {
  id: Id;
  reference: string;
  type: OperationType;
  event: string;
  clientName: string;
  accountNumber: string;
  amount: number;
  currency: string;
  feeAmount: number | null;
  branchName: string;
  createdAt: string;
};

export type ActivityEvent = {
  id: Id;
  event: string;
  description: string;
  actor: string;
  createdAt: string;
};

export type LogLevel = "info" | "warning" | "error";

export type SystemLog = {
  id: Id;
  level: LogLevel;
  tags: string[];
  title: string;
  message: string;
  createdAt: string;
};

export type OperationPricing = {
  id: Id;
  operation: OperationType;
  hasFee: boolean;
  feeType: FeeType | null;
  feeValue: number | null;
  currency: string | null;
};

export type OperationRules = {
  authorizedWithdrawalExpiryHours: number;
  externalTransferExpiryHours: number;
};

export type PermissionAction = "view" | "create" | "approve" | "delete";

export type Role = {
  id: Id;
  name: string;
  description: string;
  assignedUsers: number;
  permissions: Record<string, PermissionAction[]>;
};

export type User = {
  id: Id;
  name: string;
  username: string;
  phone: string;
  userType: string;
  roleIds: Id[];
  roleNames: string[];
  active: boolean;
  defaultBranchId: Id;
  defaultBranchName: string;
  avatarUrl: string | null;
};

export type CurrentUser = User & {
  permissions: Record<string, PermissionAction[]>;
};

/** Grouping axis for the country register (§6 of the Round 2 requests). */
export const CONTINENTS = [
  "africa",
  "asia",
  "europe",
  "northAmerica",
  "southAmerica",
  "oceania",
  "antarctica",
] as const;

export type Continent = (typeof CONTINENTS)[number];

export type Country = {
  code: string;
  /** Arabic name — what the UI shows first. */
  name: string;
  /** English name, kept as its own field so both can be shown side by side. */
  nameEn: string;
  /**
   * Dial code digits only, no leading `+`. The `+` is presentation and is added
   * once at render; storing it produced the `++216` double prefix.
   */
  phoneCode: string | null;
  continent: Continent;
};

export type SystemInfo = {
  companyName: string;
  logoUrl: string | null;
  address: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  emails: string[];
  phones: string[];
};

export type DashboardSummary = {
  totalClients: number;
  totalAccounts: number;
  todayOperations: number;
  pendingAuthorizedWithdrawals: number;
  pendingExternalTransfers: number;
};

export type TrendPoint = {
  date: string;
  deposits: number;
  withdrawals: number;
  exchange: number;
};

export type CurrencyBalance = {
  currency: string;
  total: number;
  accounts: number;
};

export type BranchFlow = {
  branchId: Id;
  branchName: string;
  operations: number;
  deposits: number;
  withdrawals: number;
  netFlow: number;
};

export type ReportSnapshot = {
  date: string;
  branches: BranchFlow[];
  totals: BranchFlow;
  /** Operation count per currency on this date — the day's currency mix. */
  currencyMix: { currency: string; operations: number }[];
  /**
   * The seven days ending on this date, for context around the snapshot. Not a
   * rolling trend: the Dashboard owns that (§7 item 3).
   */
  trailing: { date: string; netFlow: number }[];
};

export type Session = {
  id: Id;
  device: string;
  ip: string;
  lastActiveAt: string;
  current: boolean;
};

export type CblConnectionStatus = {
  state: "connected" | "disconnected" | "degraded";
  endpointReachable: boolean;
  authenticated: boolean;
  baseUrl: string | null;
  secretConfigured: boolean;
  checkedAt: string;
};
