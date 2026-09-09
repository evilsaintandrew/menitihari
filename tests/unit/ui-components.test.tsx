// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, Checkbox, Dialog, Tabs } from "@/components/ui";

describe("shared UI primitives", () => {
  it("renders a labelled button with the primary semantic variant", () => {
    render(<Button>Publikasikan</Button>);
    const button = screen.getByRole("button", { name: "Publikasikan" });

    expect(button.className).toContain("ui-button-primary");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("keeps checkbox semantics and an accessible label", () => {
    render(<Checkbox aria-label="Terima syarat" label="Terima syarat" />);
    const checkbox = screen.getByRole("checkbox", { name: "Terima syarat" });

    expect(checkbox).toBeTruthy();
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it("closes a dialog with Escape and returns focus to the trigger", () => {
    const onClose = vi.fn();
    render(<><Button onClick={() => undefined}>Buka</Button><Dialog onClose={onClose} open title="Konfirmasi">Isi dialog</Dialog></>);
    const dialog = screen.getByRole("dialog");

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("updates the active tab with keyboard-operable buttons", () => {
    render(<Tabs items={[{ id: "one", label: "Pertama", content: <p>Konten pertama</p> }, { id: "two", label: "Kedua", content: <p>Konten kedua</p> }]} />);

    fireEvent.click(screen.getByRole("tab", { name: "Kedua" }));

    expect(screen.getByRole("tabpanel").textContent).toContain("Konten kedua");
    expect(screen.getByRole("tab", { name: "Kedua" }).getAttribute("aria-selected")).toBe("true");
  });
});
