import chalk from "chalk";
import { existsSync } from "fs";
import { lstat, readdir } from "fs/promises";
import path from "path";

export const CLEAR_LINE = "\r\u001b[2K";

export const replaceExtension = (
    filePath: string,
    extension: string,
): string => {
    if (extension[0] !== ".") {
        extension = "." + extension;
    }
    const ext = path.extname(filePath);
    return filePath.replace(ext, extension);
};

export const randomElement = <T>(array: T[]): T =>
    array[Math.floor(Math.random() * array.length)];

export const sanitizeFilename = (
    filename: string,
    replacement: string = "_",
): string => {
    // List of invalid characters for filenames
    const invalidChars = /[^a-z0-9 .]/gi;

    // Replace invalid characters with the replacement string
    let sanitized = filename.replace(invalidChars, replacement);

    while (sanitized.match(replacement + replacement)) {
        sanitized = sanitized.replaceAll(
            replacement + replacement,
            replacement,
        );
    }

    // Trim whitespace from the start and end
    sanitized = sanitized.trim();

    // Optionally limit the length of the filename
    const maxLength = 255; // Maximum filename length in many file systems
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
};

// Check if an environment variable is set, supporting both "true" and "1" values.
export const flagIsSet = (variable: string | undefined) =>
    variable === "true" || variable === "1";

// Find the intended PDF from a given filepath - if it's a folder, check that
// it contains a single PDF.
export const resolvePdfPath = async (filepath: string): Promise<string> => {
    if (!existsSync(filepath)) {
        console.error(chalk.red(`Invalid filepath ${chalk.yellow(filepath)}.`));
        process.exit(1);
    }
    if ((await lstat(filepath)).isDirectory()) {
        const pdfFiles = (await readdir(filepath))
            .filter((file) => path.extname(file).toLowerCase() === ".pdf")
            .map((file) => path.join(filepath, file));
        if (pdfFiles.length > 2) {
            console.log(
                chalk.red(
                    `Multiple PDF files in folder: ` + pdfFiles.join(", "),
                ),
            );
            process.exit(1);
        } else if (pdfFiles.length === 0) {
            console.log(
                chalk.red(`Must provide path to PDF. Received directory path.`),
            );
            process.exit(1);
        }

        filepath = pdfFiles[0];
    }

    if (path.extname(filepath) !== ".pdf") {
        console.warn(
            chalk.red(
                `Warning: Expected PDF file, received file with extension ${path.extname(filepath)} instead.`,
            ),
        );
    }

    return path.resolve(filepath);
};
