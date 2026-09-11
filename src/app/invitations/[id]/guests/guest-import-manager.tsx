"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, EmptyState, Input, Progress, TextLink } from "@/components/ui";
import type { GuestImportAssignment, GuestImportView } from "@/modules/guests";

import { confirmGuestImportAction, setGuestImportRowStateAction, startGuestImportAction, type GuestImportActionState } from "./import-actions";

const initialState: GuestImportActionState = { ok: false };

function capacityForRows(rows: GuestImportView["rows"]): number {
  return rows.filter((row) => row.state === "INCLUDED" && row.isValid).reduce((total, row) => total + row.assignments.reduce((sum, assignment) => sum + assignment.maxPartySize, 0), 0);
}

function ImportUpload({ invitationId }: { readonly invitationId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(startGuestImportAction, initialState);
  useEffect(() => {
    if (state.ok && state.importId) router.push(`/invitations/${invitationId}/guests/import?importId=${state.importId}`);
  }, [invitationId, router, state.importId, state.ok]);
  return (
    <Card className="guest-import-upload-card">
      <CardHeader>
        <p className="ui-overline">WF-29A</p>
        <h2>Upload CSV atau Excel (.xlsx)</h2>
        <CardDescription>Kolom yang didukung: nama/addressee, telepon, grup, acara, dan max orang.</CardDescription>
      </CardHeader>
      <form action={action} encType="multipart/form-data" className="guest-import-upload-form">
        <input name="invitationId" type="hidden" value={invitationId} />
        <label className="guest-import-dropzone" htmlFor="guest-import-file">
          <span className="guest-import-dropzone-title">Pilih file untuk mulai</span>
          <span className="ui-muted">CSV, TSV, atau Excel. File dibatasi oleh konfigurasi server.</span>
          <Input accept=".csv,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" id="guest-import-file" name="file" required type="file" />
        </label>
        {state.message && !state.ok && <Alert role="alert" tone="danger" title="Upload belum berhasil">{state.message}</Alert>}
        <CardFooter><Button disabled={pending} type="submit">{pending ? "Mengupload…" : "Mulai pemeriksaan"}</Button></CardFooter>
      </form>
    </Card>
  );
}

function RowToggle({ importId, rowId, include, disabled }: { readonly importId: string; readonly rowId: string; readonly include: boolean; readonly disabled: boolean }) {
  const [state, action, pending] = useActionState(setGuestImportRowStateAction, initialState);
  return (
    <form action={action}>
      <input name="importId" type="hidden" value={importId} />
      <input name="rowId" type="hidden" value={rowId} />
      <input name="include" type="hidden" value={String(include)} />
      <Button disabled={disabled || pending} size="sm" type="submit" variant={include ? "secondary" : "ghost"}>{pending ? "Menyimpan…" : include ? "Tetap import" : "Kecualikan"}</Button>
      {state.message && !state.ok && <span className="ui-field-error">{state.message}</span>}
    </form>
  );
}

function ImportRow({ importId, row, interactive }: { readonly importId: string; readonly row: GuestImportView["rows"][number]; readonly interactive: boolean }) {
  const invalid = row.issues.length > 0 || !row.isValid;
  const committed = row.state === "COMMITTED";
  const failed = row.state === "FAILED";
  return (
    <article className={`guest-import-row ${invalid ? "guest-import-row-invalid" : row.hasWarnings ? "guest-import-row-warning" : ""}`}>
      <div className="guest-import-row-heading"><Badge tone={invalid ? "danger" : row.hasWarnings ? "warning" : committed ? "success" : failed ? "danger" : "info"}>Baris {row.rowNumber}</Badge><strong>{row.displayName ?? "Nama belum diisi"}</strong></div>
      <dl className="guest-import-row-values">
        <div><dt>Telepon</dt><dd>{row.phone || "—"}</dd></div>
        <div><dt>Grup</dt><dd>{row.groupName || "—"}</dd></div>
        <div><dt>Party</dt><dd>{row.assignments.length ? row.assignments.map((assignment: GuestImportAssignment) => `${assignment.maxPartySize} orang`).join(", ") : "—"}</dd></div>
      </dl>
      {row.issues.length > 0 && <ul className="guest-import-issues">{row.issues.map((issue) => <li key={`${issue.code}-${issue.field ?? "row"}`}>× {issue.message}</li>)}</ul>}
      {row.duplicateWarnings.length > 0 && <ul className="guest-import-warnings">{row.duplicateWarnings.map((warning) => <li key={`${warning.guestId ?? warning.displayName}-${warning.matchingSignals.join("-")}`}>! Kemungkinan duplikat: “{warning.displayName}” ({warning.matchingSignals.join(" dan ")})</li>)}</ul>}
      {failed && <p className="guest-import-issues">× Baris gagal saat commit. Data tidak dibuat ulang otomatis.</p>}
      {interactive && row.isValid && !committed && !failed && <div className="guest-import-row-actions"><RowToggle disabled={!interactive} importId={importId} include={row.state !== "INCLUDED"} rowId={row.id} /></div>}
    </article>
  );
}

function ImportPreview({ guestImport }: { readonly guestImport: GuestImportView }) {
  const [filter, setFilter] = useState<"ALL" | "INVALID" | "WARNING">("ALL");
  const [state, action, pending] = useActionState(confirmGuestImportAction, initialState);
  const includedCapacity = capacityForRows(guestImport.rows);
  const capacityAfter = guestImport.capacityBefore + includedCapacity;
  const visibleRows = useMemo(() => guestImport.rows.filter((row) => filter === "ALL" || (filter === "INVALID" ? !row.isValid : row.hasWarnings)), [filter, guestImport.rows]);
  const canConfirm = guestImport.includedRows > 0 && capacityAfter <= 500;
  return (
    <>
      <Card className="guest-import-summary-card">
        <CardHeader>
          <div className="guest-import-summary-heading"><div><p className="ui-overline">WF-29C / WF-29D</p><h2>Import Preview</h2><CardDescription>{guestImport.sourceFilename}</CardDescription></div><Badge tone="info">{guestImport.totalRows} baris</Badge></div>
        </CardHeader>
        <CardContent>
          <div className="guest-import-stat-grid"><span><strong>{guestImport.validRows}</strong> valid</span><span><strong>{guestImport.warningRows}</strong> peringatan</span><span><strong>{guestImport.invalidRows}</strong> invalid</span></div>
          <div className="guest-import-capacity"><div><span>Kapasitas setelah import</span><strong>{capacityAfter} / 500 orang</strong></div><Progress label="Kapasitas" value={(capacityAfter / 500) * 100} /></div>
          {capacityAfter > 500 && <Alert tone="danger" title="Kapasitas terlampaui">Keluarkan beberapa baris atau kurangi max orang sebelum konfirmasi.</Alert>}
          {state.message && !state.ok && <Alert role="alert" tone="danger" title="Import belum dikonfirmasi">{state.message}</Alert>}
          <div className="guest-import-filters" role="group" aria-label="Filter baris"><Button onClick={() => setFilter("ALL")} size="sm" variant={filter === "ALL" ? "secondary" : "ghost"}>Semua</Button><Button onClick={() => setFilter("INVALID")} size="sm" variant={filter === "INVALID" ? "secondary" : "ghost"}>Invalid</Button><Button onClick={() => setFilter("WARNING")} size="sm" variant={filter === "WARNING" ? "secondary" : "ghost"}>Peringatan</Button></div>
        </CardContent>
        <CardFooter className="guest-import-confirm-footer"><form action={action}><input name="importId" type="hidden" value={guestImport.id} /><Button disabled={!canConfirm || pending} type="submit">{pending ? "Mengonfirmasi…" : `Konfirmasi Import ${guestImport.includedRows} Baris`}</Button><span className="ui-muted">Baris invalid akan tetap dikecualikan.</span></form></CardFooter>
      </Card>
      <section aria-label="Baris import" className="guest-import-rows">{visibleRows.length ? visibleRows.map((row) => <ImportRow importId={guestImport.id} interactive={guestImport.state === "PREVIEW"} key={row.id} row={row} />) : <Card><EmptyState description="Tidak ada baris pada filter ini." title="Baris tidak ditemukan" /></Card>}</section>
    </>
  );
}

function ImportStatus({ guestImport }: { readonly guestImport: GuestImportView }) {
  const router = useRouter();
  const waiting = guestImport.state === "UPLOADED" || guestImport.state === "PARSING" || guestImport.state === "COMMITTING";
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => router.refresh(), 1800);
    return () => window.clearInterval(timer);
  }, [router, waiting]);
  if (guestImport.state === "PREVIEW") return <ImportPreview guestImport={guestImport} />;
  if (guestImport.state === "COMPLETED") return <Card><CardHeader><p className="ui-overline">WF-29E</p><h2>Import selesai</h2><CardDescription>Data berhasil diproses tanpa melebihi kapasitas undangan.</CardDescription></CardHeader><CardContent><div className="guest-import-result"><strong>✓ {guestImport.committedRows} berhasil</strong>{guestImport.failedRows > 0 && <strong className="guest-import-result-failed">! {guestImport.failedRows} gagal saat commit</strong>}</div></CardContent><CardFooter><TextLink className="ui-button ui-button-secondary" href={`/invitations/${guestImport.invitationId}/guests`}>Kembali ke daftar tamu</TextLink></CardFooter></Card>;
  if (guestImport.state === "FAILED") return <Card><CardHeader><p className="ui-overline">Import</p><h2>Import belum berhasil</h2><CardDescription>{guestImport.statusMessage ?? "Data asli tidak berubah."}</CardDescription></CardHeader><CardContent>{guestImport.errorCode === "ROW_LIMIT_EXCEEDED" && <Alert tone="warning" title="Batas baris tercapai">Gunakan file yang lebih kecil atau minta administrator menaikkan batas server.</Alert>}</CardContent><CardFooter><TextLink className="ui-button ui-button-secondary" href={`/invitations/${guestImport.invitationId}/guests/import`}>Coba file lain</TextLink></CardFooter></Card>;
  return <Card><CardHeader><p className="ui-overline">WF-29B</p><h2>{guestImport.state === "COMMITTING" ? "Import sedang diproses" : "Memeriksa file…"}</h2><CardDescription>Anda boleh meninggalkan halaman ini. Status akan diperbarui otomatis.</CardDescription></CardHeader><CardContent><Progress label={guestImport.state === "COMMITTING" ? "Commit dalam batch" : "Validasi file"} value={guestImport.state === "COMMITTING" && guestImport.totalRows > 0 ? ((guestImport.committedRows + guestImport.failedRows) / guestImport.totalRows) * 100 : 35} /></CardContent><CardFooter><TextLink href={`/invitations/${guestImport.invitationId}/guests`}>Kembali ke Tamu</TextLink></CardFooter></Card>;
}

export function GuestImportManager({ invitationId, guestImport }: { readonly invitationId: string; readonly guestImport: GuestImportView | null }) {
  return (
    <main className="guest-import-page">
      <header className="guest-import-header"><div><TextLink href={`/invitations/${invitationId}/guests`}>← Tamu</TextLink><p className="ui-overline">Guests / Import</p><h1>Import tamu</h1><p className="guest-import-lede">Preview setiap baris sebelum data masuk ke daftar tamu. Duplikat hanya menjadi peringatan.</p></div><Badge tone="info">WF-29</Badge></header>
      {guestImport ? <ImportStatus guestImport={guestImport} /> : <ImportUpload invitationId={invitationId} />}
    </main>
  );
}
