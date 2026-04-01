# Git API-First: A Modern Approach to Publishing Code on GitHub

A practical guide for developers and AI agents who prefer GitHub's REST API
over the traditional git CLI. Faster for automation, works without git installed,
and integrates cleanly into any workflow.

## Why API-First?

The git CLI requires local installation, SSH keys or credential managers,
and uses its own transport protocol. GitHub's REST API offers a lighter alternative:

- Works with just `gh` CLI or plain `curl`
- Uses standard HTTPS requests
- No git installation or configuration needed
- Perfect for CI/CD pipelines, AI agents, and automation scripts
- Supports all core operations: create, read, update, delete files and repos

## Two Methods

| Method | Best For | Commits |
|--------|----------|---------|
| Contents API | 1-3 files, quick updates | One commit per file |
| Git Database API | 4+ files, full site deploys | Single commit for all files |

## Prerequisites

```bash
# Install gh CLI
brew install gh

# Authenticate (browser flow)
gh auth login

# Verify
gh auth status
# Required scopes: repo, workflow
```

---

## Method 1: Contents API (Simple)

One API call per file. Best for quick pushes.

### Create a new file

```bash
gh api repos/OWNER/REPO/contents/index.html \
  --method PUT \
  -f message="add index" \
  -f content="$(base64 -i ./index.html)"
```

### Update an existing file

Requires the current file's SHA:

```bash
FILE_SHA=$(gh api repos/OWNER/REPO/contents/index.html --jq '.sha')

gh api repos/OWNER/REPO/contents/index.html \
  --method PUT \
  -f message="update index" \
  -f content="$(base64 -i ./index.html)" \
  -f sha="$FILE_SHA"
```

### Delete a file

```bash
FILE_SHA=$(gh api repos/OWNER/REPO/contents/index.html --jq '.sha')

gh api repos/OWNER/REPO/contents/index.html \
  --method DELETE \
  -f message="remove file" \
  -f sha="$FILE_SHA"
```

### Limits
- Max 1MB per file
- Each file = separate commit
- Can initialize an empty repo (first PUT creates the initial commit)

---

## Method 2: Git Database API (Multi-File, Single Commit)

Push an entire folder as one clean commit. Five steps: blobs → tree → commit → ref.

### Step 1: Create blobs (one per file)

```bash
BLOB_HTML=$(gh api repos/OWNER/REPO/git/blobs \
  --method POST \
  -f content="$(cat ./index.html)" \
  -f encoding='utf-8' \
  --jq '.sha')

BLOB_CSS=$(gh api repos/OWNER/REPO/git/blobs \
  --method POST \
  -f content="$(cat ./style.css)" \
  -f encoding='utf-8' \
  --jq '.sha')

BLOB_JS=$(gh api repos/OWNER/REPO/git/blobs \
  --method POST \
  -f content="$(cat ./app.js)" \
  -f encoding='utf-8' \
  --jq '.sha')
```

For binary files, use base64:
```bash
BLOB_IMG=$(gh api repos/OWNER/REPO/git/blobs \
  --method POST \
  -f content="$(base64 -i ./logo.png)" \
  -f encoding='base64' \
  --jq '.sha')
```

### Step 2: Get current branch state

```bash
PARENT_SHA=$(gh api repos/OWNER/REPO/git/refs/heads/main --jq '.object.sha')
BASE_TREE=$(gh api repos/OWNER/REPO/git/commits/$PARENT_SHA --jq '.tree.sha')
```

### Step 3: Create a new tree

```bash
cat > tree-payload.json << EOF
{
  "base_tree": "$BASE_TREE",
  "tree": [
    {"path": "index.html", "mode": "100644", "type": "blob", "sha": "$BLOB_HTML"},
    {"path": "css/style.css", "mode": "100644", "type": "blob", "sha": "$BLOB_CSS"},
    {"path": "js/app.js", "mode": "100644", "type": "blob", "sha": "$BLOB_JS"}
  ]
}
EOF

TREE_SHA=$(gh api repos/OWNER/REPO/git/trees \
  --method POST --input tree-payload.json --jq '.sha')
```

Path tips:
- `"path": "file.html"` — repo root
- `"path": "folder/file.html"` — subfolder (auto-created)
- `"mode": "100644"` — regular file
- `"mode": "100755"` — executable

### Step 4: Create a commit

```bash
cat > commit-payload.json << EOF
{
  "message": "Deploy site",
  "tree": "$TREE_SHA",
  "parents": ["$PARENT_SHA"]
}
EOF

COMMIT_SHA=$(gh api repos/OWNER/REPO/git/commits \
  --method POST --input commit-payload.json --jq '.sha')
```

### Step 5: Update the branch ref

```bash
echo "{\"sha\": \"$COMMIT_SHA\"}" > ref-payload.json

gh api repos/OWNER/REPO/git/refs/heads/main \
  --method PATCH --input ref-payload.json --jq '.object.sha'
```

