# BMAD Sprint Monitor

A static portal for one BMAD sprint: a dashboard on `/`, and a documentation browser for the epics
and stories that your `sprint-status.yaml` declares.

It reads a GitHub repository **at build time only**, with a read-only token that never leaves the
build, and produces a plain static site. One deployment monitors one project.

```
sprint-status.yaml  ──>  npm run build  ──>  static site  ──>  Vercel
```

## Quick start

No token and no GitHub account needed — a fictional BMAD project ships with the repo.

```bash
npm install
BMAD_LOCAL_SOURCE=fixtures/sample-project \
BMAD_SPRINT_STATUS=_bmad-output/implementation-artifacts/sprint-12/sprint-status.yaml \
npm run dev
```

## Point it at your repository

Create a **fine-grained** personal access token with the repository's owner as *resource owner*,
`Only select repositories` limited to that repository, and `Contents: Read-only`. Nothing else.

```dotenv
BMAD_REPOSITORY=acme/atlas-portal
BMAD_REF=main
BMAD_SPRINT_STATUS=_bmad-output/implementation-artifacts/sprint-status.yaml
GITHUB_TOKEN=github_pat_xxx
```

```bash
npm run build && npm run preview
```

Copy `.env.example` to `.env` for local work; on Vercel these go in the project's environment
variables.

## Deploy

Import the repository in Vercel and pick **Other** as the framework — `vercel.json` sets the build
command, the output directory and the install command. Set Node.js to 20.x or later, add the four
variables above (mark `GITHUB_TOKEN` sensitive), and deploy.

To monitor a second project, import the same repository into a second Vercel project with different
variables. There is no project selector, by design.

Two things worth knowing:

- **A push to the monitored repository does not rebuild the portal.** Vercel only watches this
  repository. Create a Deploy Hook (Settings → Git → Deploy Hooks) and call it from the monitored
  repository, or rebuild on a schedule. The hook URL is a secret; keep it out of this repository.
- **Private artefacts become public static content.** Anyone with the deployment URL can read every
  published story. Turn on Vercel's Deployment Protection before sharing it — this portal has no
  login of its own.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `BMAD_SPRINT_STATUS` | — | **Required.** Repository-relative path of the sprint status that defines this deployment. |
| `BMAD_REPOSITORY` | — | Monitored repository, `owner/name`. Required unless `BMAD_LOCAL_SOURCE` is set. |
| `GITHUB_TOKEN` | — | Fine-grained PAT, `Contents: Read-only`. Required unless `BMAD_LOCAL_SOURCE` is set. |
| `BMAD_REF` | `main` | Branch, tag or SHA. Resolved to a commit SHA once per build. |
| `BMAD_LOCAL_SOURCE` | — | Read from a local directory instead of GitHub. Takes precedence. |
| `GITHUB_API_URL` | `https://api.github.com` | For a GitHub Enterprise host. |
| `BMAD_SITE_TITLE` | `<project> — <sprint>` | Overrides the site title. |

A few more knobs — `BMAD_OUTPUT_DIR`, `BMAD_CONCURRENCY`, `BMAD_MAX_LINKED_DOCUMENTS`,
`BMAD_MAX_ASSETS`, `BMAD_MAX_ASSET_BYTES`, `BMAD_LOG_LEVEL` — are documented in `.env.example`.
Everything is validated before the first network call, and no error message ever echoes the token.

## Scripts

| | |
| --- | --- |
| `npm run dev` | Sync, then the dev server. |
| `npm run build` | Sync, then the production build into `docs/.vitepress/dist`. |
| `npm run sync-content` | Regenerate `.generated/` only. |
| `npm test` | Unit tests, plus an end-to-end test that runs a real production build. |
| `npm run verify` | Lint, typecheck, test, build. |

## How it reads a sprint

`sprint-status.yaml` is the only authority on scope. Every key under `development_status` belongs to
the sprint, in file order, whatever its status:

| | |
| --- | --- |
| `^epic-\d+$` | an epic |
| `^epic-\d+-retrospective$` | its retrospective |
| `^\d+-\d+[a-z]?-.+` | a story |

Story files are read from `story_location`, epic sections are extracted from `planning_source`, and
Markdown documents those artefacts explicitly reference are published too. Nothing else is read:
`_bmad-output` is never scanned, and past sprints are neither published nor indexed.

Only the attributes BMAD defines are interpreted — `project`, `scope`, `story_location`,
`planning_source`, `generated`, `last_updated`, and `development_status`. A sprint status may carry
any amount of prose and project-specific blocks around them; none of it is modelled. Markdown paths
named anywhere in the file are still followed, because that is how BMAD links its own documents.

Anything that cannot be read — a missing story file, an unknown status value, a broken reference —
is reported in the build log, in the generated model, and in the interface. It does not fail the
build; only a missing or invalid sprint status does.

`BMAD_REF` is resolved to a commit SHA once, and every later read is pinned to it, so a push during
the build cannot mix two commits into one site.

## Design

The interface uses the Noir design system: no element is separated by a line, fill planes and radius
carry the hierarchy, and status is never conveyed by colour alone — every badge, dot and progress
segment also carries a word. Light and dark are both fully defined, and `prefers-reduced-motion` is
honoured.

## Limitations

- The site is a snapshot of one commit. It does not update on its own.
- References are followed one level deep, from the sprint status, the planning source and the
  stories.
- Only images referenced by included documents are copied locally; other binaries link to GitHub.
- `{{ … }}` and non-HTML tags like `<owner>/<repo>` are escaped to HTML entities, because VitePress
  compiles Markdown as a Vue template. They still read exactly as written.
- `BMAD_OUTPUT_DIR` must stay inside the project.
- GitHub Enterprise is untested.

## Troubleshooting

**`… is not visible with the configured GITHUB_TOKEN`** — GitHub answers `404`, not `403`, for a
private repository a token cannot see, so this is almost always the token. The usual causes: the
token's resource owner is a personal account rather than the organization, or the organization has
not yet approved the token request (a pending request behaves exactly like no access).

**`BMAD_REF is "x", which does not exist`** — wrong branch; the message names the default branch.

**`Sprint status not found`** — the repository and ref are fine, but that path does not exist *on
that ref*.

## Credits

Product shape inspired by [bmad-dash](https://github.com/the-whisker-studio/bmad-dash) (MIT); this is
an independent implementation targeting a static web deployment rather than a VS Code extension.

MIT — see [LICENSE](LICENSE).
