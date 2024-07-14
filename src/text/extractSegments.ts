import fs from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import OpenAI from "openai";

import chalk from "chalk";
import {
    parseTeiXML,
    processReferences,
    processTeiBody,
} from "./processTEI.js";
import { callGrobid } from "./grobid.js";

import { Metadata, TextSegment } from "../types.js";
import { processFormulas } from "./formulas/processFormulas.js";
import {
    getMetadataPath,
    readMetadata,
    writeMetadata,
} from "../metadata/metadata.js";

const getSegmentsPath = (intermediateDirectory: string) =>
    path.join(intermediateDirectory, "segments.json");

export const writeSegments = async (
    intermediateDirectory: string,
    segments: TextSegment[],
) => {
    const segmentsPath = getSegmentsPath(intermediateDirectory);
    await writeFile(segmentsPath, JSON.stringify(segments, null, 2));
};

export const readSegments = async (
    intermediateDirectory: string,
): Promise<TextSegment[]> => {
    const segmentsPath = getSegmentsPath(intermediateDirectory);
    return JSON.parse((await readFile(segmentsPath)).toString());
};

export const extractSegments = async (
    intermediateDirectory: string,
    openai: OpenAI,
    filepath: string,
    options: {
        grobidUrl?: string;
        llmModel?: string;
        includeFigures?: boolean;
        skipCitations?: boolean;
        skipNotes?: boolean;
    } = {},
): Promise<{ metadata: Metadata; segments: TextSegment[] }> => {
    const segmentsPath = getSegmentsPath(intermediateDirectory);
    const metadataPath = getMetadataPath(intermediateDirectory);

    // Check if intermediate JSON has already been generated.
    try {
        if (fs.existsSync(segmentsPath) && fs.existsSync(metadataPath)) {
            console.log(chalk.green(`Reusing cached data.`));

            return {
                metadata: await readMetadata(intermediateDirectory),
                segments: await readSegments(intermediateDirectory),
            };
        }
    } catch (error) {
        console.error(error);
    }

    // PARSE PDF USING GROBID //////////////////////////////////////////////

    const teiXMLString = await callGrobid(
        intermediateDirectory,
        options.grobidUrl,
        filepath,
    );
    const { body, metadata } = await parseTeiXML(teiXMLString);

    // Adapt formulas to be more suitable for TTS using OpenAI's GPT-4 LLM.
    const processedBody = await processFormulas(
        openai,
        options.llmModel,
        processReferences(body, {
            skipCitations: options.skipCitations,
        }),
    );

    const segments = processTeiBody(processedBody, {
        includeFigures: options.includeFigures,
        skipNotes: options.skipNotes,
    });

    // Save intermediate JSON.
    await writeMetadata(intermediateDirectory, metadata);
    await writeSegments(intermediateDirectory, segments);

    return { metadata, segments };
};
