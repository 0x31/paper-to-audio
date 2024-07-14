import path from "path";
import { Metadata } from "../types.js";
import { readFile, writeFile } from "fs/promises";

export const getMetadataPath = (intermediateDirectory: string) =>
    path.join(intermediateDirectory, "metadata.json");

export const writeMetadata = async (
    intermediateDirectory: string,
    metadata: Metadata,
) => {
    const metadataPath = getMetadataPath(intermediateDirectory);
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
};

export const readMetadata = async (
    intermediateDirectory: string,
): Promise<Metadata> => {
    const metadataPath = getMetadataPath(intermediateDirectory);
    return JSON.parse((await readFile(metadataPath)).toString());
};

// Extract the short version of the title, e.g. `GREAT: Gophers Really Eat Awful
// Things` returns just `GREAT`.
const shortTitleRegex = /: | - /;
export const getShortTitle = (metadata: Metadata): string | undefined => {
    if (!metadata.title || !shortTitleRegex.test(metadata.title)) {
        return undefined;
    }

    return metadata.title.split(shortTitleRegex)[0];
};
