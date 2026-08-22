import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 shadow-[0_24px_80px_rgba(15,45,30,0.1)] sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-black text-white">ل</div>
          <h1 className="text-2xl font-black text-foreground">کوپایلوت لیارا</h1>
          <p className="mt-2 text-sm leading-6 text-muted">برای دسترسی به گفتگوها و پاسخ‌های مستند وارد شو.</p>
        </div>
        <div className="space-y-3">
          <form action={async () => { "use server"; await signIn("github", { redirectTo: "/" }); }}>
            <button type="submit" className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface text-sm font-bold text-foreground transition hover:bg-surface-soft active:scale-[.98]">
              <span className="font-mono text-lg" aria-hidden="true">GH</span> ورود با GitHub
            </button>
          </form>
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
            <button type="submit" className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface text-sm font-bold text-foreground transition hover:bg-surface-soft active:scale-[.98]">
              <span className="font-bold text-accent-strong" aria-hidden="true">G</span> ورود با Google
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs leading-6 text-muted">با ورود، شرایط استفاده و حفظ حریم خصوصی را می‌پذیری.</p>
      </section>
    </main>
  );
}
