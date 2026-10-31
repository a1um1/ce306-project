import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { Pen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddExpenseDialog } from "@/components/expense/AddExpenseDialog";
import { IMPORTED_EVENT } from "@/components/expense/ImportBanner";
import { CategoryDialog } from "@/components/category/CategoryDialog";
import { Summarize } from "@/components/summary/Summarize";
import { TransactionList } from "@/components/transactions/TransactionList";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import page from "@/components/layout/page.module.css";
import {
  RANGE_ORDER,
  rangeBounds,
  rangeKeyFor,
  toDateKey,
  type RangeKey,
} from "@/lib/utils/format";
import { buildBreakdown } from "@/lib/utils/summary";
import { useCategories, useExpenses, queryKeys } from "@/lib/hooks/use-api-queries";
import { useQueryClient } from "@tanstack/react-query";
import type { ExpenseFilter } from "@/lib/api/types";

const PREVIEW_COUNT = 10;

type DashSearch = { range: RangeKey; year: number };

export const defaultDashSearch = (): DashSearch => ({
  range: "today",
  year: new Date().getFullYear(),
});

export const Route = createFileRoute("/_protected/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashSearch => ({
    range: RANGE_ORDER.includes(search.range as RangeKey) ? (search.range as RangeKey) : "today",
    year: Number(search.year) || new Date().getFullYear(),
  }),
  component: Dashboard,
});

function Dashboard() {
  const queryClient = useQueryClient();
  const { range, year } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();

  const [addOpen, setAddOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const setRange = (key: RangeKey) =>
    void navigate({ search: (prev) => ({ ...prev, range: key }) });
  const setYear = (next: number) =>
    void navigate({ search: (prev) => ({ ...prev, year: next, range: "year" }) });

  const bounds = useMemo(() => rangeBounds(range, year), [range, year]);
  const expensesFilter = useMemo<ExpenseFilter>(() => ({
    from: bounds.from,
    to: bounds.to,
  }), [bounds.from, bounds.to])
  
  const { data: categories = [] } = useCategories()
  const { data: rows = [], isLoading, isFetching } = useExpenses(expensesFilter)

  // Same-length window ending just before the current one, for the delta.
  const prevBounds = useMemo(() => {
    const fromMs = +new Date(bounds.from);
    const toMs = +new Date(bounds.to);
    const span = toMs - fromMs;
    const to = fromMs - 1;
    return { from: new Date(to - span).toISOString(), to: new Date(to).toISOString() };
  }, [bounds])
  
  const prevExpensesFilter = useMemo<ExpenseFilter>(() => ({
    from: prevBounds.from,
    to: prevBounds.to,
  }), [prevBounds.from, prevBounds.to])
  
  const { data: prevRows = [] } = useExpenses(prevExpensesFilter)

  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0)
  const previousTotal = prevRows.reduce((sum, r) => sum + Number(r.amount), 0)
  const slices = buildBreakdown(rows)
  const preview = rows.slice(0, PREVIEW_COUNT)
  const hidden = rows.length - preview.length
  const loading = isLoading || isFetching

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.expenses })
    void router.invalidate()
  }

  const onImported = (earliest?: string) => {
    if (earliest) {
      const needed = rangeKeyFor(earliest)
      if (RANGE_ORDER.indexOf(needed) > RANGE_ORDER.indexOf(range)) setRange(needed)
    }
    refresh()
  }

  useEffect(() => {
    const handler = (event: Event) => {
      const earliest =
        (event as CustomEvent<{ earliestAt: string | null }>).detail?.earliestAt ?? undefined;
      onImported(earliest);
    };
    window.addEventListener(IMPORTED_EVENT, handler);
    return () => window.removeEventListener(IMPORTED_EVENT, handler);
  });

  return (
    <div className={page.page}>
      <div className={page.container}>
        <Summarize
          total={total}
          previousTotal={previousTotal}
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
            <Button size="md" onClick={() => setAddOpen(true)}>
              <Pen size={24} strokeWidth={2} />
              จดเพิ่ม
            </Button>
          </div>
        </div>

        <TransactionList
          rows={preview}
          loading={loading}
          categories={categories}
          empty="ยังไม่มีรายจ่ายในช่วงนี้"
          onChanged={refresh}
          grouped
        />

        {hidden > 0 ? (
          <ButtonLink
            to="/transactions"
            search={{
              from: toDateKey(new Date(bounds.from)),
              to: toDateKey(new Date(bounds.to)),
              categoryId: "",
              sort: "date-desc",
              q: "",
            }}
            variant="secondary"
            size="md"
            className={page.viewAllButton}
          >
            ดูทั้งหมด {rows.length} รายการ
          </ButtonLink>
        ) : null}
      </div>

      <button
        type="button"
        className={page.fab}
        onClick={() => setAddOpen(true)}
        aria-label="จดเพิ่ม"
      >
        <Pen size={26} strokeWidth={2} />
      </button>

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
