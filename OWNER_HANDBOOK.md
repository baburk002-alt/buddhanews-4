# Buddha News — owner and editor handbook

This is the day-to-day guide. It assumes the site is published and you are signed in at `/admin`.

## 1. First sign-in and access

1. Open `https://your-site/admin`.
2. Choose **Continue with Manus** and use the account that owns the project.
3. The account whose email is in `ADMIN_EMAILS` gets the **Admin** role. `EDITOR_EMAILS` gives the **Editor** role (draft/edit only). Allowlists are read on every request, so adding or removing an address takes effect on the next request without waiting for a cookie to expire.
4. You should see **Newsroom overview** with story counts, views, subscribers, inbox and the latest security events.

The **Owner** is the account whose OpenID matches `OWNER_OPEN_ID`; only that account can change other users' roles, and it cannot demote itself. If the dashboard says “not authorized,” the account is not on an allowlist; do not create a public “first user becomes admin” workaround.

## 2. The dashboard

The dashboard gives you a quick pulse:

- **Published / drafts / archived** story counts.
- **Views** across published stories.
- **Subscribers** and unread messages.
- **Most read** stories.
- **Security events** — a short preview of the audit log.
- Quick actions to write a story, upload media, open the inbox or review security.

## 3. Writing and publishing a story

Open **Stories → New story**.

1. **Language tabs.** Write the English version first. Then switch to **پښتو** and **دری**.
2. **Headline.** Be specific. Avoid vague or clickbait phrasing.
3. **Summary.** Two sentences that tell the reader what changed and why it matters.
4. **Body.** Markdown is supported:
   - `## Heading` for a section.
   - `> Quote` for a pull quote.
   - `- item` for a bullet list.
   - `**bold**` and `[link](https://example.com)`.
   - Leave a blank line between paragraphs.
5. **AI tools.** In the editor you can ask Buddha AI for five headlines, a summary, SEO fields, tags, or a first translation. AI output is a draft. Check every name, number, date, quote and local idiom before using it. The translation button is especially useful for a first pass, not for publication without review.
6. **Metadata.**
   - Category and subcategory. Subcategories are scoped to their parent category, so “Women” under Afghanistan does not mix with “Women” elsewhere.
   - Author byline (defaults to “BMG Desk” if left blank).
   - Read time in minutes.
   - Cover image and alt text. Alt text should describe what a reader sees, not repeat the headline.
   - Tags, featured and breaking flags.
7. **Status.**
   - `draft` — private working copy, not on the public site.
   - `published` — visible on the public site.
   - `archived` — hidden from normal listings; keep it for the record.
8. **Save.** Use **Save story** at the bottom of the editor. Publishing is a separate status choice; saving a draft does not put it live.

There is no scheduled-publishing control in this version. Publish manually at the intended time.

## 4. Media library

Open **Media**.

- Upload JPEG, PNG, WebP, GIF or AVIF up to 5 MB.
- The file is checked by extension, MIME type and magic bytes.
- Give every image useful alt text. Purely decorative images should not be uploaded as story covers.
- Copy the image URL into a story, or choose **Use image** from the editor’s media picker.
- Delete unused assets to keep the library tidy. Deleting the database record does not necessarily delete the stored object; treat the storage provider as the source of truth for binary cleanup.

**Editorial images:** the demonstration stories use AI-generated illustrations. Replace them with your own photography or clearly label generated imagery in the caption, consistent with the Editorial Policy page.

## 5. Inbox and tip line

Open **Inbox** to read contact messages and confidential tips.

- Messages show the sender, subject, time and body.
- Mark a message read after you have handled it.
- Do not forward a tip to a third party without the source’s consent.
- The tip form is a secure **submission inbox**, not end-to-end encrypted chat. For high-risk sources, use a verified Signal account and a published key fingerprint. Add that number in **Settings** only when it is real.

## 6. Subscribers

Open **Subscribers** to see newsletter sign-ups and export a CSV.

- Signups start as **pending** and only become **subscribed** after the reader clicks the emailed confirmation link. Do not export or mail pending addresses.
- The site stores the email, locale and confirmation state and sends the confirmation mail through your configured channel (`EMAIL_WEBHOOK_URL` or SMTP). Until one is configured, mail stays queued and nobody can confirm. CSV exports are safe to open in Excel/Sheets: risky cells are neutralised.
- Connect an email provider (Mailchimp, Buttondown, Resend, etc.) to send the newsletter.
- Every confirmation and welcome message includes a signed unsubscribe link. Keep an unsubscribe link in every campaign you send from another provider too.
- Export only when needed and store the CSV securely.

## 7. Settings

Open **Settings** to change:

- Site name and tagline.
- Contact email (replace the `.example` placeholder).
- Live stream URL (YouTube or another embeddable URL). Leave blank to show the “live desk” without a broken player.
- Verified Signal number for the tip page. Leave blank if you do not have one.
- Announcement banner text.
- Default social-sharing image.

