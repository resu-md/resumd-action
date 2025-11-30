const core = require("@actions/core");
const glob = require("@actions/glob");
const path = require("path");
const fs = require("fs/promises");
const { existsSync } = require("fs");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
const matter = require("gray-matter");
const MarkdownIt = require("markdown-it");

async function run() {
    try {
        const workspace = resolveWorkspace();
        process.chdir(workspace);

        const markdownPatterns = getPatternInput("files", ["**/*.md"]);
        const excludePatterns = getPatternInput("exclude", []);
        const defaultExcludes = [
            "!**/node_modules/**",
            "!**/.git/**",
            "!**/.github/**",
        ];
        const searchPatterns = markdownPatterns
            .concat(excludePatterns)
            .concat(defaultExcludes);

        const includeReadme = getBooleanInput("include_readme", false);
        const markdownFiles = (await expandPatterns(searchPatterns, workspace))
            .filter((file) => file.toLowerCase().endsWith(".md"))
            .filter((file) => {
                if (includeReadme) {
                    return true;
                }
                const base = path.basename(file).toLowerCase();
                return base !== "readme.md";
            });
        if (!markdownFiles.length) {
            throw new Error(
                "No markdown files matched the requested patterns."
            );
        }

        const outputDirInput = core.getInput("output_dir");
        const outputDir = outputDirInput
            ? path.resolve(workspace, outputDirInput)
            : path.resolve(workspace, "resume-build");
        await fs.mkdir(outputDir, { recursive: true });

        const emitHtml = getBooleanInput("emit_html", true);
        const failOnMissingCss = getBooleanInput("fail_on_missing_css", false);
        const disableSandbox = getBooleanInput(
            "disable_sandbox",
            process.platform === "linux"
        );
        const pdfTimeout = parseInteger(core.getInput("pdf_timeout_ms"), 20000);
        const chromePathInput = core.getInput("chrome_path");
        const extraHead = core.getInput("extra_html_head");

        const globalCssPatterns = getPatternInput("global_css", []);
        const globalCssFiles = await expandPatterns(
            globalCssPatterns,
            workspace
        );

        const md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true,
        });
        const cssCache = new Map();
        const results = [];

        const chromeExecutable = await detectChromeExecutable(chromePathInput);
        core.info(`Using Chrome binary at: ${chromeExecutable}`);

        for (const markdownPath of markdownFiles.sort()) {
            const relativeMarkdownPath = path.relative(workspace, markdownPath);
            core.startGroup(`Processing ${relativeMarkdownPath}`);

            const raw = await fs.readFile(markdownPath, "utf8");
            const parsed = matter(raw);
            const markdownContent = parsed.content;
            const frontmatter = parsed.data || {};

            if (shouldSkip(frontmatter)) {
                core.info(
                    "Skipping file because front matter marked it as draft/skip or publish=false."
                );
                core.endGroup();
                continue;
            }

            const cssCandidates = (
                await gatherCssPaths({
                    frontmatter,
                    markdownPath,
                    workspace,
                    globalCssFiles,
                })
            ).sort();

            if (!cssCandidates.length && failOnMissingCss) {
                throw new Error(
                    `No CSS files found for ${relativeMarkdownPath}`
                );
            }

            if (cssCandidates.length) {
                core.info(
                    `Including CSS files: ${cssCandidates
                        .map((cssPath) => path.relative(workspace, cssPath))
                        .join(", ")}`
                );
            } else {
                core.info("No CSS files detected for this markdown file.");
            }

            const cssContents = [];
            for (const cssPath of cssCandidates) {
                if (!existsSync(cssPath)) {
                    throw new Error(
                        `CSS file referenced for ${relativeMarkdownPath} does not exist: ${cssPath}`
                    );
                }
                cssContents.push(await readCss(cssPath, cssCache));
            }

            const htmlBody = md.render(markdownContent);
            const title =
                frontmatter.title ||
                path.basename(markdownPath, path.extname(markdownPath));
            const lang = frontmatter.lang || "en";

            const documentHtml = buildHtmlDocument({
                title,
                lang,
                inlineCss: cssContents.join("\n\n"),
                bodyHtml: htmlBody,
                extraHead,
            });

            const relativeDir = path.dirname(relativeMarkdownPath);
            const targetDir = path.join(outputDir, relativeDir);
            await fs.mkdir(targetDir, { recursive: true });

            const basename =
                frontmatter.output_name ||
                path.basename(markdownPath, path.extname(markdownPath));
            const htmlOutputPath = path.join(targetDir, `${basename}.html`);
            const pdfOutputPath = path.join(targetDir, `${basename}.pdf`);

            if (emitHtml) {
                await fs.writeFile(htmlOutputPath, documentHtml, "utf8");
                core.info(
                    `HTML written to ${path.relative(
                        workspace,
                        htmlOutputPath
                    )}`
                );
            } else {
                const tempHtmlPath = path.join(
                    targetDir,
                    `.${basename}.tmp.html`
                );
                await fs.writeFile(tempHtmlPath, documentHtml, "utf8");
                await convertHtmlToPdf({
                    chromeExecutable,
                    htmlPath: tempHtmlPath,
                    pdfPath: pdfOutputPath,
                    disableSandbox,
                    timeoutMs: pdfTimeout,
                });
                await fs.unlink(tempHtmlPath);
            }

            if (emitHtml) {
                await convertHtmlToPdf({
                    chromeExecutable,
                    htmlPath: htmlOutputPath,
                    pdfPath: pdfOutputPath,
                    disableSandbox,
                    timeoutMs: pdfTimeout,
                });
            }

            core.info(
                `PDF written to ${path.relative(workspace, pdfOutputPath)}`
            );

            results.push({
                markdown: normalizePath(relativeMarkdownPath),
                html: emitHtml
                    ? normalizePath(path.relative(workspace, htmlOutputPath))
                    : null,
                pdf: normalizePath(path.relative(workspace, pdfOutputPath)),
                css: cssCandidates.map((cssPath) =>
                    normalizePath(path.relative(workspace, cssPath))
                ),
            });

            core.endGroup();
        }

        const outputRelative = normalizePath(
            path.relative(workspace, outputDir) || "."
        );
        core.setOutput("count", String(results.length));
        core.setOutput("output_dir", outputRelative);
        core.setOutput("files", JSON.stringify(results));

        try {
            await core.summary
                .addHeading("Resumes generated")
                .addRaw(`Total: ${results.length}`)
                .addBreak()
                .addTable([
                    [
                        { data: "Markdown", header: true },
                        { data: "PDF", header: true },
                        { data: "HTML", header: true },
                    ],
                    ...results.map((entry) => [
                        entry.markdown,
                        entry.pdf,
                        entry.html || "(not saved)",
                    ]),
                ])
                .write();
        } catch (summaryError) {
            core.debug(
                `Skipping job summary: ${
                    summaryError instanceof Error
                        ? summaryError.message
                        : String(summaryError)
                }`
            );
        }
    } catch (error) {
        core.setFailed(error instanceof Error ? error.message : String(error));
    }
}

