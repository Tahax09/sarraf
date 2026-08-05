"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiFetch, type QueryParams } from "./client";
import { endpoints } from "./endpoints";
import type {
  Account,
  ActivityEvent,
  AuthorizedWithdrawalOperation,
  Branch,
  BranchFlow,
  CblConnectionStatus,
  CeftOperation,
  Client,
  Country,
  Currency,
  CurrencyBalance,
  CurrentUser,
  DashboardSummary,
  DepositOperation,
  ExternalTransferOperation,
  FundTransferOperation,
  LedgerEntry,
  OperationPricing,
  OperationRules,
  Paged,
  ReportSnapshot,
  Role,
  Session,
  SystemInfo,
  SystemLog,
  TrendPoint,
  User,
  WithdrawalOperation,
} from "./types";

/** All query keys in one namespace so invalidation stays predictable. */
export const qk = {
  me: ["me"] as const,
  dashboard: (part: string) => ["dashboard", part] as const,
  clients: (params?: QueryParams) => ["clients", params ?? {}] as const,
  accounts: (params?: QueryParams) => ["accounts", params ?? {}] as const,
  operations: (kind: string, params?: QueryParams) =>
    ["operations", kind, params ?? {}] as const,
  exchangeRate: (from: string, to: string) => ["exchange-rate", from, to] as const,
  settings: (part: string) => ["settings", part] as const,
  branches: ["branches"] as const,
  users: ["users"] as const,
  roles: ["roles"] as const,
  logs: (params?: QueryParams) => ["logs", params ?? {}] as const,
  reports: (date: string) => ["reports", date] as const,
  analytics: (part: string, params?: QueryParams) =>
    ["analytics", part, params ?? {}] as const,
  sessions: ["profile", "sessions"] as const,
  cbl: ["cbl", "connection"] as const,
};

type Opts<T> = Omit<UseQueryOptions<T>, "queryKey" | "queryFn">;

const get =
  <T,>(path: string, params?: QueryParams) =>
  () =>
    apiFetch<T>(path, { params });

/**
 * One query shape for every server-paged register.
 *
 * `keepPreviousData` holds the page already on screen while the next one is in
 * flight, so turning a page or re-sorting a column never collapses the table
 * back to a skeleton and never jumps the scroll position.
 */
function usePagedQuery<T>(
  queryKey: readonly unknown[],
  path: string,
  params: QueryParams,
  opts?: Opts<Paged<T>>,
) {
  return useQuery({
    queryKey,
    queryFn: get<Paged<T>>(path, params),
    placeholderData: keepPreviousData,
    ...opts,
  });
}

// ---------------------------------------------------------------- identity
export function useCurrentUser(opts?: Opts<CurrentUser>) {
  return useQuery({
    queryKey: qk.me,
    queryFn: get<CurrentUser>(endpoints.me),
    staleTime: 5 * 60_000,
    ...opts,
  });
}

// --------------------------------------------------------------- dashboard
export const useDashboardSummary = () =>
  useQuery({
    queryKey: qk.dashboard("summary"),
    queryFn: get<DashboardSummary>(endpoints.dashboard.summary),
  });

/** Trend window in days — the Dashboard's range selector (7 / 30 / 60 / 90). */
export const useTrends = (days = 30) =>
  useQuery({
    queryKey: qk.dashboard(`trends:${days}`),
    queryFn: get<TrendPoint[]>(endpoints.dashboard.trends, { days }),
  });

export const useCurrencyBalances = () =>
  useQuery({
    queryKey: qk.dashboard("currency-balances"),
    queryFn: get<CurrencyBalance[]>(endpoints.dashboard.currencyBalances),
  });

export type TopClient = Client & {
  balance: number;
  currency: string;
  operations: number;
};

export const useTopClients = (mode: "balance" | "activity") =>
  useQuery({
    queryKey: qk.dashboard(`top-clients:${mode}`),
    queryFn: get<TopClient[]>(endpoints.dashboard.topClients, { mode }),
  });

export const useRecentOperations = () =>
  useQuery({
    queryKey: qk.dashboard("recent"),
    queryFn: get<LedgerEntry[]>(endpoints.dashboard.recent),
  });

