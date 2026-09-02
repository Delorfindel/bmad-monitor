# BMAD Sprint Monitor

A static web portal for **one BMAD sprint of one project**: a pilot-oriented dashboard on `/`, and
a documentation browser for the epics and stories that the sprint declares.

It reads a monitored GitHub repository **at build time only**, over the REST API, with a read-only
token that never leaves the build. The result is a plain static site you can host on Vercel.

<!-- ------------------------------------------------------------------ -->

## 1. What it does

- Reads **one** `sprint-status.yaml` — the file named by `BMAD_SPRINT_STATUS` — and treats it as the
  only authority on scope.
- Shows every epic and every story it declares, **in file order**, whatever their status
  (`backlog`, `ready-for-dev`, `in-progress`, `review`, `done`).
- Resolves `story_location` and `planning_source`, downloads the story Markdown and the planning
  document, and extracts each epic's planning section.
- Surfaces the **human context** written in the YAML comments — a pause, a supplier blocker, a
  resume instruction — while ignoring the generic BMAD status definitions that ship in every file.
- Follows the Markdown documents those artefacts explicitly reference, and publishes them too.
- Renders story pages faithfully: acceptance criteria, task checklists, Dev Notes, tables, code
  blocks, Mermaid diagrams, File List, Change Log.
- Ships a sidebar carrying a status on every entry, a per-page table of contents, sequential
  navigation in sprint order, and local search scoped to this sprint only.
- Reports what it could not read — a missing story file, an unknown status value, a broken
  reference — in the build log, in the generated model, and in the interface.

## 2. What it does not do

- **No multi-project dashboard.** One deployment monitors one project's one sprint.
- **No project selector, no tenants, no database, no application accounts, no login.**
- **No writes, ever**, to the monitored repository. It is opened read-only; no BMAD file is
  modified, reformatted or enriched, and nothing is installed in the monitored project.
- **No runtime GitHub access.** The browser never talks to GitHub; there is no proxy endpoint and no
  token in the client bundle.
- **No archive of all BMAD artefacts.** `_bmad-output` is never scanned wholesale, and past sprints
  are neither published nor indexed.

## 3. Architecture: one deployment, one project

The codebase is generic and reusable; each deployment is configured by environment variables.

```
this repository ──> Vercel deployment A   (BMAD_REPOSITORY=acme/elite-force,  sprint-4)
                ──> Vercel deployment B   (BMAD_REPOSITORY=acme/skills,       sprint-9)
                ──> Vercel deployment C   (BMAD_REPOSITORY=acme/skeellz,      sprint-6)
```

`/` is that deployment's dashboard. There is nothing above it.

The dashboard lives in **its own repository** — this one. It is never added to the monitored
projects, and the monitored projects never depend on it.

### Build pipeline

```
npm run sync-content
  ├─ validate the environment
  ├─ resolve BMAD_REF to a commit SHA        ← done once
  ├─ read sprint-status.yaml at that SHA
  ├─ parse it twice: YAML for data, raw text for comments
  ├─ read the stories, the planning source, the referenced documents, the images
  ├─ write .generated/data/*.json  (typed model)
  ├─ write .generated/site/**.md   (one page per route)
  └─ refuse to continue if anything token-shaped reached the output
vitepress build docs
```

Every read after the first uses the resolved SHA, so a push during the build can never mix two
commits into one site. The same SHA produces the same site.

`.generated/` is disposable: git-ignored, regenerated from scratch on each sync, never a source of
authority, never containing a secret.

<!-- ------------------------------------------------------------------ -->

## 4. Quick start — fixture mode, no token, no GitHub

```bash
npm install
cp .env.example .env
```

Then set exactly two variables in `.env`:

```dotenv
BMAD_LOCAL_SOURCE=fixtures/sample-project
BMAD_SPRINT_STATUS=_bmad-output/implementation-artifacts/sprint-12/sprint-status.yaml
```

```bash
npm run dev
```

The fixture is a fully fictional project — three epics, nine stories across all five statuses, a
paused sprint context, a planning source, a linked document, a Mermaid diagram, an image, and one
story whose Markdown file is deliberately absent so you can see the degraded state.

