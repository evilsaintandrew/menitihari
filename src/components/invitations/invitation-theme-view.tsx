"use client";

import type { CSSProperties, ReactNode } from "react";

import type {
  InvitationContent,
  InvitationRenderData,
  InvitationRenderEvent,
  InvitationSectionId,
} from "@/modules/invitations";
import type { ResolvedThemePresentation } from "@/modules/themes";

interface InvitationThemeViewProps {
  readonly invitation: InvitationRenderData;
  readonly theme: ResolvedThemePresentation;
}

const labels = {
  id: {
    invitation: "Undangan Pernikahan",
    withLove: "Dengan penuh kasih",
    events: "Rangkaian Acara",
    parents: "Putra-putri dari",
    story: "Kisah Kami",
    quote: "Doa dan harapan",
  },
  en: {
    invitation: "Wedding Invitation",
    withLove: "With love",
    events: "Wedding Events",
    parents: "Children of",
    story: "Our Story",
    quote: "A prayer and hope",
  },
} as const;

const fontClasses = {
  "serif-sans": "invitation-font-serif-sans",
  "display-sans": "invitation-font-display-sans",
  "sans-serif": "invitation-font-sans-serif",
  "script-sans": "invitation-font-script-sans",
} as const;

function formatDate(value: string, timezone: string, language: "id" | "en"): string {
  try {
    return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
      dateStyle: "long",
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
      dateStyle: "long",
    }).format(new Date(value));
  }
}

function formatTime(value: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }
}

function EventCard({ event, timezone, language }: {
  readonly event: InvitationRenderEvent;
  readonly timezone: string;
  readonly language: "id" | "en";
}) {
  return (
    <li className="invitation-renderer-event">
      <div>
        <h3>{event.name}</h3>
        <p>{formatDate(event.startsAt, event.timezone || timezone, language)} · {formatTime(event.startsAt, event.timezone || timezone)}</p>
      </div>
      {(event.venue || event.address) && (
        <p className="invitation-renderer-muted">{[event.venue, event.address].filter(Boolean).join(" · ")}</p>
      )}
      {event.dressCode && <p className="invitation-renderer-muted">{event.dressCode}</p>}
    </li>
  );
}

function OptionalSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`invitation-renderer-section ${className}`}>{children}</section>;
}

function renderOptionalSections(
  content: InvitationContent,
  events: readonly InvitationRenderEvent[],
  timezone: string,
  language: "id" | "en",
): ReactNode[] {
  const copy = labels[language];
  const sections: Record<InvitationSectionId, ReactNode> = {
    couple: (content.optional.fullNames || content.optional.parentFields) && <OptionalSection key="couple">
      {content.optional.fullNames && <><p>{content.optional.fullNames.person1}</p><p>{content.optional.fullNames.person2}</p></>}
      {content.optional.parentFields && <><p className="invitation-renderer-kicker">{copy.parents}</p><p>{[content.optional.parentFields.person1?.father, content.optional.parentFields.person1?.mother].filter(Boolean).join(" & ")}</p><p>{[content.optional.parentFields.person2?.father, content.optional.parentFields.person2?.mother].filter(Boolean).join(" & ")}</p></>}
    </OptionalSection>,
    events: events.length > 0 && <OptionalSection className="invitation-renderer-events" key="events"><p className="invitation-renderer-kicker">{copy.events}</p><ul>{events.map((event) => <EventCard event={event} language={language} timezone={timezone} key={event.id} />)}</ul></OptionalSection>,
    opening_closing: (content.optional.opening || content.optional.closing || content.optional.quoteOrPrayer) && <OptionalSection key="opening_closing">
      {content.optional.opening && <p className="invitation-renderer-lede">{content.optional.opening}</p>}
      {content.optional.closing && <p className="invitation-renderer-lede">{content.optional.closing}</p>}
      {content.optional.quoteOrPrayer && <><p className="invitation-renderer-kicker">{copy.quote}</p><blockquote>{content.optional.quoteOrPrayer}</blockquote></>}
    </OptionalSection>,
    love_story: content.optional.loveStory && <OptionalSection key="love_story"><p className="invitation-renderer-kicker">{copy.story}</p><ol className="invitation-renderer-story">{content.optional.loveStory.milestones.map((milestone) => <li key={`${milestone.title}-${milestone.date ?? ""}`}><strong>{milestone.title}</strong>{milestone.date && <span>{milestone.date}</span>}{milestone.description && <p>{milestone.description}</p>}</li>)}</ol></OptionalSection>,
    gallery: null,
    music: null,
    gift: null,
    rsvp: null,
    guestbook: null,
  };
  const order = content.sectionOrder ?? ["couple", "events", "opening_closing", "love_story"];
  const rendered = order.map((section) => sections[section]).filter(Boolean);
  return rendered.length > 0 ? rendered : events.length > 0 ? [sections.events] : [];
}

export function InvitationThemeView({ invitation, theme }: InvitationThemeViewProps) {
  const copy = labels[invitation.language];
  const accentColor = theme.definition.accentOptions.find(({ id }) => id === theme.config.accent)?.color ?? theme.definition.preview.accentColor;
  const style = {
    "--invitation-background": theme.definition.preview.backgroundColor,
    "--invitation-foreground": theme.definition.preview.foregroundColor,
    "--invitation-accent": accentColor,
  } as CSSProperties;

  return (
    <article
      className={`invitation-renderer invitation-theme-${theme.definition.id} invitation-cover-${theme.config.coverStyle} invitation-sections-${theme.config.sectionStyle} ${fontClasses[theme.config.fontPairing]}`}
      data-theme={theme.definition.id}
      data-accent={theme.config.accent}
      data-theme-fallback={theme.usedFallback ? "true" : "false"}
      style={style}
    >
      <header className="invitation-renderer-cover">
        <p className="invitation-renderer-kicker">{copy.invitation}</p>
        <p className="invitation-renderer-script">{copy.withLove}</p>
        <h1><span>{invitation.content.core.coupleDisplayName1}</span><span aria-hidden="true">&amp;</span><span>{invitation.content.core.coupleDisplayName2}</span></h1>
        {invitation.events[0] && <p className="invitation-renderer-date">{formatDate(invitation.events[0].startsAt, invitation.events[0].timezone || invitation.timezone, invitation.language)}</p>}
      </header>
      <div className="invitation-renderer-sections">
        {renderOptionalSections(invitation.content, invitation.events, invitation.timezone, invitation.language)}
        {invitation.content.optional.hashtag && <p className="invitation-renderer-hashtag">{invitation.content.optional.hashtag}</p>}
      </div>
      <footer className="invitation-renderer-footer">{theme.definition.name}</footer>
    </article>
  );
}