// ------------------------------------------------------ clients & accounts
export const useClients = (params: QueryParams, opts?: Opts<Paged<Client>>) =>
  usePagedQuery<Client>(qk.clients(params), endpoints.clients, params, opts);

export const useAccounts = (params: QueryParams, opts?: Opts<Paged<Account>>) =>
  usePagedQuery<Account>(qk.accounts(params), endpoints.accounts, params, opts);

// --------------------------------------------------------- money movement
export const useWithdrawals = (params: QueryParams) =>
  usePagedQuery<WithdrawalOperation>(
    qk.operations("withdrawals", params),
    endpoints.withdrawals,
    params,
  );

export const useDeposits = (params: QueryParams) =>
  usePagedQuery<DepositOperation>(
    qk.operations("deposits", params),
    endpoints.deposits,
    params,
  );

export const useAuthorizedWithdrawals = (params: QueryParams) =>
  usePagedQuery<AuthorizedWithdrawalOperation>(
    qk.operations("authorized-withdrawals", params),
    endpoints.authorizedWithdrawals,
    params,
  );

export const useExternalTransfers = (params: QueryParams) =>
  usePagedQuery<ExternalTransferOperation>(
    qk.operations("external-transfers", params),
    endpoints.externalTransfers,
    params,
  );

export const useFundTransfers = (params: QueryParams) =>
  usePagedQuery<FundTransferOperation>(
    qk.operations("fund-transfers", params),
    endpoints.fundTransfers,
    params,
  );

export const useCeftOperations = (params: QueryParams) =>
  usePagedQuery<CeftOperation>(
    qk.operations("ceft", params),
    endpoints.ceft,
    params,
  );

export function useExchangeRate(from?: string, to?: string) {
  return useQuery({
    queryKey: qk.exchangeRate(from ?? "", to ?? ""),
    queryFn: get<{ from: string; to: string; rate: number }>(
      endpoints.exchangeRate,
      { from, to },
    ),
    enabled: Boolean(from && to),
    staleTime: 60_000,
  });
}

type ApprovalKind = "authorized-withdrawals" | "external-transfers";

export function useApproveOperation(kind: ApprovalKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<unknown>(
        kind === "authorized-withdrawals"
          ? endpoints.approveAuthorizedWithdrawal(id)
          : endpoints.approveExternalTransfer(id),
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations", kind] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCancelOperation(kind: ApprovalKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch<unknown>(
        kind === "authorized-withdrawals"
          ? endpoints.cancelAuthorizedWithdrawal(id)
          : endpoints.cancelExternalTransfer(id),
        { method: "POST", body: { reason: reason ?? null } },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations", kind] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRegisterOperation(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ id: string; reference: string }>(path, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

// ------------------------------------------------------------- settings
export const usePricing = () =>
  useQuery({
    queryKey: qk.settings("pricing"),
    queryFn: get<OperationPricing[]>(endpoints.pricing),
  });

export const useCurrencies = () =>
  useQuery({
    queryKey: qk.settings("currencies"),
    queryFn: get<Currency[]>(endpoints.currencies),
  });

export const useOperationRules = () =>
  useQuery({
    queryKey: qk.settings("operation-rules"),
    queryFn: get<OperationRules>(endpoints.operationRules),
  });

export function useSaveOperationRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OperationRules) =>
      apiFetch<OperationRules>(endpoints.operationRules, {
        method: "PUT",
        body,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.settings("operation-rules") }),
  });
}

export function useSavePricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OperationPricing) =>
      apiFetch<OperationPricing>(endpoints.pricing, { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.settings("pricing") }),
  });
}

export function useCreateCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<Currency, "id">) =>
      apiFetch<Currency>(endpoints.currencies, { method: "POST", body }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.settings("currencies") }),
  });
}

export function useDeleteCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(endpoints.currency(id), { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.settings("currencies") }),
  });
}

export function useSaveSystemInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SystemInfo) =>
      apiFetch<SystemInfo>(endpoints.systemInfo, { method: "PUT", body }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.settings("system-info") }),
  });
}

export function useSaveBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Branch> & { name: string }) =>
      apiFetch<Branch>(id ? endpoints.branch(id) : endpoints.branches, {
        method: id ? "PUT" : "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.branches }),
  });
}

