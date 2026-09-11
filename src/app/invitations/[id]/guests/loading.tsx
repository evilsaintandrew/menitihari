export default function GuestsLoading() {
  return (
    <main aria-label="Memuat daftar tamu" className="guests-page" role="status">
      <div className="guests-header">
        <div className="ui-skeleton-stack">
          <span className="ui-skeleton" />
          <span className="ui-skeleton" />
          <span className="ui-skeleton" />
        </div>
      </div>
      <section className="guests-list">
        <div className="ui-card"><div className="ui-skeleton-stack"><span className="ui-skeleton" /><span className="ui-skeleton" /><span className="ui-skeleton" /></div></div>
        <div className="ui-card"><div className="ui-skeleton-stack"><span className="ui-skeleton" /><span className="ui-skeleton" /><span className="ui-skeleton" /></div></div>
      </section>
    </main>
  );
}
