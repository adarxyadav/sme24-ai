export default function ExpertLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      {children}
    </section>
  );
}
