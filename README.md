# Resumd GitHub Action

This GitHub Action generates a PDF resume from Markdown and CSS files in your repository.

## Usage

Create a workflow file (e.g., `.github/workflows/resume.yml`) in your repository:

```yaml
name: Generate Resume PDF

on:
    push:
        branches:
            - main

jobs:
    generate-pdf:
        runs-on: ubuntu-latest
        steps:
            - name: Checkout
              uses: actions/checkout@v4

            - name: Generate PDF
              uses: your-username/resumd-action@main
              with:
                  output-filename: my-resume.pdf
```

## Inputs

| Input             | Description                                                        | Required | Default      |
| ----------------- | ------------------------------------------------------------------ | -------- | ------------ |
| `markdown-file`   | Path to the markdown file. Auto-detected if single MD file exists. | No       | Auto-detect  |
| `css-files`       | Glob pattern for CSS files.                                        | No       | `**/*.css`   |
| `output-filename` | Name of the output PDF file.                                       | No       | `resume.pdf` |

## Development

1. Install dependencies:

    ```bash
    npm install
    ```

2. Build the action (bundles dependencies into `dist/index.js`):

    ```bash
    npm run build
    ```

3. Commit the `dist` folder.