Saving settings writes an audit entry.

## 8. Security log

Open **Security log** to review privileged actions.

- Filter or scan for unexpected sign-ins, story deletions, settings changes, exports or AI actions.
- Review weekly and after any access change.
- If you see an action you did not authorize: remove the account from `ADMIN_EMAILS`/`EDITOR_EMAILS`, set its role to `user`, revoke its sessions (`UPDATE sessions SET revokedAt = NOW() WHERE userId = ?`), preserve the log, and follow the incident checklist in the Security Guide. Rotate `MANUS_JWT_SECRET` only if you suspect the signing key itself leaked.

## 9. AI desk

The public **Ask Buddha AI** drawer answers from recent newsroom headlines and the story the reader is viewing. It is instructed not to invent facts and to say when the record is thin. It is still a language model:

- Do not treat an AI answer as a correction or a source.
- The 60-second brief is generated from the article only and labelled as AI.
- AI actions are rate-limited and audited.
- The assistant is not a substitute for a human editor, lawyer, doctor or financial adviser.

## 10. Routine maintenance

### Daily

- Check the inbox and tip line.
- Review the homepage for broken images or stale lead stories.
- Publish or update the lead story.

### Weekly

- Review the security log.
- Check the most-read list and category pages.
- Clear drafts that are no longer needed.
- Check that the live stream URL still works.

### Monthly

- Export a database backup and confirm it is readable.
- Review administrator access.
- Update dependencies in a staging copy, run `pnpm check` and `pnpm build`, then deploy.
- Check Google Search Console for coverage and mobile usability issues.
- Review AI outputs and correct any recurring translation problems.

### Quarterly

- Restore a backup into a staging database.
- Rotate non-essential API keys.
- Review privacy/editorial policies against actual practice.
- Ask a second person to review access and publishing permissions.

## 11. Content standards

- Attribute claims to a named source or explain why anonymity was granted.
- Do not publish a photo of a real person as an AI-generated illustration.
- Correct errors openly; do not silently rewrite a published story. Add a correction note and update the timestamp.
- Keep headlines and summaries consistent with the body.
- Respect source safety: remove locations, names and identifying details when publication could endanger someone.
- Do not use the AI assistant to generate quotes or sources.

## 12. When something breaks

| Symptom | First check |
| --- | --- |
| Site returns 500 | Hosting logs; database connection; recent deploy |
| Images missing | Storage URL; whether the asset still exists in managed storage |
| Login loops | Manus OAuth callback URL; `PUBLIC_SITE_URL`; whether the browser accepts the first-party `HttpOnly` session cookie |
| Article shows homepage title in search | `PUBLIC_SITE_URL` is set; rebuild and redeploy |
| AI returns an error | Manus API key/service availability; rate limit message |
| Contact/tip form fails | Rate limit; database; spam filter |
| “Not authorized” | `ADMIN_EMAILS` / `EDITOR_EMAILS`; the account's current email; role in database |

For a production incident, use the Security Guide’s containment and recovery checklist before making broad changes.

## 13. Before you go live

Open **Admin > Dashboard**: the *Launch checklist* card lists everything that still
blocks or weakens a launch. The same list is printed at server start and by
`pnpm launch:check`. Work through it:

**Admin > Settings (no restart needed)**
- `contactEmail` - the real, monitored newsroom address (shown on Contact, Privacy, footer, structured data).
- `ogImage` - a real 1200x630 image (not a `/manus-storage/async-images/...` placeholder).
- `tipSignal` - your Signal number/link, or leave empty to hide the promise.
- `youtubeUrl`, `twitterUrl`, `facebookUrl` - social profiles (the footer hides empty ones).
- `liveStreamUrl` and `announcement` - clear or replace the demo values.

**Server environment (needs a restart)**
- `PUBLIC_SITE_URL`, `ADMIN_EMAILS`, `OWNER_OPEN_ID`.
- Email: `EMAIL_WEBHOOK_URL` + `EMAIL_WEBHOOK_TOKEN`, or `SMTP_URL` (or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`), plus `NEWSLETTER_FROM_EMAIL`.
- Bot protection: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.
- More than one server instance: `REDIS_URL` (or edge rate limits), `TRUST_PROXY`, `CLIENT_IP_HEADER`.
- `SEED_ON_START` must be `false`.

**Content**
- Unpublish or delete the labelled demonstration stories.

**Scheduling**
- Nothing to do on an always-on server: cleanup runs daily and mail every minute.
- On a host that sleeps when idle: set `DISABLE_INTERNAL_SCHEDULER=true` and add two platform cron jobs running
  `node dist/maintenance.js` once a day and `node dist/maintenance.js --mail` every 10 minutes.
- Optional: `ENFORCE_LAUNCH_CHECKS=true` makes the server refuse to start while blockers remain.
