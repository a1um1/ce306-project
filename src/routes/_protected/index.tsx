import { createFileRoute, getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { Pen } from "lucide-react";
import { useMemo, useState } from "react";
import { AddExpenseDialog } from "@/components/expense/AddExpenseDialog";
import { AppHeader } from "@/components/layout/AppHeader";
import { CategoryDialog } from "@/components/category/CategoryDialog";
import { Summarize } from "@/components/summary/Summarize";
import { TransactionList } from "@/components/transactions/TransactionList";
import page from "@/components/layout/page.module.css";
import { listCategories } from "@/lib/api/categories";
import { RANGE_ORDER, rangeBounds, rangeKeyFor, toDateKey, type RangeKey } from "@/lib/utils/format";
import { buildBreakdown } from "@/lib/utils/summary";
import { useExpenses } from "@/lib/hooks/use-expenses";

const parent = getRouteApi("/_protected");

// The dashboard teases the newest few; the rest live on the transactions page.
const PREVIEW_COUNT = 10;

type DashSearch = { range: RangeKey; year: number };

// Default view: today of the current year.
export const defaultDashSearch = (): DashSearch => ({
  range: "today",
  year: new Date().getFullYear(),
});

export const Route = createFileRoute("/_protected/")({
  validateSearch: (search: Record<string, unknown>): DashSearch => ({
    range: RANGE_ORDER.includes(search.range as RangeKey) ? (search.range as RangeKey) : "today",
    year: Number(search.year) || new Date().getFullYear(),
  }),
  loader: async () => ({ categories: await listCategories() }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = parent.useRouteContext();
  const { categories } = Route.useLoaderData();
  const { range, year } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();

  const [reload, setReload] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const setRange = (key: RangeKey) => void navigate({ search: (prev) => ({ ...prev, range: key }) });
  const setYear = (next: number) =>
    void navigate({ search: (prev) => ({ ...prev, year: next, range: "year" }) });

  const bounds = useMemo(() => rangeBounds(range, year), [range, year]);
  const { rows, loading } = useExpenses(bounds, reload);

  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const slices = buildBreakdown(rows);
  const preview = rows.slice(0, PREVIEW_COUNT);
  const hidden = rows.length - preview.length;

  const refresh = () => {
    setReload((n) => n + 1);
    void router.invalidate();
  };

  // Imported slips carry their own (often past) date: widen the window so they
  // are actually visible instead of landing outside "today".
  const onImported = (earliest?: string) => {
    if (earliest) {
      const needed = rangeKeyFor(earliest);
      if (RANGE_ORDER.indexOf(needed) > RANGE_ORDER.indexOf(range)) setRange(needed);
    }
    refresh();
  };

  return (
    <div className={page.page}>
      <AppHeader user={user} categories={categories} onChanged={refresh} />

      <div className={page.container}>
        <h1 className={page.pageTitle}>Dashboard</h1>

        <Summarize
          total={total}
          rows={rows}
          slices={slices}
          bounds={bounds}
          range={range}
          year={year}
          onRangeChange={setRange}
          onYearChange={setYear}
        />

        <div className={page.headerRow}>
          <h2 className={page.listTitle}>ประวัติธรุกรรม</h2>
          <div className={page.actions}>
            <button type="button" className={page.addButton} onClick={() => setAddOpen(true)}>
              <Pen size={24} strokeWidth={2} />
              จดเพิ่ม
            </button>
          </div>
        </div>

        <TransactionList
          rows={preview}
          loading={loading}
          categories={categories}
          empty="ยังไม่มีรายจ่ายในช่วงนี้"
          onChanged={refresh}
        />

        {hidden > 0 ? (
          <Link
            to="/transactions"
            search={{
              from: toDateKey(new Date(bounds.from)),
              to: toDateKey(new Date(bounds.to)),
              categoryId: "",
            }}
            className={page.viewAllButton}
          >
            ดูทั้งหมด {rows.length} รายการ
          </Link>
        ) : null}
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
