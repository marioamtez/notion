export const documentKeys = {
  sidebarAll: ["documents", "sidebar"] as const,
  sidebar: (parentId?: string) =>
    ["documents", "sidebar", parentId ?? "root"] as const,
  search: () => ["documents", "search"] as const,
  trash: () => ["documents", "trash"] as const,
  favorites: () => ["documents", "favorites"] as const,
  detail: (id: string) => ["documents", "detail", id] as const,
};

export const userSettingsKeys = {
  detail: (userId: string) => ["userSettings", userId] as const,
};
