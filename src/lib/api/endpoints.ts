/**
 * Every backend path the UI knows about, in one place. Modules must reference
 * these constants rather than string literals so a contract change is a
 * single-file edit once the real OpenAPI spec lands.
 */
export const endpoints = {
  me: "/me",
  logout: "/auth/logout",
  login: "/auth/login",
  /** Second factor, used only when the login response asks for one. */
  loginOtp: "/auth/login/otp",
  /** Starts a reset; the backend decides how the operator is contacted. */
  passwordResetRequest: "/auth/password-reset/request",

  dashboard: {
    summary: "/dashboard/summary",
    trends: "/dashboard/trends",
    currencyBalances: "/dashboard/currency-balances",
    topClients: "/dashboard/top-clients",
    recent: "/dashboard/recent-operations",
  },

  clients: "/clients",
  /** One client — the profile page, and the target of an edit. */
  client: (id: string) => `/clients/${id}`,
  accounts: "/accounts",
  account: (id: string) => `/accounts/${id}`,
  accountBalance: (accountId: string) => `/accounts/${accountId}/balance`,

  withdrawals: "/operations/withdrawals",
  deposits: "/operations/deposits",
  authorizedWithdrawals: "/operations/authorized-withdrawals",
  approveAuthorizedWithdrawal: (id: string) =>
    `/operations/authorized-withdrawals/${id}/approve`,
  cancelAuthorizedWithdrawal: (id: string) =>
    `/operations/authorized-withdrawals/${id}/cancel`,
  externalTransfers: "/operations/external-transfers",
  approveExternalTransfer: (id: string) =>
    `/operations/external-transfers/${id}/approve`,
  cancelExternalTransfer: (id: string) =>
    `/operations/external-transfers/${id}/cancel`,
  fundTransfers: "/operations/fund-transfers",
  ceft: "/operations/currency-exchange-transfers",
  exchangeRate: "/exchange-rate",

  pricing: "/settings/operations-pricing",
  currencies: "/settings/currencies",
  currency: (id: string) => `/settings/currencies/${id}`,
  operationRules: "/settings/operation-rules",
  systemInfo: "/settings/system-info",
  countries: "/settings/countries",
  country: (code: string) => `/settings/countries/${code}`,
  branches: "/branches",
  branch: (id: string) => `/branches/${id}`,
  users: "/users",
  user: (id: string) => `/users/${id}`,
  userPasswordReset: (id: string) => `/users/${id}/password-reset`,
  roles: "/roles",
  role: (id: string) => `/roles/${id}`,
  logs: "/logs",

  reports: "/reports",
  analytics: {
    branchFlow: "/analytics/branch-flow",
    ledger: "/analytics/all-operations",
    activity: "/analytics/activity",
  },

  profile: {
    sessions: "/profile/sessions",
    session: (id: string) => `/profile/sessions/${id}`,
    password: "/profile/password",
  },

  cbl: {
    connection: "/cbl/connection",
    testConnection: "/cbl/connection/test",
  },
} as const;
