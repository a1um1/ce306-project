import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { TransactionList } from "@/components/transactions/TransactionList";
import page from "@/components/layout/page.module.css";
import { listCategories } from "@/lib/api/categories";
import {
  csvField,
  dayEndIso,
  dayStartIso,
  formatAmount,
  formatThaiDate,
  toDateKey,
} from "@/lib/utils/format";
import { useExpenses } from "@/lib/hooks/use-expenses";

const parent = getRouteApi("/_protected");

export const Route = createFileRoute("/_protected/transactions")({
  loader: async () => ({ categories: await listCategories() }),
  component: Transactions,
});

function Transactions() {
  const { user } = parent.useRouteContext();
  const { categories } = Route.useLoaderData();

  const today = new Date();
  const [from, setFrom] = useState(toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(toDateKey(today));
  const [categoryId, setCategoryId] = useState("");
  const [reload, setReload] = useState(0);

  const { rows, loading } = useExpenses(
    { from: dayStartIso(from), to: dayEndIso(to), categoryId: categoryId || undefined },
    reload,
  );

  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);

  const exportCsv = () => {
    const header = ["วันที่", "ชื่อรายการ", "จ่ายให้", "หมวดหมู่", "จำนวนเงิน", "ที่มา"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
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
          <span className={page.pill}>รวม {formatAmount(total)}฿</span>
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
          <label className={page.field}>
            <span className={page.fieldLabel}>หมวดหมู่</span>
            <select
              className={page.fieldInput}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">ทั้งหมด</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={page.exportButton}
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            Export CSV
          </button>
        </div>

        <TransactionList
          rows={rows}
          loading={loading}
          categories={categories}
          empty="ไม่พบรายจ่ายในช่วงที่เลือก"
          onChanged={() => setReload((n) => n + 1)}
        />
      </div>
    </div>
  );
}