### Cleanup
```bash
rm -f tree-payload.json commit-payload.json ref-payload.json
```

---

## Bootstrapping a New Repo

```bash
# 1. Create the repo
gh repo create OWNER/REPO --public --description "My project"

# 2. Initialize with first file (Contents API)
gh api repos/OWNER/REPO/contents/README.md \
  --method PUT \
  -f message="Initial commit" \
  -f content="$(echo '# My Project' | base64)"

# 3. Now use either method for additional files
```

---

## Hosting on GitHub Pages

### Enable Pages (static source)

```bash
echo '{"source":{"branch":"main","path":"/"}}' > pages.json
gh api repos/OWNER/REPO/pages --method POST --input pages.json --jq '.html_url'
rm pages.json
```

### Check deployment status

```bash
gh api repos/OWNER/REPO/pages --jq '.status'
# "built" = live, "building" = wait 30s
```

Live URL: `https://OWNER.github.io/REPO/`

---

## Deploying by App Type

### Static HTML/CSS/JS

Already static files — push and enable Pages. Done.

```bash
# Create repo
gh repo create OWNER/REPO --public

# Push index.html
gh api repos/OWNER/REPO/contents/index.html \
  --method PUT -f message="deploy" \
  -f content="$(base64 -i ./index.html)"

# Enable Pages
echo '{"source":{"branch":"main","path":"/"}}' > pages.json
gh api repos/OWNER/REPO/pages --method POST --input pages.json
rm pages.json
```

For multi-file apps, use Git Database API (Method 2) to push all files in one commit.

### React / Vite Apps

These need a build step (`npm run build` → `dist/` folder).

#### Option A: Build locally, push dist/

```bash
# 1. Set base path in vite.config.js
#    base: '/REPO_NAME/'

# 2. Build
npm run build

# 3. Push dist/ contents via Git Database API
#    (create blobs for each file in dist/, create tree, commit, update ref)

# 4. Enable Pages
```

#### Option B: Push source, let GitHub Actions build (Recommended)

Push source code + a workflow file. GitHub builds and deploys automatically.

Step 1 — vite.config.js:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/REPO_NAME/',
})
```

Step 2 — `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

Step 3 — Push everything via Git Database API.

Step 4 — Enable Pages with Actions source:
```bash
echo '{"build_type":"workflow"}' > pages.json
gh api repos/OWNER/REPO/pages --method POST --input pages.json
rm pages.json
```

### Which to choose?

| App Type | Method | When |
|----------|--------|------|
| Static HTML/JS | REST API push + Pages | Always works, simplest |
| Vite/React (one-off) | Local build + push dist/ | Quick deploy, no CI |
| Vite/React (ongoing) | Push source + GitHub Actions | Auto-deploys on every push |

---

## Quick Reference

| Operation | Command |
|-----------|---------|
| Create repo | `gh repo create OWNER/REPO --public` |
| Push file | `gh api repos/O/R/contents/PATH --method PUT -f message="msg" -f content="$(base64 -i FILE)"` |
| Update file | Get SHA first: `gh api repos/O/R/contents/PATH --jq '.sha'`, then PUT with `-f sha="SHA"` |
| Delete file | `gh api repos/O/R/contents/PATH --method DELETE -f message="msg" -f sha="SHA"` |
| List files | `gh api repos/O/R/contents/ --jq '.[].name'` |
| Commit history | `gh api repos/O/R/commits --jq '.[] \| .sha[:7] + " \| " + .commit.message'` |
| Enable Pages | `echo '{"source":{"branch":"main","path":"/"}}' > p.json && gh api repos/O/R/pages --method POST --input p.json` |
| Pages status | `gh api repos/O/R/pages --jq '.status'` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 409 on Git Database API | Repo is empty. Use Contents API first to create initial commit |
| 422 on file update | Missing `sha` field. Get current SHA: `gh api repos/O/R/contents/PATH --jq '.sha'` |
| 422 on Pages enable | Don't use `--field` for nested JSON. Use `--input` with a JSON file |
| 403 Forbidden | PAT lacks `repo` scope. Re-auth: `gh auth login` |
| 1MB file limit | Use Git Database API with base64 blob encoding, or upload via git CLI |
| Pages 404 | Wait 60 seconds. Verify index.html exists in repo root |
| Pages shows wrong content | `index.html` takes priority over `README.md`. Remove index.html if you want Jekyll to render markdown |

---

## References

- [GitHub Git Database API](https://docs.github.com/en/rest/guides/getting-started-with-the-git-database-api)
- [GitHub Contents API](https://docs.github.com/en/rest/repos/contents)
- [Vite GitHub Pages Guide](https://vitejs.dev/guide/static-deploy#github-pages)
