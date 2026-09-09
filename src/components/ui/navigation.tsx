"use client";

import { useState, type ReactNode } from "react";

import { Badge } from "./badge";
import { Button } from "./button";
import { cn } from "./cn";
import { NavLink } from "./link";

const ownerItems = ["Overview", "Editor", "Tamu", "RSVP", "Guestbook", "Check-in"];

function Wordmark() {
  return <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span>Menitihari</span>;
}

export function OwnerShell({ children, active = "Overview" }: { children: ReactNode; active?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ui-shell ui-owner-shell">
      <header className="ui-mobile-topbar"><Wordmark /><Button aria-label="Buka menu" onClick={() => setOpen(true)} size="sm" variant="ghost">☰</Button></header>
      <aside className={cn("ui-owner-rail", open && "ui-owner-rail-open")}>
        <div className="ui-rail-brand"><Wordmark /><Button aria-label="Tutup menu" className="ui-mobile-only" onClick={() => setOpen(false)} size="sm" variant="ghost">×</Button></div>
        <p className="ui-rail-context">Undangan Anda</p>
        <nav aria-label="Navigasi pemilik" className="ui-rail-nav">{ownerItems.map((item) => <NavLink active={item === active} href="#" key={item} onClick={() => setOpen(false)}>{item}</NavLink>)}</nav>
        <div className="ui-rail-footer"><Badge tone="accent">Trial · 2 hari</Badge><span className="ui-muted">Alya &amp; Bima</span></div>
      </aside>
      {open && <button aria-label="Tutup navigasi" className="ui-nav-backdrop" onClick={() => setOpen(false)} type="button" />}
      <div className="ui-shell-content"><header className="ui-workspace-header"><div><p className="ui-overline">Undangan / Overview</p><h1>Alya &amp; Bima</h1></div><div className="ui-workspace-actions"><Badge tone="warning">Trial · 2 hari</Badge><Button size="sm" variant="secondary">Preview</Button><Button size="sm">Aktifkan</Button></div></header>{children}</div>
    </div>
  );
}

export function GuestShell({ children }: { children: ReactNode }) {
  return <div className="ui-guest-shell"><header className="ui-guest-header"><Wordmark /><Badge tone="neutral">Undangan personal</Badge></header><main className="ui-guest-content">{children}</main></div>;
}

export function StaffShell({ children, eventName = "Resepsi · Grand Ballroom" }: { children: ReactNode; eventName?: string }) {
  return <div className="ui-staff-shell"><header className="ui-staff-header"><div><p className="ui-overline">Petugas acara</p><h1>{eventName}</h1></div><Badge tone="success">● Check-in dibuka</Badge></header><main className="ui-staff-content">{children}</main><nav aria-label="Mode check-in" className="ui-staff-actions"><Button fullWidth>Scan QR</Button><Button fullWidth variant="secondary">Cari Tamu</Button></nav></div>;
}
