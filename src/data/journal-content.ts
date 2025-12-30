export type QuickFilter = {
  label: string;
  query: string;
};

export type Masthead = {
  eyebrow: string;
  title: string;
  subhead: string;
  note: string;
};

export type JournalContent = {
  masthead: Masthead;
  quickFilters: QuickFilter[];
  search: {
    placeholder: string;
    hint: string;
  };
};

export const journalContent: JournalContent = {
  masthead: {
    eyebrow: "STUDIO JOURNAL",
    title: "Fragments, photo walls, and the ops log.",
    subhead:
      "Notes piped in from analog notebooks, Mastodon dispatches, Bluesky tinkering, and the local writing bench.",
    note: "Latest tags: #journal · #ops · #photos · #fieldwork",
  },
  quickFilters: [
    { label: "All entries", query: "" },
    { label: "Photos", query: "type:photo" },
    { label: "Link drops", query: "type:link" },
    { label: "Mastodon crossposts", query: "source:mastodon" },
    { label: "Studio-only drafts", query: "source:local" },
  ],
  search: {
    placeholder: 'Search… (try "tag:journal" or "source:mastodon")',
    hint: 'Supports filters like tag:photos · type:link · source:bluesky',
  },
};
