import { readFile } from "fs/promises";
import { TagConstants, Tags } from "node-id3";
import chalk from "chalk";
import { AudioSegment, Metadata } from "../types.js";
import { sentenceCase } from "change-case";
import { BigNumber } from "bignumber.js";
import mp3Duration from "mp3-duration";
import { audioSegmentsToBuffer } from "./audioUtils.js";
import { CLEAR_LINE } from "../utils/utils.js";

// Information required for an ID3 chapter marker.
interface Chapter {
    startTime: number;
    endTime: number;
    elementID: string;
    startTimeMs: number;
    endTimeMs: number;
    title: string;
}

// Combine audio segments and write metadata.
export const generateID3Tags = async (
    audioSegments: AudioSegment[],
    metadata: Metadata,
): Promise<Tags> => {
    process.stdout.write(`Calculating chapter lengths...`);

    // Calculate the durations of each segment and add chapter markers. We
    // rebuild the mp3 each time because combining the buffers without ffmpeg
    // was resulting in incorrect chapter markers.
    const chapters: Chapter[] = [];
    for (let i = 0; i < audioSegments.length; i++) {
        process.stdout.write(
            CLEAR_LINE +
                `Calculating length of chapter ${chalk.green(
                    i + 1,
                )} of ${chalk.green(audioSegments.length)}...`,
        );

        const { title } = audioSegments[i];

        const startTime =
            i === 0
                ? 0
                : await mp3Duration(
                      await audioSegmentsToBuffer(audioSegments.slice(0, i)),
                  );
        const endTime = await mp3Duration(
            await audioSegmentsToBuffer(audioSegments.slice(0, i + 1)),
        );

        chapters.push({
            startTime: startTime,
            endTime: endTime,
            elementID:
                title.replace(/^Section /, "") ||
                `Chapter ${chapters.length + 1}`,
            startTimeMs: new BigNumber(startTime)
                .times(1000)
                .integerValue()
                .toNumber(),
            endTimeMs: new BigNumber(endTime)
                .times(1000)
                .integerValue()
                .toNumber(),
            title,
        });
    }

    console.log(CLEAR_LINE + chalk.green("Chapter markers created. "));

    // Create ID3 tags with chapter markers
    const tags: Tags = {
        title: metadata.title,
        artist: metadata.authors?.join(", "),
        chapter: chapters,
        composer: metadata.voice
            ? `OpenAI ${sentenceCase(metadata.voice)}`
            : undefined,
        image: metadata.image
            ? {
                  mime: "image/png", // Assuming the image is PNG format, adjust if necessary
                  type: {
                      id: TagConstants.AttachedPicture.PictureType.FRONT_COVER,
                  },
                  description: "Cover Image", // Adjust description as needed
                  imageBuffer: await readFile(metadata.image),
              }
            : undefined,
        comment: {
            text:
                metadata.abstract +
                (metadata.keywords && metadata.keywords.length > 0
                    ? "\nKeywords: " + metadata.keywords.join("; ")
                    : ""),
            language: "eng",
        },
        genre: metadata.tags?.join("//"),
    };

    return tags;
};