Fixture mode uses exactly the same parsing pipeline as GitHub mode; only the file reader differs.

## 5. Real mode — a private GitHub repository

### 5.1 Create the token

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** →
   *Generate new token*.
2. **Resource owner**: the account or organization that owns the monitored repository.
3. **Repository access**: *Only select repositories* → the monitored repository, and nothing else.
4. **Permissions → Repository permissions → Contents: `Read-only`.** Nothing else is needed.
5. Set an expiry you will actually renew, and copy the token once.

The token is used only by the build. It is sent as an `Authorization: Bearer` header, never placed
in a URL, never written to a generated file, never logged, and never prefixed with `VITE_` or any
other client-exposed prefix. The sync step scans the whole generated tree for it and fails the build
if anything token-shaped is found.

### 5.2 Configure

```dotenv
BMAD_REPOSITORY=acme/skeellz
BMAD_REF=main
BMAD_SPRINT_STATUS=_bmad-output/implementation-artifacts/sprint-6/sprint-status.yaml
GITHUB_TOKEN=github_pat_xxx
```

```bash
npm run build && npm run preview
```

## 6. Environment variables

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `BMAD_SPRINT_STATUS` | **yes** | — | Repository-relative path of the `sprint-status.yaml` that defines this deployment. |
| `BMAD_REPOSITORY` | yes, in GitHub mode | — | Monitored repository as `owner/name`. |
| `GITHUB_TOKEN` | yes, in GitHub mode | — | Fine-grained PAT, `Contents: Read-only` on that repository. |
| `BMAD_REF` | no | `main` | Branch, tag or commit SHA to read. Resolved to a SHA once per build. |
| `GITHUB_API_URL` | no | `https://api.github.com` | API base, for a GitHub Enterprise host. |
| `BMAD_LOCAL_SOURCE` | no | — | When set, reads from this local directory and never contacts GitHub. Takes precedence over GitHub mode. |
| `BMAD_SITE_TITLE` | no | `<project> — <sprint>` | Overrides the browser and navbar title. |
| `BMAD_OUTPUT_DIR` | no | `.generated` | Output directory, **relative to this project** (Vite resolves modules from it). |
| `BMAD_CONCURRENCY` | no | `6` | Maximum GitHub requests in flight. |
| `BMAD_MAX_LINKED_DOCUMENTS` | no | `40` | Cap on published referenced documents. |
| `BMAD_MAX_ASSETS` | no | `60` | Cap on downloaded images. |
| `BMAD_MAX_ASSET_BYTES` | no | `5242880` | Per-image size limit. |
| `BMAD_LOG_LEVEL` | no | `info` | `debug` for a more verbose sync. |

Every variable is validated before the first network call, with an error that names the variable at
fault and never echoes the token.

## 7. Deploying to Vercel

1. Push this repository to GitHub and import it in Vercel.
2. **Framework preset**: *Other* — `vercel.json` already sets everything.
   - Build command: `npm run build`
   - Output directory: `docs/.vitepress/dist`
   - Install command: `npm ci`
3. **Node.js version**: 20.x or later (Project Settings → General → Node.js Version). The build uses
   the global `fetch` and requires Node ≥ 20.19.
4. **Environment variables** (Project Settings → Environment Variables), for Production *and*
   Preview: `BMAD_REPOSITORY`, `BMAD_REF`, `BMAD_SPRINT_STATUS`, `GITHUB_TOKEN`.
   Mark `GITHUB_TOKEN` as sensitive. Do **not** prefix any of them with `VITE_`.
5. Deploy. To monitor a second project, create a **second Vercel project** from the same repository
   with different variables.

### 7.1 Rebuilding when the monitored project changes

Vercel does not watch the monitored repository, so a push there does not rebuild this portal.
Optional wiring:

```
push to the monitored repository
  → GitHub webhook (or a workflow step)
  → Vercel Deploy Hook URL
  → new dashboard build
```

Create the hook in Vercel (Project Settings → Git → Deploy Hooks), then add it to the **monitored**
repository as a webhook or as a `curl` step in a workflow.

**The Deploy Hook URL is a secret**: anyone holding it can trigger builds. Never commit it to this
repository. Store it in the monitored repository's secrets.

