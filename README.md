# ResuMD Resume PDF Action

Github Action for converting PDFs directly from Markdown + CSS inside your repository.

This action renders every matched Markdown document, applies CSS (including `@page` rules), and exports ready-to-share PDF (and, optionally, HTML) files. By default it scans for Markdown, skips `node_modules`, `.git`, and `.github`, and writes artifacts into `output/`.

## Usage

In your GitHub repository, create a workflow file (e.g. `.github/workflows/markdown-to-pdf.yml`) with the following content:

```yaml
on:
  push:
    # branches: [ main ] # Uncomment to limit to specific branches
  pull_request:
  workflow_dispatch:

jobs:
  pdf:
    name: Convert Markdown to PDF
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate outputs (.pdf, .html)
        id: render
        uses: resu-md/resumd-action@node
        with:
          files: |
            **/*.md
          exclude: |
            .github/**/*
      - name: Upload output (.zip)
        uses: actions/upload-artifact@v4
        with:
          name: Resume
          path: ${{ steps.render.outputs.output_dir }}
          if-no-files-found: error
```

Write as many Markdown files as you want to your repository. On each push or pull request, each file will be converted to a PDF using the (one or many) CSS files located in the same folder.

### Front matter options

Add YAML front matter at the top of any Markdown resume to customize its rendering:

```
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
