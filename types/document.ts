export interface Document {
  id: string;
  user_id: string;
  title: string;
  is_archived: boolean;
  parent_document: string | null;
  content: string | null;
  cover_image: string | null;
  icon: string | null;
  is_published: boolean;
  sort_order: number | null;
  updated_at: string | null;
  is_favorite: boolean;
  editor_font: string | null;
  full_width: boolean;
  small_text: boolean;
  show_toc: boolean;
  notion_source_id: string | null;
  created_at: string;
  space_type: "personal" | "public";
  is_shared: boolean;
}

export interface UserSettings {
  id: string;
  user_id: string;
  editor_font: string | null;
  focus_mode: boolean;
  created_at: string;
  updated_at: string;
}
