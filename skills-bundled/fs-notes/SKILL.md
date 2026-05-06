---
name: fs-notes
description: Read and write Markdown notes inside the working directory. Used by the model to "write down critical information" mid-session.
version: 0.1.0
whenToUse: When the user wants you to remember a fact across turns, jot scratch notes, or persist intermediate results that should outlive the session.
instructions: |
  - Notes live under `.medianode/notes/` inside the working directory by default.
  - Always pass a relative path; the script will reject absolute paths.
  - Use `note_write` for create/overwrite, `note_append` to add to an existing
    note, `note_read` to fetch one back, `note_list` to see what exists.
tools:
  - name: note_write
    description: Create or overwrite a Markdown note in `.medianode/notes/`.
    script: scripts/note.ts
    params:
      action: { type: string, const: write }
      path: { type: string, description: relative path under .medianode/notes/ }
      content: { type: string }
    required: [action, path, content]
  - name: note_append
    description: Append content to an existing Markdown note.
    script: scripts/note.ts
    params:
      action: { type: string, const: append }
      path: { type: string }
      content: { type: string }
    required: [action, path, content]
  - name: note_read
    description: Read a Markdown note.
    script: scripts/note.ts
    params:
      action: { type: string, const: read }
      path: { type: string }
    required: [action, path]
  - name: note_list
    description: List notes under `.medianode/notes/`.
    script: scripts/note.ts
    params:
      action: { type: string, const: list }
---

# fs-notes

A simple persistent notebook the agent can use to keep working memory
across turns. Stays under `.medianode/notes/` so it travels with the
project.
