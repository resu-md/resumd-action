# Development

1. Install dependencies:

    ```bash
    npm install
    ```

2. Build the action (bundles dependencies into `dist/index.js`):

    ```bash
    npm run build
    ```

3. Commit the `dist` folder.

## CLI usage

Example local invocation:

```bash
GITHUB_WORKSPACE=/path/to/repo \
INPUT_FILES="**/*.md" \
INPUT_OUTPUT_DIR=ci-output \
INPUT_DISABLE_SANDBOX=true \
node dist/index.js
```

The script writes HTML (when enabled) and PDF files into `ci-output`. The structured `files` output makes it easy to post-process results in downstream tooling.

### Inputs

-   `GITHUB_WORKSPACE`: Absolute path to the working tree. Defaults to the current directory when omitted, but setting it explicitly mirrors the GitHub Actions environment.
-   `INPUT_FILES`: Newline- or comma-separated glob patterns for Markdown inputs. Defaults to `**/*.md`.
-   `INPUT_EXCLUDE`: Optional glob patterns to ignore. Combine multiple patterns with newlines.
-   `INPUT_OUTPUT_DIR`: Target directory for generated files (relative to the workspace). Defaults to `output`.
-   `INPUT_GLOBAL_CSS`: Newline-separated glob patterns for CSS files bundled with every resume.
-   `INPUT_EMIT_HTML`: Set to `false` to skip writing HTML files and emit PDFs only. Defaults to `true`.
-   `INPUT_INCLUDE_README`: Set to `true` to process `README.md` files. Defaults to `false`.
-   `INPUT_FAIL_ON_MISSING_CSS`: Set to `true` to treat missing CSS as an error rather than a warning. Defaults to `false`.
-   `INPUT_DISABLE_SANDBOX`: Set to `false` to keep the Chrome sandbox enabled. Defaults to `true` (recommended for Linux containers).
-   `INPUT_PDF_TIMEOUT_MS`: Integer timeout, in milliseconds, for PDF generation. Defaults to `20000`.
-   `INPUT_CHROME_PATH`: Absolute path to a Chrome or Chromium executable. If not provided, the action attempts to auto-detect a binary.
-   `INPUT_EXTRA_HTML_HEAD`: Raw HTML injected into the `<head>` of every generated document. Useful for custom fonts or meta tags.

### Outputs

-   `count`: Number of Markdown files that were rendered. Emitted via the standard GitHub Actions output command.
-   `output_dir`: Relative path to the directory containing all generated files. Use this path when uploading artifacts.
-   `files`: JSON array describing each rendered entry. Every object contains `markdown`, `pdf`, optional `html`, and the list of `css` files that were applied.

## Advanced action usage

The instructions on how to use this action in its simplest form are in the [`README.md`](./README.md) file. If you need further customization (e.g., custom Chrome path, global CSS injection, disabling sandbox, etc.), use the action through the [`actions.yml`](./action.yml).

```yaml
name: Convert all Markdown files to PDFs

on:
    push:
    pull_request:
    workflow_dispatch:

jobs:
    pdf:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - name: Generate PDFs and HTML
              uses: resu-md/resumd-action@main
              with:
                  files: |
                      **/*.md
                  exclude: |
                      **/README.md
                      **/node_modules/**
                      **/.git/**
                      **/.github/**
                  artifact_name: MyArtifact
                  # Advanced options:
                  # output_dir: custom_output
                  # chrome_path: /usr/bin/google-chrome
                  # global_css: theme.css
                  # emit_html: false
                  # fail_on_missing_css: true
                  # disable_sandbox: false
                  # pdf_timeout_ms: 30000
                  # extra_html_head: <script>...</script>
```

### Arguments

| Input                 | Type             | Default                            | Description                                                                            |
| --------------------- | ---------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `files`               | multiline string | `**/*.md`                          | Glob patterns (one per line) that select Markdown files to render.                     |
| `exclude`             | multiline string | _(none)_                           | Glob patterns (one per line) to subtract from `files`. Prefixing with `!` is optional. |
| `output_dir`          | string           | `output`                           | Directory where generated HTML/PDF files are written. Created if missing.              |
| `chrome_path`         | string           | _(auto-detect)_                    | Absolute path to a Chrome/Chromium executable. Supply when auto-detection fails.       |
| `global_css`          | multiline string | _(none)_                           | Glob patterns that match CSS files to inject into every Markdown document.             |
| `emit_html`           | boolean          | `true`                             | Set to `false` to only emit PDFs. When `true`, HTML is still used for PDF rendering.   |
| `fail_on_missing_css` | boolean          | `false`                            | Fail the job if no CSS files are found for a Markdown file (otherwise only warn).      |
| `disable_sandbox`     | boolean          | `true` on Linux, otherwise `false` | Disable Chrome's sandbox (recommended on GitHub-hosted Linux runners).                 |
| `pdf_timeout_ms`      | number           | `20000`                            | Milliseconds to wait for Chrome while rendering each PDF.                              |
| `extra_html_head`     | string           | _(none)_                           | Raw HTML appended to the `<head>` of every generated document.                         |
| `artifact_name`       | string           | `Markdown_PDFs_Converted`          | Name used when uploading the generated files via `actions/upload-artifact`.            |
