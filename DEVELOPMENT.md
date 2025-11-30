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
