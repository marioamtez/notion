# Zotion

This project is a simplified clone of the popular productivity application, Notion. It's designed to replicate some of the core features of Notion, providing a platform where users can create, edit, and organize their notes in a flexible and intuitive interface.

It uses Supabase Postgres as the backend to store documents and user settings. The application also uses Edgestore, a distributed key-value store, to manage the images and files uploaded by the users. User authentication is handled by Supabase Auth, shared with the Mbrand AI project so only existing Mbrand AI users can sign in.

## Live

Zotion - [https://zotion-app.vercel.app/](https://zotion-app.vercel.app/)

## Features

### Productivity and Organization

- 📝 Notion-style editor for seamless note-taking
- 📂 Infinite children documents for hierarchical organization
- 🖐️ Drag-and-drop reordering for intuitive file management
- ⭐ Pin important documents for quick access
- ➡️🔀⬅️ Expandable and fully collapsible sidebar for easy navigation
- 🎨 Customizable icons for each document, updating in real-time
- 🗑️ Trash can with soft delete and file recovery options

### User Experience

- 🌓 Light and Dark mode to suit preferences
- 📱 Full mobile responsiveness for productivity on the go
- 🛬 Landing page for a welcoming user entry point
- 🖼️ Cover image for each document to add a personal touch

### Data Management

- 🔄 Real-time database for instant data updates
- 📤📥 File upload, deletion, and replacement options

### Security and Sharing

- 🔐 Authentication to secure notes
- 🌍 Option to publish your note to the web for sharing

## Technologies

![NextJS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![Shadcn-ui](https://img.shields.io/badge/shadcn/ui-000000.svg?style=for-the-badge&logo=shadcn/ui&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=TypeScript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC.svg?style=for-the-badge&logo=Tailwind-CSS&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E.svg?style=for-the-badge&logo=supabase&logoColor=white)
![Edgestore](https://img.shields.io/badge/Edgestore-a57fff.svg?style=for-the-badge&logo=Edgestore&logoColor=white)
![Blocknote](https://img.shields.io/badge/Blocknote-ff8c00.svg?style=for-the-badge&logo=Blocknote&logoColor=white)
![dnd-kit](https://img.shields.io/badge/dnd--kit-000000?style=for-the-badge&logo=react&logoColor=white)

## Installation

1. Clone the repository
2. Install the dependencies

```
npm install
```

3. Set up the environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

EDGE_STORE_ACCESS_KEY=
EDGE_STORE_SECRET_KEY=

// server-only, never exposed to the client. Used by scripts/migrate-notion.mts
// and by the /admin/users page (lib/supabase/admin.ts) to list Supabase Auth
// users. Access to /admin/users is restricted to the emails in lib/adminEmails.ts.
SUPABASE_SERVICE_ROLE_KEY=
```

Authentication is shared with Mbrand AI: only users that already exist in
that Supabase project's `auth.users` can sign in here — there is no sign-up
flow in this app.

Before first use, paste `supabase/schema.sql` into that Supabase project's
Dashboard → SQL Editor and run it once — it creates the `documents` and
`user_settings` tables, their Row Level Security policies, and the
`archive_document`/`restore_document`/`reorder_documents`/`toggle_favorite`
RPC functions the app depends on.

4. Run the development server

```
npm run dev
```

## Acknowledgements

[CodewithAntonio](https://www.youtube.com/@codewithantonio)
