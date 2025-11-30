const core = require("@actions/core");
const artifact = require("@actions/artifact");
const { glob } = require("glob");
const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const puppeteer = require("puppeteer");

async function run() {
    try {
        // 1. Get inputs
        const markdownFileInput = core.getInput("markdown-file");
        const cssFilesInput = core.getInput("css-files");
        const outputFilename = core.getInput("output-filename");

        // 2. Find Markdown file
        let markdownFile = markdownFileInput;
        if (!markdownFile) {
            const mdFiles = await glob("**/*.md", {
                ignore: "node_modules/**",
            });
            if (mdFiles.length === 0) {
                throw new Error("No markdown file found in the repository.");
            } else if (mdFiles.length === 1) {
                markdownFile = mdFiles[0];
                core.info(`Found single markdown file: ${markdownFile}`);
            } else {
                // Filter out README.md if there are multiple files
                const nonReadmeFiles = mdFiles.filter(
                    (f) => !f.toLowerCase().endsWith("readme.md")
                );
                if (nonReadmeFiles.length === 1) {
                    markdownFile = nonReadmeFiles[0];
                    core.info(
                        `Found single non-README markdown file: ${markdownFile}`
                    );
                } else {
                    throw new Error(
                        `Multiple markdown files found (${mdFiles.join(
                            ", "
                        )}). Please specify 'markdown-file' in the action configuration.`
                    );
                }
            }
        }

        if (!fs.existsSync(markdownFile)) {
            throw new Error(`Markdown file not found: ${markdownFile}`);
        }

        // 3. Find CSS files
        const cssFiles = await glob(cssFilesInput, {
            ignore: "node_modules/**",
        });
        let cssContent = "";
        for (const file of cssFiles) {
            core.info(`Including CSS file: ${file}`);
            cssContent += fs.readFileSync(file, "utf8") + "\n";
        }

        // 4. Read and convert Markdown
        const markdownContent = fs.readFileSync(markdownFile, "utf8");
        const htmlContent = marked.parse(markdownContent);

        // 5. Construct final HTML
        // We use a template similar to the web interface's pdf-print-template.html
        const finalHtml = `
<!doctype html>
<html>
    <head>
        <meta charset="UTF-8" />
        <title>Resume</title>
        <style>
            ${cssContent}
        </style>
    </head>
    <body>
        ${htmlContent}
    </body>
</html>
`;

        // 6. Generate PDF
        core.info("Generating PDF...");
        const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"], // Required for GitHub Actions runner
        });
        const page = await browser.newPage();

        await page.setContent(finalHtml, { waitUntil: "networkidle0" });

        // Use preferCSSPageSize to respect @page rules
        await page.pdf({
            path: outputFilename,
            printBackground: true,
            preferCSSPageSize: true,
        });

        await browser.close();
        core.info(`PDF generated: ${outputFilename}`);

        // 7. Upload Artifact
        const artifactClient = new artifact.DefaultArtifactClient();
        const artifactName = "resume-pdf";
        const files = [outputFilename];
        const rootDirectory = ".";
        const options = {
            continueOnError: false,
        };

        const uploadResult = await artifactClient.uploadArtifact(
            artifactName,
            files,
            rootDirectory,
            options
        );
        core.info(`Artifact uploaded: ${uploadResult.id}`);
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
