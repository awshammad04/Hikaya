# Database Schema Draft

> **Status:** this is the Sprint 1 design draft. It was implemented in Sprint 2 as
> [`schema.sql`](schema.sql), with seed data in [`seed.sql`](seed.sql). The
> implementation follows this draft and adds review-status columns, media licensing
> fields, AI uncertainty notes, indexes and `updated_at` triggers — see
> [`README.md`](README.md) for the differences.

## Main Tables

### users

**Primary Key:** `id`

**Attributes:**
- `id`
- `full_name`
- `email`
- `password_hash`
- `role`
- `created_at`
- `updated_at`

---

### locations

**Primary Key:** `id`

**Attributes:**
- `id`
- `name`
- `city`
- `country`
- `latitude`
- `longitude`
- `description`
- `created_at`
- `updated_at`

---

### stories

**Primary Key:** `id`

**Foreign Keys:**
- `location_id` → `locations.id`
- `author_id` → `users.id`

**Attributes:**
- `id`
- `location_id`
- `author_id`
- `title`
- `original_content`
- `simplified_story`
- `source`
- `status`
- `created_at`
- `updated_at`

---

### media

**Primary Key:** `id`

**Foreign Key:**
- `location_id` → `locations.id`

**Attributes:**
- `id`
- `location_id`
- `type`
- `url`
- `description`
- `uploaded_at`

---

### contributions

**Primary Key:** `id`

**Foreign Keys:**
- `user_id` → `users.id`
- `location_id` → `locations.id`

**Attributes:**
- `id`
- `user_id`
- `location_id`
- `content`
- `media_url`
- `status`
- `submitted_at`

---

### categories

**Primary Key:** `id`

**Attributes:**
- `id`
- `name`
- `description`

---

### location_categories

**Primary Key:** (`location_id`, `category_id`)

**Foreign Keys:**
- `location_id` → `locations.id`
- `category_id` → `categories.id`

**Attributes:**
- `location_id`
- `category_id`

---

# Relationships

- One **User** can create many **Stories**.
- One **User** can submit many **Contributions**.
- One **Location** can have many **Stories**.
- One **Location** can have many **Media** items.
- One **Location** can receive many **User Contributions**.
- A **Location** can belong to multiple **Categories**.
- A **Category** can include multiple **Locations**.
