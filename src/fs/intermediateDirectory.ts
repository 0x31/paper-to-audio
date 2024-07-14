import { mkdir, readFile } from "fs/promises";
import path from "path";
import { createHash } from "crypto";

// Files generated during processing are stored in this directory.
export const INTERMEDIATE_ROOT = path.resolve("./intermediate");

const getFileHash = async (filePath: string) => {
    const fileBuffer = await readFile(filePath);
    const hashSum = createHash("md5");
    hashSum.update(fileBuffer);
    return hashSum.digest("hex").toString();
};

// Files relates to a particular PDF are stored together at the path
// `$INTERMEDIATE_ROOT/$PDF_MD5/`.
export const getIntermediateDirectory = async (
    pdfFilepath: string,
): Promise<string> => {
    const fileHash = await getFileHash(pdfFilepath);
    const intermediateDirectory = path.join(INTERMEDIATE_ROOT, fileHash);
    await mkdir(intermediateDirectory, { recursive: true });
    return intermediateDirectory;
};
