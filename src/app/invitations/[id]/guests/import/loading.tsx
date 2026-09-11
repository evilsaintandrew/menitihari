import { Card, CardContent, CardHeader, Progress, TextLink } from "@/components/ui";

export default function GuestImportLoading() {
  return (
    <main className="guest-import-page">
      <header className="guest-import-header"><div><TextLink href="#">← Tamu</TextLink><p className="ui-overline">Guests / Import</p><h1>Import tamu</h1></div></header>
      <Card><CardHeader><h2>Memuat import…</h2></CardHeader><CardContent><Progress label="Memuat" value={35} /></CardContent></Card>
    </main>
  );
}
