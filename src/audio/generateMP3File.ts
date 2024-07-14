import { readFile, unlink, writeFile } from "fs/promises";
import NodeID3, { Tags } from "node-id3";
import chalk from "chalk";
import { AudioSegment, Metadata } from "../types.js";
import path from "path";
import { randomUUID } from "crypto";
import ffmpeg from "fluent-ffmpeg";
import { INTERMEDIATE_ROOT } from "../fs/intermediateDirectory.js";
import { generateID3Tags } from "./generateID3Tags.js";
import { audioSegmentsToBuffer } from "./audioUtils.js";
import { CLEAR_LINE } from "../utils/utils.js";

// Write ID3 metadata tags to the provided audio buffer.
const writeID3Tags = async (
    audioBuffer: Buffer,
    tags: Tags,
): Promise<Buffer> => {
    process.stdout.write(chalk.yellow("Writing ID3 tags..."));

    const temporaryFile = path.join(INTERMEDIATE_ROOT, `${randomUUID()}.mp3`);
    let finalBuffer: Buffer;
    try {
        await writeFile(temporaryFile, audioBuffer);

        NodeID3.write(tags, temporaryFile);

        finalBuffer = await readFile(temporaryFile);
    } finally {
        // Clean up temporary file
        await unlink(temporaryFile);
    }

    console.log(CLEAR_LINE + chalk.green("Wrote ID3 tags to audio buffer."));

    return finalBuffer;
};

// Re-encode and write audio to MP3 file, using `libmp3lame` as the audio codec.
const encodeMP3File = async (
    outputPath: string,
    buffer: Buffer,
): Promise<void> => {
    const temporaryFile = path.join(INTERMEDIATE_ROOT, `${randomUUID()}.mp3`);

    try {
        await writeFile(temporaryFile, buffer);

        process.stdout.write(chalk.yellow("Encoding mp3..."));
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .audioCodec("libmp3lame")
                .audioBitrate("320k")
                .input(temporaryFile)
                .on("end", () => resolve())
                .on("error", (err) => reject(err))
                .save(outputPath);
        });
        console.log(
            CLEAR_LINE + chalk.green(`Wrote MP3 to ${chalk.blue(outputPath)}.`),
        );
    } finally {
        await unlink(temporaryFile);
    }
};

// Combine audio segments and write metadata.
export const generateMP3File = async (
    outputFilepath: string,
    audioSegments: AudioSegment[],
    metadata: Metadata,
): Promise<void> => {
    // Generate ID3 metadata tags.
    const tags = await generateID3Tags(audioSegments, metadata);

    // Combine audio into a single buffer.
    const audioBuffer = await audioSegmentsToBuffer(audioSegments);

    // Write ID3 metadata tags to buffer.
    const audioBufferWithTags = await writeID3Tags(audioBuffer, tags);

    // Re-encode the audio using FFMPEG, outputting an MP3 file.
    await encodeMP3File(outputFilepath, audioBufferWithTags);
};
