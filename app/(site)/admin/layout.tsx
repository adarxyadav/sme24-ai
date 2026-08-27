import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-3">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Admin</p>
        <AdminNav />
      </div>
      {children}
    </section>
  );
}
