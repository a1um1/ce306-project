import { useState } from "react";
import { CategoryDialog, type CategoryRecord } from "@/components/category/CategoryDialog";
import { ManageCategoriesDialog } from "@/components/category/ManageCategoriesDialog";
import { Navbar } from "./Navbar";
import { getRouteApi } from "@tanstack/react-router";
import { useCategories } from "@/lib/hooks/use-api-queries";

const parent = getRouteApi("/_protected");

export function AppHeader() {
  const { user } = parent.useRouteContext();
  const { data: categories = [] } = useCategories();
  const [manageOpen, setManageOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRecord | null>(null);

  return (
    <>
      <Navbar user={user} onManageCategories={() => setManageOpen(true)} />
      <ManageCategoriesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        categories={categories}
        onEdit={(category) => {
          setManageOpen(false);
          setEditing(category);
          setCategoryOpen(true);
        }}
        onNew={() => {
          setManageOpen(false);
          setEditing(null);
          setCategoryOpen(true);
        }}
      />
      <CategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        initial={editing}
        existingCount={categories.length}
        onSaved={() => {}}
      />
    </>
  );
}
