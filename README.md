# ResuMD Resume PDF Action

Generate polished PDF and HTML resumes directly from Markdown + CSS inside your repository. This action renders every matched Markdown document, applies CSS (including `@page` rules), and exports ready-to-share files.

## Features

- Converts Markdown (with optional embedded HTML) into HTML and PDF outputs.
- Honors `@page` directives in your CSS for precise page sizing and margins.
- Automatically picks up CSS files that live next to each Markdown file.
- Supports global CSS and per-document overrides through YAML front matter.
- Exposes outputs that plug straight into `actions/upload-artifact`.

## Usage

```yaml
name: Build resume PDFs

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate resumes
        id: resumes
        uses: resu-md/resumd-action@v1
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: resumes
          path: ${{ steps.resumes.outputs.output_dir }}
```

## Inputs

| Name | Default | Description |
| --- | --- | --- |
| `files` | `**/*.md` | Newline-separated glob patterns that select Markdown resumes. |
| `exclude` | | Additional glob patterns to skip. |
| `output_dir` | `output` | Directory (relative to the workspace) that will contain the generated HTML and PDF files. |
| `chrome_path` | auto | Absolute path to the Chrome/Chromium binary. Override when running on self-hosted runners. |
| `global_css` | | Extra CSS files (newline-separated glob patterns) that are injected in every resume. |
| `emit_html` | `true` | Set to `false` when you only need PDFs. |
| `include_readme` | `false` | Set to `true` if you also want to render `README.md` files. |
| `fail_on_missing_css` | `false` | Fail the build when a Markdown file has no CSS. |
| `disable_sandbox` | `true` | Adds `--no-sandbox` flags (recommended on Linux hosted runners). |
| `pdf_timeout_ms` | `20000` | Timeout applied to each Chrome invocation. |
| `extra_html_head` | | Raw HTML that is inserted into the `<head>` section. |

## Front matter options

Add YAML front matter at the top of any Markdown resume to customize its rendering:

```markdown
---
title: Jane Doe Resume
lang: en
css:
  - theme.css
  - ../../shared/print.css
output_name: jane-doe-resume
---
```

- `title`: Sets the HTML `<title>` element.
- `lang`: Sets the `<html lang="...">` attribute.
- `css`: Relative paths (from the Markdown file) to include specific CSS files. When omitted, every `.css` file in the same folder is included by default.
- `output_name`: Overrides the output file stem for both HTML and PDF.
- `draft` / `skip`: Set to `true` to skip rendering that Markdown file. Alternatively set `publish: false`.

## Outputs

The action exposes three outputs:

- `count`: Number of Markdown resumes that were rendered.
- `output_dir`: Relative path to the folder containing generated files.
- `files`: JSON array describing each document (`markdown`, `html`, `pdf`, and `css`).

Example:

```json
[
  {
    "markdown": "resume.md",
    "html": "output/resume.html",
    "pdf": "output/resume.pdf",
    "css": ["resume-template/theme.css"]
  }
]
```

Use these outputs to wire the action into additional steps such as publishing or deploying.
