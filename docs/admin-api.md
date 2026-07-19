# WebVerse Admin API

The future admin frontend must call the existing WebVerse API. It must never connect to Supabase with a service-role key from the browser.

## Environment

- `ADMIN_JWT_SECRET`: separate long random secret for administrator sessions
- `ADMIN_EMAIL`: email used to create the first administrator
- `ADMIN_PASSWORD`: initial administrator password (must not be empty)
- `ADMIN_NAME`: display name for the first administrator
- `WEB_ORIGIN`: comma-separated WebVerse and admin frontend origins

The seed creates the administrator only when the configured email does not exist. Later deploys do not reset its password.

## Authentication

- `POST /api/admin/auth/login`
- `GET /api/admin/me`
- `PATCH /api/admin/me/password`

All protected requests use `Authorization: Bearer <admin-token>`. Administrator tokens expire after 8 hours and cannot be used as normal user tokens.

## Dashboard

- `GET /api/admin/overview`
- `GET /api/admin/categories`
- `GET /api/admin/requests?status=REQUESTED&page=1&limit=30`
- `GET /api/admin/requests/:requestId`
- `GET /api/admin/audit-logs?page=1&limit=30`

## Decisions

Approve a request:

```http
POST /api/admin/requests/:requestId/approve
Content-Type: application/json

{
  "categoryId": "category-id"
}
```

The optional fields `name`, `description`, `faviconUrl`, and `themeColor` can correct collected metadata during approval. Approval does not store a reason or note.

Reject a request:

```http
POST /api/admin/requests/:requestId/reject
Content-Type: application/json

{
  "reason": "required rejection reason"
}
```

Rejection changes the site to `REJECTED_PRIVATE`. The required reason is visible only to users who already have the site in their universe. Existing users keep it in their universe, but it remains excluded from the public catalog, categories, and constellations.