function resolveWorkspace() {
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    return path.resolve(workspace);
}

function getPatternInput(name, fallback) {
    const raw = core.getMultilineInput(name, { required: false }) || [];
    const values = raw.map((line) => line.trim()).filter(Boolean);
    return values.length ? values : fallback;
}

async function expandPatterns(patterns, workspace) {
    if (!patterns.length) {
        return [];
    }

    const globber = await glob.create(patterns.join("\n"), {
        matchDirectories: false,
        implicitDescendants: true,
        followSymbolicLinks: false,
    });

    const matches = await globber.glob();
    const unique = new Set();
    for (const match of matches) {
        const resolved = path.resolve(workspace, match);
        if (!isPathInside(resolved, workspace)) {
            continue;
        }
        unique.add(resolved);
    }
    return Array.from(unique);
}

function getBooleanInput(name, fallback) {
    const raw = core.getInput(name);
    if (!raw) {
        return fallback;
    }
    return core.getBooleanInput(name);
}

function parseInteger(raw, fallback) {
    if (!raw) {
        return fallback;
    }
    const value = Number.parseInt(raw, 10);
    return Number.isNaN(value) ? fallback : value;
}

async function detectChromeExecutable(explicitPath) {
    if (explicitPath) {
        const resolved = path.resolve(explicitPath);
        if (!existsSync(resolved)) {
            throw new Error(`Provided chrome_path does not exist: ${resolved}`);
        }
        return resolved;
    }

    const envCandidates = [
        process.env.CHROME_PATH,
        process.env.GOOGLE_CHROME_SHIM,
        process.env.PLAYWRIGHT_BROWSERS_PATH,
    ];
    for (const candidate of envCandidates) {
        if (candidate && existsSync(candidate)) {
            return path.resolve(candidate);
        }
    }

    const platformCandidates =
        process.platform === "win32"
            ? [
                  "C:/Program Files/Google/Chrome/Application/chrome.exe",
                  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
                  process.env.LOCALAPPDATA
                      ? path.join(
                            process.env.LOCALAPPDATA,
                            "Google/Chrome/Application/chrome.exe"
                        )
                      : undefined,
              ]
            : [
                  "/usr/bin/google-chrome",
                  "/usr/bin/google-chrome-stable",
                  "/usr/bin/chromium",
                  "/usr/bin/chromium-browser",
                  "/snap/bin/chromium",
                  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              ];

    for (const candidate of platformCandidates) {
        if (candidate && existsSync(candidate)) {
            return path.resolve(candidate);
        }
    }

    throw new Error(
        "Could not locate a Chrome or Chromium executable. Provide chrome_path input to specify it explicitly."
    );
}

