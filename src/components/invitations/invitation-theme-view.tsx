"use client";

import type { CSSProperties, ReactNode } from "react";

import type {
  InvitationContent,
  InvitationRenderData,
  InvitationRenderEvent,
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
  const sections: Record<string, ReactNode> = {
    opening_closing: (content.optional.opening || content.optional.closing) && <OptionalSection key="opening_closing">{content.optional.opening && <p className="invitation-renderer-lede">{content.optional.opening}</p>}{content.optional.closing && <p className="invitation-renderer-lede">{content.optional.closing}</p>}</OptionalSection>,
    fullNames: content.optional.fullNames && <OptionalSection key="fullNames"><p>{content.optional.fullNames.person1}</p><p>{content.optional.fullNames.person2}</p></OptionalSection>,
    parentFields: content.optional.parentFields && <OptionalSection key="parentFields"><p className="invitation-renderer-kicker">{copy.parents}</p><p>{[content.optional.parentFields.person1?.father, content.optional.parentFields.person1?.mother].filter(Boolean).join(" & ")}</p><p>{[content.optional.parentFields.person2?.father, content.optional.parentFields.person2?.mother].filter(Boolean).join(" & ")}</p></OptionalSection>,
    events: events.length > 0 && <OptionalSection className="invitation-renderer-events" key="events"><p className="invitation-renderer-kicker">{copy.events}</p><ul>{events.map((event) => <EventCard event={event} language={language} timezone={timezone} key={event.id} />)}</ul></OptionalSection>,
    love_story: content.optional.loveStory && <OptionalSection key="love_story"><p className="invitation-renderer-kicker">{copy.story}</p><ol className="invitation-renderer-story">{content.optional.loveStory.milestones.map((milestone) => <li key={`${milestone.title}-${milestone.date ?? ""}`}><strong>{milestone.title}</strong>{milestone.date && <span>{milestone.date}</span>}{milestone.description && <p>{milestone.description}</p>}</li>)}</ol></OptionalSection>,
    quote: content.optional.quoteOrPrayer && <OptionalSection key="quote"><p className="invitation-renderer-kicker">{copy.quote}</p><blockquote>{content.optional.quoteOrPrayer}</blockquote></OptionalSection>,
  };
  const order = content.sectionOrder ?? ["opening_closing", "fullNames", "parentFields", "events", "love_story", "quote"];
  const rendered = order.map((section) => sections[section]).filter(Boolean);
  return rendered.length > 0 ? rendered : events.length > 0 ? [sections.events] : [];
}

export function InvitationThemeView({ invitation, theme }: InvitationThemeViewProps) {
  const copy = labels[invitation.language];
  const style = {
    "--invitation-background": theme.definition.preview.backgroundColor,
    "--invitation-foreground": theme.definition.preview.foregroundColor,
    "--invitation-accent": theme.definition.preview.accentColor,
  } as CSSProperties;

  return (
    <article
      className={`invitation-renderer invitation-theme-${theme.definition.id} invitation-cover-${theme.config.coverStyle} invitation-sections-${theme.config.sectionStyle} ${fontClasses[theme.config.fontPairing]}`}
      data-theme={theme.definition.id}
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
