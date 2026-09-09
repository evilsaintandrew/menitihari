export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16 text-slate-950">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-700">
          Menitihari
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          Wedding invitations, thoughtfully made.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
          The application foundation is ready for the invitation lifecycle,
          guest access, RSVP, and event-day operations modules.
        </p>
      </section>
    </main>
  );
}