async function gatherCssPaths({
    frontmatter,
    markdownPath,
    workspace,
    globalCssFiles,
}) {
    const cssSet = new Set();
    for (const cssFile of globalCssFiles) {
        cssSet.add(path.resolve(cssFile));
    }

    const frontmatterCss = normalizeValue(frontmatter.css);
    if (frontmatterCss.length) {
        for (const entry of frontmatterCss) {
            const candidate = path.resolve(path.dirname(markdownPath), entry);
            ensureInWorkspace(candidate, workspace, "frontmatter css");
            cssSet.add(candidate);
        }
    } else {
        const directoryEntries = await fs.readdir(path.dirname(markdownPath), {
            withFileTypes: true,
        });
        for (const entry of directoryEntries) {
            if (entry.isFile() && entry.name.toLowerCase().endsWith(".css")) {
                const candidate = path.join(
                    path.dirname(markdownPath),
                    entry.name
                );
                cssSet.add(candidate);
            }
        }
    }

    return Array.from(cssSet);
}

function normalizeValue(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return [String(value).trim()].filter(Boolean);
}

function ensureInWorkspace(candidate, workspace, label) {
    const resolved = path.resolve(candidate);
    if (!isPathInside(resolved, workspace)) {
        throw new Error(`Cannot use ${label} outside workspace: ${candidate}`);
    }
    return resolved;
}

function isPathInside(child, parent) {
    const resolvedParent = path.resolve(parent);
    const resolvedChild = path.resolve(child);
    const relative = path.relative(resolvedParent, resolvedChild);
    if (!relative) {
        return true;
    }
    return !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function readCss(cssPath, cache) {
    const resolved = path.resolve(cssPath);
    if (cache.has(resolved)) {
        return cache.get(resolved);
    }
    const contents = await fs.readFile(resolved, "utf8");
    cache.set(resolved, contents);
    return contents;
}

function buildHtmlDocument({ title, lang, inlineCss, bodyHtml, extraHead }) {
    const safeTitle = escapeHtml(title);
    const headExtras = extraHead ? `\n${extraHead}\n` : "";
    const cssBlock = inlineCss ? `\n<style>\n${inlineCss}\n</style>` : "";
    return `<!doctype html>\n<html lang="${lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${safeTitle}</title>${headExtras}${cssBlock}\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>\n`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function convertHtmlToPdf({
    chromeExecutable,
    htmlPath,
    pdfPath,
    disableSandbox,
    timeoutMs,
}) {
    const args = [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-dev-shm-usage",
        "--print-to-pdf-no-header",
        "--no-pdf-header-footer",
        `--print-to-pdf=${pdfPath}`,
    ];
    if (disableSandbox) {
        args.push("--no-sandbox", "--disable-setuid-sandbox");
    }
    args.push(pathToFileURL(htmlPath).href);

    await fs.mkdir(path.dirname(pdfPath), { recursive: true });

    await execFileWithTimeout(chromeExecutable, args, timeoutMs);
}

function execFileWithTimeout(file, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        const child = spawn(file, args, { stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";
        child.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        const timeout = setTimeout(() => {
            child.kill("SIGKILL");
            reject(
                new Error(
                    `Chrome timed out after ${timeoutMs} ms. Last stderr output: ${stderr}`
                )
            );
        }, timeoutMs);

        child.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });

        child.on("close", (code) => {
            clearTimeout(timeout);
            if (code !== 0) {
                reject(
                    new Error(
                        `Chrome exited with code ${code}. Stderr: ${stderr}`
                    )
                );
            } else {
                resolve();
            }
        });
    });
}

function normalizePath(value) {
    return value.split(path.sep).join("/");
}

function shouldSkip(frontmatter) {
    if (!frontmatter || typeof frontmatter !== "object") {
        return false;
    }
    const draft = parseBooleanish(frontmatter.draft);
    if (draft === true) {
        return true;
    }
    const skip = parseBooleanish(frontmatter.skip);
    if (skip === true) {
        return true;
    }
    if (frontmatter.publish !== undefined) {
        const publish = parseBooleanish(frontmatter.publish);
        if (publish === false) {
            return true;
        }
    }
    return false;
}

function parseBooleanish(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        return value !== 0;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(normalized)) {
            return true;
        }
        if (["false", "0", "no", "off"].includes(normalized)) {
            return false;
        }
    }
    return undefined;
}

run();
