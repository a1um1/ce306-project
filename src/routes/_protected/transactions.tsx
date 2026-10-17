import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { IMPORTED_EVENT } from "@/components/expense/ImportBanner";
import { RangePicker } from "@/components/summary/RangePicker";
import { TransactionList } from "@/components/transactions/TransactionList";
import page from "@/components/layout/page.module.css";
import { listCategories } from "@/lib/api/categories";
import {
  csvField,
  dayEndIso,
  dayStartIso,
  formatAmount,
  formatThaiDate,
  rangeBounds,
  toDateKey,
  type RangeKey,
} from "@/lib/utils/format";
import { useExpenses } from "@/lib/hooks/use-expenses";

const parent = getRouteApi("/_protected");

export type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "date-desc", label: "ใหม่ → เก่า" },
  { key: "date-asc", label: "เก่า → ใหม่" },
  { key: "amount-desc", label: "เงินมาก → น้อย" },
  { key: "amount-asc", label: "เงินน้อย → มาก" },
];

// Order matters: the first match wins when deciding which quick button is active.
const QUICK: RangeKey[] = ["today", "week", "month", "halfYear"];

export type TxSearch = { from: string; to: string; categoryId: string; sort: SortKey; q: string };

// Default filter: the current month up to today, no category.
export const defaultTxSearch = (now = new Date()): TxSearch => ({
  from: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
  to: toDateKey(now),
  categoryId: "",
  sort: "date-desc",
  q: "",
});

export const Route = createFileRoute("/_protected/transactions")({
  validateSearch: (search: Record<string, unknown>): TxSearch => {
    const def = defaultTxSearch();
    return {
      from: typeof search.from === "string" && search.from ? search.from : def.from,
      to: typeof search.to === "string" && search.to ? search.to : def.to,
      categoryId: typeof search.categoryId === "string" ? search.categoryId : "",
      sort: SORTS.some((s) => s.key === search.sort) ? (search.sort as SortKey) : def.sort,
      q: typeof search.q === "string" ? search.q : "",
    };
  },
  loader: async () => ({ categories: await listCategories() }),
  component: Transactions,
});

