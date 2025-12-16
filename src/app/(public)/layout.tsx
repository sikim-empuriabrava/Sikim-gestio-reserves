export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 py-12">
      <div className="w-full">{children}</div>
    </div>
  );
}