export function useSaveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id?: string;
      name: string;
      username: string;
      phone: string;
      userType: string;
      roleIds: string[];
      defaultBranchId: string;
    }) =>
      apiFetch<User>(id ? endpoints.user(id) : endpoints.users, {
        method: id ? "PUT" : "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch<User>(endpoints.user(id), { method: "PATCH", body: { active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
  });
}

/**
 * Triggers a backend-side reset. No password is ever returned to, or rendered
 * by, the admin UI.
 */
export function useResetUserPassword() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(endpoints.userPasswordReset(id), { method: "POST" }),
  });
}

export function useSaveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Role> & { name: string }) =>
      apiFetch<Role>(id ? endpoints.role(id) : endpoints.roles, {
        method: id ? "PUT" : "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.roles }),
  });
}

export const useSystemInfo = () =>
  useQuery({
    queryKey: qk.settings("system-info"),
    queryFn: get<SystemInfo>(endpoints.systemInfo),
  });

export const useCountries = () =>
  useQuery({
    queryKey: qk.settings("countries"),
    queryFn: get<Country[]>(endpoints.countries),
    staleTime: 60 * 60_000,
  });

export function useCreateCountry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Country) =>
      apiFetch<Country>(endpoints.countries, { method: "POST", body }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.settings("countries") }),
  });
}

export function useUpdateCountry() {
  const qc = useQueryClient();
  return useMutation({
    // The ISO code is the identity, so it is never part of the patch body.
    mutationFn: ({ code, ...body }: Country) =>
      apiFetch<Country>(endpoints.country(code), { method: "PATCH", body }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.settings("countries") }),
  });
}

export function useDeleteCountry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<void>(endpoints.country(code), { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.settings("countries") }),
  });
}

export const useBranches = () =>
  useQuery({
    queryKey: qk.branches,
    queryFn: get<Branch[]>(endpoints.branches),
    staleTime: 10 * 60_000,
  });

export const useUsers = () =>
  useQuery({ queryKey: qk.users, queryFn: get<User[]>(endpoints.users) });

export const useRoles = () =>
  useQuery({ queryKey: qk.roles, queryFn: get<Role[]>(endpoints.roles) });

export const useLogs = (params: QueryParams) =>
  usePagedQuery<SystemLog>(qk.logs(params), endpoints.logs, params);

// ------------------------------------------------- reports & analytics
export const useReport = (date: string) =>
  useQuery({
    queryKey: qk.reports(date),
    queryFn: get<ReportSnapshot>(endpoints.reports, { date }),
    enabled: Boolean(date),
  });

export const useBranchFlow = () =>
  useQuery({
    queryKey: qk.analytics("branch-flow"),
    queryFn: get<BranchFlow[]>(endpoints.analytics.branchFlow),
  });

export const useAllOperations = (params: QueryParams) =>
  usePagedQuery<LedgerEntry>(
    qk.analytics("ledger", params),
    endpoints.analytics.ledger,
    params,
  );

export const useActivity = () =>
  useQuery({
    queryKey: qk.analytics("activity"),
    queryFn: get<ActivityEvent[]>(endpoints.analytics.activity),
  });

// ------------------------------------------------------------- profile
export const useSessions = () =>
  useQuery({
    queryKey: qk.sessions,
    queryFn: get<Session[]>(endpoints.profile.sessions),
  });

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(endpoints.profile.session(id), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiFetch<void>(endpoints.profile.password, { method: "PUT", body }),
  });
}

// ----------------------------------------------------------------- CBL
export const useCblConnection = () =>
  useQuery({
    queryKey: qk.cbl,
    queryFn: get<CblConnectionStatus>(endpoints.cbl.connection),
  });

export function useTestCblConnection() {
  return useMutation({
    mutationFn: (body: { baseUrl: string; secretKey?: string }) =>
      apiFetch<{ ok: boolean; message: string }>(endpoints.cbl.testConnection, {
        method: "POST",
        body,
      }),
  });
}

export function useSaveCblConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { baseUrl: string; secretKey?: string }) =>
      apiFetch<CblConnectionStatus>(endpoints.cbl.connection, {
        method: "PUT",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.cbl }),
  });
}
