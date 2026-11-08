// Shapes shared by the Hono API and the browser client. JSON has no Date, so
// every timestamp crossing the wire is an ISO string.

export type SessionUser = { id: string; name: string; email: string; image?: string | null };
export type Session = { user: SessionUser; session: { id: string; expiresAt: string } } | null;

// The LINE account the user linked via OAuth, or null when not linked.
export type LineAccount = { lineUserId: string } | null;

export type ExpenseFilter = { from?: string; to?: string; categoryId?: string };
export type ExpenseInput = {
  title: string;
  payee?: string | null;
  amount: number;
  occurredAt: string;
  categoryId?: string | null;
  source?: "manual" | "qr";
  qrPayload?: string | null;
  externalId?: string | null;
};

export type ExpenseUpdate = {
  title: string;
  payee?: string | null;
  amount: number;
  categoryId?: string | null;
};

export type Expense = {
  id: string;
  userId: string;
  title: string;
  payee: string | null;
  amount: string;
  occurredAt: string;
  source: string;
  categoryId: string | null;
  qrPayload: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
};

// An expense joined with its category, as the list endpoints return it.
export type ExpenseRow = {
  id: string;
  title: string;
  payee: string | null;
  amount: string;
  occurredAt: string;
  source: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
};

export type Category = {
  id: string;
  userId: string | null;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  // How many of this account's expenses use the category. The list endpoint
  // returns it so the picker can order built-ins by usage.
  usage?: number;
};
export type CategoryInput = { name: string; icon: string; color: string };

export type UploadImage = { data: string; name: string; payload: string | null };

export type ImportJobView = {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
  earliestAt: string | null;
  error: string | null;
};

export type SlipRead = {
  amount: number;
  dateTime: string | null;
  transactionId: string;
  title: string;
  recipient: {
    name: string;
  };
  sender: {
    name: string;
  };
  ocrText: string;
};
