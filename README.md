# Markdown to PDF Action

Github Action for converting PDFs directly from Markdown + CSS inside your repository.

This action renders every matched Markdown document, applies CSS (including `@page` rules), and exports ready-to-share PDF (and, optionally, HTML) files. It automatically uploads the generated files as a "PDFs" artifact (configurable).

## Usage

In your GitHub repository, create a workflow file (e.g. `.github/workflows/markdown-to-pdf.yml`) with the following content:

```yaml
name: Convert all Markdown files to PDFs

on:
    push:
    pull_request:
    workflow_dispatch:

jobs:
    pdf:
        uses: resu-md/resumd-action/.github/workflows/workflow.yml@main
        with:
            files: |
                **/*.md
            exclude: |
                **/README.md
                **/node_modules/**
                **/.git/**
                **/.github/**
            # artifact_name: pdfs # (optional) name of the .zip output, defaults to "Markdown_PDFs_Converted"
```

All Markdown files matching the specified glob patterns will be converted to PDFs using the (one or many) CSS files **located in the _same_ folder** on each push or pull request.

### Front matter options

Add YAML [front matter](https://www.perplexity.ai/search/what-is-front-matter-in-markdo-flpn9m9SQruDq2KIQM_lrQ#0) at the top of any Markdown resume to customize its rendering:

```
---
title: My Document
lang: en
css:
  - theme.css
  - ../../shared/print.css
output_name: my-document
---
```

-   `title`: Sets the HTML `<title>` element.
-   `lang`: Sets the `<html lang="...">` attribute.
-   `css`: Relative paths (from the Markdown file) to include specific CSS files. When omitted, every `.css` file in the same folder is included by default.
-   `output_name`: Overrides the output file stem for both HTML and PDF.
-   `draft` / `skip`: Set to `true` to skip rendering that Markdown file. Alternatively set `publish: false`.