A scheduled rebuild (Vercel Cron, or a scheduled workflow calling the hook) is a simpler alternative
when near-real-time freshness is not required.

### 7.2 Protecting internal documents

**Private GitHub artefacts become static content of the Vercel deployment.** Anyone who can open the
deployment URL can read every published story and document.

If the sprint documentation must not be public, enable the deployment protection your Vercel plan
offers — Vercel Authentication, Password Protection, or Trusted IPs (Project Settings →
Deployment Protection) — before sharing the URL. This portal has no login of its own by design.

### 7.3 When the build fails

**`<owner>/<repo> is not visible with the configured GITHUB_TOKEN`**

GitHub answers `404`, not `403`, for a private repository the credentials cannot see — it refuses to
confirm that the repository exists at all. So this almost always means the token, not the name.
The build lists the checks in order; the two that catch most cases:

- **The token's resource owner must be the organization**, not your personal account. A fine-grained
  token created under your own account can never reach `acme/…` repositories, however many
  permissions you tick. Regenerate it with the organization selected as resource owner.
- **The organization must allow fine-grained tokens, and an owner must approve the request**
  (Organization settings → Personal access tokens). While a request is pending, the token behaves
  exactly as if it had no access at all.

**`BMAD_REF is "x", which does not exist`**

The branch, tag or SHA is wrong. The message names the repository's default branch. Note that the
default branch is often `master` or `main` while the branch you actually want is the integration
one — the portal is usually more useful pointed at the branch where BMAD artefacts land first.

**`Sprint status not found: … Check BMAD_SPRINT_STATUS`**

The repository and the ref are fine, but that path does not exist *on that ref*. A sprint folder
that exists on `dev` may not exist yet on `master`.

**`GitHub rate limit reached`**

The build fails with the reset time rather than waiting. Re-run it after that time.

<!-- ------------------------------------------------------------------ -->

## 8. How the sprint is read

### Scope

Every key under `development_status` belongs to the sprint. Keys are recognised by shape:

| Shape | Pattern | Example |
| --- | --- | --- |
| Epic | `^epic-\d+$` | `epic-41` |
| Retrospective | `^epic-\d+-retrospective$` | `epic-41-retrospective` |
| Story | `^\d+-\d+[a-z]?-.+` | `41-3a-search-candidates` |

File order is preserved: it is the sprint's own logical order, and it drives the sidebar and the
previous/next links. A key that matches nothing, or a status value outside the BMAD vocabulary,
produces a visible warning rather than a silent drop.

### Story files

For each story key, `{story_location}/{key}.md` is tried first, then
`{story_location}/story-{key}.md`. A story with no file is still shown — with its sprint status and
an explicit notice — because the sprint status, not the filesystem, defines the scope.

### Epic pages

The section describing the epic is extracted from `planning_source`. Planning documents usually name
each epic twice — once in an "Epic List" summary, once as the real section — so the richest match
wins, and the section ends at the next heading of the same level or higher. If extraction fails, the
epic page degrades to its story list plus a warning instead of failing the build.

### Comments and referenced documents

A YAML parser discards comments, so the file is also read as raw text. Comment blocks are split on
their banner (a line underlined by an ASCII rule) and classified:

- **Sprint context** — a pause, a blocker, a resume instruction. Shown at the top of the dashboard,
  with a tone (`paused` / `blocked` / `note`) inferred from its wording.
- **Generic BMAD definitions** — `STATUS DEFINITIONS`, `WORKFLOW NOTES`, and any block that is
  mostly a `status: description` list. Never shown as a product notice.

An inferred operational state is presented as additional information. It never replaces or modifies
a BMAD status: the dashboard shows both, and the sprint status always wins.

Markdown paths named by the sprint status, the planning source or a story are followed and
published. Two spellings are supported, because BMAD authors use both: a Markdown link resolves
relative to its own file, a bare or backticked path resolves from the repository root — whichever
actually exists is kept. Backticked paths that resolve to a published page become links, with their
text unchanged.

### Path safety