function Transactions() {
  const { user } = parent.useRouteContext();
  const { categories } = Route.useLoaderData();
  const { from, to, categoryId, sort, q } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [reload, setReload] = useState(0);

  const setFrom = (value: string) => void navigate({ search: (prev) => ({ ...prev, from: value }) });
  const setTo = (value: string) => void navigate({ search: (prev) => ({ ...prev, to: value }) });
  const setCategoryId = (value: string) =>
    void navigate({ search: (prev) => ({ ...prev, categoryId: value }) });
  const setSort = (value: SortKey) => void navigate({ search: (prev) => ({ ...prev, sort: value }) });
  const setQ = (value: string) => void navigate({ search: (prev) => ({ ...prev, q: value }) });

  const { rows, loading } = useExpenses(
    { from: dayStartIso(from), to: dayEndIso(to), categoryId: categoryId || undefined },
    reload,
  );

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? rows.filter(
          (r) =>
            r.title.toLowerCase().includes(needle) ||
            (r.payee ?? "").toLowerCase().includes(needle) ||
            (r.categoryName ?? "").toLowerCase().includes(needle),
        )
      : [...rows];
    switch (sort) {
      case "date-asc":
        return list.sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt));
      case "amount-desc":
        return list.sort((a, b) => Number(b.amount) - Number(a.amount));
      case "amount-asc":
        return list.sort((a, b) => Number(a.amount) - Number(b.amount));
      default:
        return list.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
    }
  }, [rows, sort, q]);

  const total = sorted.reduce((sum, r) => sum + Number(r.amount), 0);

  // Which quick range (if any) the current from/to equals, so its button lights up.
  const now = new Date();
  const activeQuick = useMemo(() => {
    for (const key of QUICK) {
      const b = rangeBounds(key, now.getFullYear());
      if (toDateKey(new Date(b.from)) === from && toDateKey(new Date(b.to)) === to) {
        return { key, year: now.getFullYear() };
      }
    }
    const year = Number(from.slice(0, 4));
    if (Number.isFinite(year)) {
      const b = rangeBounds("year", year);
      if (toDateKey(new Date(b.from)) === from && toDateKey(new Date(b.to)) === to) {
        return { key: "year" as RangeKey, year };
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const applyQuick = (key: RangeKey) => {
    const b = rangeBounds(key, now.getFullYear());
    void navigate({
      search: (prev) => ({ ...prev, from: toDateKey(new Date(b.from)), to: toDateKey(new Date(b.to)) }),
    });
  };
  const applyYear = (year: number) => {
    const b = rangeBounds("year", year);
    void navigate({
      search: (prev) => ({ ...prev, from: toDateKey(new Date(b.from)), to: toDateKey(new Date(b.to)) }),
    });
  };

  // A background import can land slips older than the filter's start; widen the
  // window so they show, then refetch.
  useEffect(() => {
    const handler = (event: Event) => {
      const earliest = (event as CustomEvent<{ earliestAt: string | null }>).detail?.earliestAt;
      if (earliest) {
        const key = toDateKey(new Date(earliest));
        if (key < from) setFrom(key);
      }
      setReload((n) => n + 1);
    };
    window.addEventListener(IMPORTED_EVENT, handler);
    return () => window.removeEventListener(IMPORTED_EVENT, handler);
  });

  const exportCsv = () => {
    const header = ["วันที่", "ชื่อรายการ", "จ่ายให้", "หมวดหมู่", "จำนวนเงิน", "ที่มา"];
    const lines = [
      header.join(","),
      ...sorted.map((r) =>
        [
          formatThaiDate(r.occurredAt),
          r.title,
          r.payee ?? "",
          r.categoryName ?? "",
          formatAmount(r.amount),
          r.source,
        ]
          .map(csvField)
          .join(","),
      ),
    ];
    // BOM so Excel reads Thai text correctly.
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paytail-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={page.page}>
      <AppHeader user={user} categories={categories} onChanged={() => setReload((n) => n + 1)} />

      <div className={page.container}>
        <div className={page.headerRow}>
          <h2 className={page.listTitle}>ประวัติธรุกรรม</h2>
          <div className={page.actions}>
            <span className={page.totalLabel}>
              รวม {formatAmount(total)}฿ · {sorted.length} รายการ
            </span>
            <button
              type="button"
              className={page.exportButton}
              onClick={exportCsv}
              disabled={sorted.length === 0}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className={page.filters}>
          <label className={page.field}>
            <span className={page.fieldLabel}>จากวันที่</span>
            <input
              className={page.fieldInput}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className={page.field}>
            <span className={page.fieldLabel}>ถึงวันที่</span>
            <input
              className={page.fieldInput}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <div className={page.quickRow}>
            <span className={page.fieldLabel}>ช่วงด่วน</span>
            <RangePicker
              value={activeQuick?.key ?? null}
              year={activeQuick?.year ?? now.getFullYear()}
              withYear={false}
              onChange={applyQuick}
              onYearChange={applyYear}
            />
          </div>
          <label className={page.field}>
            <span className={page.fieldLabel}>ค้นหา</span>
            <input
              className={page.fieldInput}
              type="search"
              placeholder="ชื่อ / ผู้รับเงิน"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label className={page.field}>
            <span className={page.fieldLabel}>หมวดหมู่</span>
            <select
              className={page.fieldInput}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">ทั้งหมด</option>
              <option value="__none__">ยังไม่ระบุ</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={page.field}>
            <span className={page.fieldLabel}>เรียงตาม</span>
            <select
              className={page.fieldInput}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={page.resetButton} onClick={resetFilters}>
            ล้างตัวกรอง
          </button>
        </div>

        <TransactionList
          rows={sorted}
          loading={loading}
          categories={categories}
          empty="ไม่พบรายจ่ายในช่วงที่เลือก"
          onChanged={() => setReload((n) => n + 1)}
          grouped={sort === "date-desc" || sort === "date-asc"}
        />
      </div>
    </div>
  );
}
