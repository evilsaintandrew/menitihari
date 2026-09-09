"use client";

import { useState } from "react";

import {
  Alert,
  Badge,
  BottomSheet,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  DestructiveConfirmation,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  FieldHint,
  FieldLabel,
  Input,
  OfflineState,
  OwnerShell,
  Progress,
  Radio,
  Select,
  Skeleton,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";

function ShowcaseContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { push } = useToast();

  return (
    <main className="ds-main">
      <section className="ds-hero">
        <div>
          <Badge tone="accent">FOUND-008 · UI foundation</Badge>
          <h2>Ruang yang terasa tenang untuk keputusan penting.</h2>
          <p>Shared primitives for the owner app, guest invitation, and event-day staff surfaces. Calm neutrals, one clear action color, and expressive pastel punctuation.</p>
          <div className="ds-actions">
            <Button onClick={() => push({ title: "Perubahan tersimpan", description: "Status ini hanya contoh notifikasi.", tone: "success" })}>Tampilkan toast</Button>
            <Button onClick={() => setDialogOpen(true)} variant="secondary">Buka dialog</Button>
          </div>
        </div>
        <div className="ds-hero-art" aria-hidden="true"><span className="ds-swatch ds-swatch-sky" /><span className="ds-swatch ds-swatch-pink" /><span className="ds-swatch ds-swatch-lime" /><div className="ds-art-card"><span className="ui-overline">Alya &amp; Bima</span><strong>20 Desember 2026</strong><span className="ui-muted">Semua yang penting, satu tempat.</span></div></div>
      </section>

      <section className="ds-grid ds-grid-three" aria-label="Status dan surfaces">
        <Card><CardHeader><CardTitle>Trial aktif</CardTitle><CardDescription>Status komersial ditampilkan dari server.</CardDescription></CardHeader><CardContent><Progress label="Setup undangan" value={68} /></CardContent><CardFooter><Badge tone="warning">2 hari tersisa</Badge><Button size="sm">Aktifkan</Button></CardFooter></Card>
        <Card><CardHeader><CardTitle>State patterns</CardTitle><CardDescription>Pesan yang membantu pengguna pulih.</CardDescription></CardHeader><CardContent><Alert title="Informasi" tone="info">Data Anda tetap tersimpan dan bisa dilanjutkan.</Alert></CardContent></Card>
        <Card><CardHeader><CardTitle>Aksen seperlunya</CardTitle><CardDescription>Pastel hadir sebagai penanda, bukan latar utama.</CardDescription></CardHeader><CardContent><div className="ds-accent-row"><span className="ds-dot ds-dot-sky" /><span className="ds-dot ds-dot-lime" /><span className="ds-dot ds-dot-pink" /><span className="ds-dot ds-dot-brand" /></div></CardContent></Card>
      </section>

      <section className="ds-grid ds-grid-two">
        <Card><CardHeader><CardTitle>Form controls</CardTitle><CardDescription>Label eksplisit, helper text, dan error yang terhubung.</CardDescription></CardHeader><CardContent className="ds-form">
          <Field htmlFor="name"><FieldLabel required>Nama tampilan</FieldLabel><Input id="name" placeholder="Alya" /><FieldHint>Nama ini ditampilkan di halaman undangan.</FieldHint></Field>
          <Field htmlFor="event"><FieldLabel>Acara utama</FieldLabel><Select defaultValue="reception" id="event"><option value="reception">Resepsi</option><option value="ceremony">Akad</option></Select></Field>
          <Field htmlFor="note"><FieldLabel>Catatan</FieldLabel><Textarea id="note" placeholder="Tulis catatan singkat" /></Field>
          <Checkbox defaultChecked label="Saya mengerti status pembayaran ditentukan server." description="UI tidak pernah menganggap redirect provider sebagai pembayaran berhasil." />
          <Radio defaultChecked label="Undangan personal" name="visibility" /><Radio label="Undangan umum" name="visibility" />
        </CardContent><CardFooter><Button>Simulasikan simpan</Button><Button variant="ghost">Batal</Button></CardFooter></Card>
        <Card><CardHeader><CardTitle>Loading, empty, error</CardTitle><CardDescription>Semua operational screen punya jalan keluar.</CardDescription></CardHeader><CardContent className="ds-states"><Skeleton lines={3} /><EmptyState title="Belum ada tamu" description="Tambahkan tamu atau import daftar untuk mulai membagikan undangan." action={<Button size="sm">Tambah tamu</Button>} /><ErrorState description="Kami tidak dapat memuat ringkasan saat ini." onRetry={() => push({ title: "Mencoba lagi", tone: "info" })} /><OfflineState onRetry={() => push({ title: "Menunggu koneksi", tone: "warning" })} /></CardContent></Card>
      </section>

      <Card><CardHeader><CardTitle>Responsive surface contracts</CardTitle><CardDescription>Owner desktop, guest mobile-first, dan staff phone-first memakai konteks yang berbeda.</CardDescription></CardHeader><CardContent><Tabs items={[{ id: "owner", label: "Owner", content: <div className="ds-tab-copy"><Badge tone="warning">Trial · 2 hari</Badge><p>Rail desktop menjadi menu drawer di mobile. Preview, status, dan tindakan utama tetap ditemukan.</p></div> }, { id: "guest", label: "Guest", content: <div className="ds-tab-copy"><Badge tone="neutral">Undangan personal</Badge><p>Presentasi tetap terasa seperti undangan; RSVP menjadi tindakan operasional yang jelas.</p></div> }, { id: "staff", label: "Staff", content: <div className="ds-tab-copy"><Badge tone="success">Check-in dibuka</Badge><p>Event context selalu terlihat. Scan dan cari tamu adalah fallback setara.</p></div> }]} /></CardContent><CardFooter><Button onClick={() => setSheetOpen(true)} variant="secondary">Buka bottom sheet</Button><Button onClick={() => setConfirmed(true)} variant="danger">Contoh tindakan berisiko</Button></CardFooter></Card>

      {confirmed && <Card className="ds-confirm-card"><DestructiveConfirmation confirmLabel="Hapus draft" description="Draft akan dijadwalkan untuk dihapus. Pastikan ini memang yang ingin dilakukan." onCancel={() => setConfirmed(false)} onConfirm={() => { setConfirmed(false); push({ title: "Permintaan dicatat", description: "Server akan memproses status berikutnya.", tone: "success" }); }} title="Hapus draft ini?" /></Card>}

      <Dialog description="Dialog menjaga fokus dan bisa ditutup dengan Escape." onClose={() => setDialogOpen(false)} open={dialogOpen} title="Publish readiness"><div className="ds-dialog-content"><Alert title="Siap dipublikasikan" tone="success">Nama pasangan, tema, dan acara utama sudah lengkap.</Alert><Button data-dialog-autofocus onClick={() => { setDialogOpen(false); push({ title: "Siap dipublikasikan", tone: "success" }); }}>Publikasikan</Button></div></Dialog>
      <BottomSheet description="Mobile uses a bottom sheet for consequential actions." onClose={() => setSheetOpen(false)} open={sheetOpen} title="Bagikan undangan"><div className="ds-dialog-content"><p>Pilih tindakan. Status WhatsApp tetap dilaporkan secara faktual.</p><Button onClick={() => setSheetOpen(false)}>Salin tautan</Button><Button onClick={() => setSheetOpen(false)} variant="secondary">Buka WhatsApp</Button></div></BottomSheet>
    </main>
  );
}

export function DesignSystemShowcase() {
  return <OwnerShell><ShowcaseContent /></OwnerShell>;
}