Every path coming out of YAML or Markdown is untrusted. Paths are normalised to POSIX
repository-relative form; absolute paths, Windows drives, protocols, backslashes, null bytes and any
`..` that escapes the root are rejected outright. The build never reads outside the monitored
repository, and the fixture reader re-checks resolved paths against its root.

## 9. Design

The interface uses the **Noir** design system. One rule holds it together: *nothing is separated by
a line* — two things are separated because one is laid on the other. Seven fill planes replace the
usual border levels, selection is a filled pill, what is "not yet real" is hatched, and the label /
value size ratio carries the hierarchy.

Accessibility is treated as part of the design, not a pass afterwards:

- No status is ever conveyed by colour alone — every badge, dot, sidebar entry and progress segment
  carries a word, and `backlog` also carries a texture.
- Light and dark themes are both fully defined; no colour exists only inside a media query.
- Focus is visible everywhere, epics collapse with native `<details>`, and the sidebar is keyboard
  reachable.
- `prefers-reduced-motion` is honoured; there are no decorative animations.

## 10. Project layout

```
src/
├── config/env.ts          environment validation, secret redaction
├── github/                GitHub REST client, fixture reader, one shared interface
├── bmad/                  pure parsers: sprint status, statuses, stories, planning, references
├── generation/            collection, page generation, navigation, secret scan
├── shared/                paths, concurrency, text, logging
└── cli/sync-content.ts    the build-time entry point

docs/.vitepress/
├── config.ts              loads the generated model into themeConfig
├── markdown/task-lists.ts renders BMAD checklists
└── theme/                 Noir tokens, styles, and the Vue components

fixtures/sample-project/   a fictional BMAD project, used by dev and by the tests
tests/                     unit tests per module, plus one end-to-end pipeline test
.generated/                regenerable output — git-ignored
```

No parsing happens in a Vue component: components read the typed model that the build produced.

## 11. Scripts

| Command | What it does |
| --- | --- |
| `npm run sync-content` | Reads the sprint and regenerates `.generated/`. |
| `npm run dev` | Sync, then the VitePress dev server. |
| `npm run build` | Sync, then the production build into `docs/.vitepress/dist`. |
| `npm run preview` | Serves the last production build. |
| `npm test` | Unit tests plus the end-to-end pipeline test (which runs a real VitePress build). |
| `npm run typecheck` | `vue-tsc --noEmit`, strict. |
| `npm run lint` | ESLint, type-aware. |
| `npm run verify` | Lint, typecheck, test, build. |
| `npm run clean` | Removes `.generated/`. |

## 12. Known limitations

- **The site is a snapshot.** It reflects the commit resolved at build time; it does not update on
  its own. See §7.1.
- **A story's Markdown is rendered, not validated.** Two constructs are neutralised because
  VitePress compiles Markdown as a Vue template: `{{ … }}` and tags whose name is not standard HTML
  (`<owner>/<repo>`). They are replaced by HTML entities, so they still *read* exactly as written.
- **Fixture mode has no external URLs.** A link to a file that is not published has nowhere to point
  and degrades to plain text; in GitHub mode it becomes a blob link at the pinned SHA.
- **Only referenced images are downloaded**, and only from included documents. Other binary assets
  (PDFs, videos) are linked to GitHub rather than copied.
- **Reference following is one level deep** — from the sprint status, the planning source and the
  stories. Documents referenced only by another referenced document are not published.
- **`BMAD_OUTPUT_DIR` must stay inside this project**, because Vite resolves modules from the
  generated site directory.
- **GitHub Enterprise is untested.** `GITHUB_API_URL` exists so the client can be pointed elsewhere,
  but no Enterprise-specific behaviour is implemented.
- **Rate limits are reported, not worked around.** A rate-limited build fails with the reset time
  rather than waiting.

## 13. Credits

The product shape — a sprint dashboard driven by `sprint-status.yaml`, with segmented progress and a
per-epic story list — is inspired by
[the-whisker-studio/bmad-dash](https://github.com/the-whisker-studio/bmad-dash) (MIT). This is an
independent implementation: no code was copied, and the target is a static web deployment rather
than a VS Code extension.

BMAD Method artefacts are the property of the projects that produce them; this tool only reads them.

Licensed under the MIT licence — see [LICENSE](LICENSE).
