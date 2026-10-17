import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { Pen } from "lucide-react";
import { useMemo, useState } from "react";
import { AddExpenseDialog } from "@/components/expense/AddExpenseDialog";
import { AppHeader } from "@/components/layout/AppHeader";
import { CategoryDialog } from "@/components/category/CategoryDialog";
import { Summarize } from "@/components/summary/Summarize";
import { TransactionList } from "@/components/transactions/TransactionList";
import page from "@/components/layout/page.module.css";
import { listCategories } from "@/lib/api/categories";
import {
  RANGE_LABEL,
  RANGE_ORDER,
  rangeBounds,
  rangeKeyFor,
  type RangeKey,
} from "@/lib/utils/format";
import { useExpenses } from "@/lib/hooks/use-expenses";

const parent = getRouteApi("/_protected");

export const Route = createFileRoute("/_protected/")({
  loader: async () => ({ categories: await listCategories() }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = parent.useRouteContext();
  const { categories } = Route.useLoaderData();
  const router = useRouter();

  const [range, setRange] = useState<RangeKey>("today");
  const [reload, setReload] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const bounds = useMemo(() => rangeBounds(range), [range]);
  const { rows, loading } = useExpenses(bounds, reload);

  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const byColor = new Map<string, number>();
  for (const r of rows) {
    const color = r.categoryColor ?? "#d9d9d9";
    byColor.set(color, (byColor.get(color) ?? 0) + Number(r.amount));
  }
  const segments = [...byColor].map(([color, value]) => ({ color, value }));

  const refresh = () => {
    setReload((n) => n + 1);
    void router.invalidate();
  };

  // Imported slips carry their own (often past) date: widen the window so they
  // are actually visible instead of landing outside "today".
  const onImported = (earliest?: string) => {
    if (earliest) {
      const needed = rangeKeyFor(earliest);
      setRange((current) =>
        RANGE_ORDER.indexOf(needed) > RANGE_ORDER.indexOf(current) ? needed : current,
      );
    }
    refresh();
  };

  return (
    <div className={page.page}>
      <AppHeader user={user} categories={categories} onChanged={refresh} />

      <div className={page.container}>
        <Summarize total={total} segments={segments} range={range} onRangeChange={setRange} />

        <div className={page.headerRow}>
          <h2 className={page.listTitle}>ประวัติธรุกรรม</h2>
          <div className={page.actions}>
            <span className={page.pill}>{RANGE_LABEL[range]}</span>
            <button type="button" className={page.addButton} onClick={() => setAddOpen(true)}>
              <Pen size={24} strokeWidth={2} />
              จดเพิ่ม
            </button>
          </div>
        </div>

        <TransactionList
          rows={rows}
          loading={loading}
          categories={categories}
          empty="ยังไม่มีรายจ่ายในช่วงนี้"
          onChanged={refresh}
        />
      </div>

      <AddExpenseDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        categories={categories}
        onSaved={onImported}
        onNewCategory={() => {
          setAddOpen(false);
          setCategoryOpen(true);
        }}
      />
      <CategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        existingCount={categories.length}
        onSaved={() => {
          // Creating a category from the add-expense flow closes every dialog.
          refresh();
          setAddOpen(false);
        }}
      />
    </div>
  );
}
