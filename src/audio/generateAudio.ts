import { writeFile } from "fs/promises";
import path from "path";
import OpenAI from "openai";

import chalk from "chalk";
import {
    AudioSegment,
    Metadata,
    TextSegment,
    TTSModel,
    Voice,
} from "../types.js";
import { CLEAR_LINE, randomElement } from "../utils/utils.js";
import { sentenceCase } from "change-case";
import { existsSync } from "fs";
import { parseJSON, writeJSON } from "../utils/streamJSON.js";

const DEFAULT_TTS_MODEL = TTSModel.TTS_1;
const DEFAULT_TTS_VOICE = Voice.Echo;

// Maximum number of characters supported by the TTS model.
const TTS_MAX_CHARS = 4096;

// Select a random voice from the currently known OpenAI voices.
export const randomVoice = (): Voice => randomElement(Object.values(Voice));

// Split the text into chunks smaller than `maxLength`, splitting between
// sentences. The OpenAI TTS has a limit on the length of the input text.
export const splitTextIntoChunks = (
    text: string,
    maxLength: number,
): string[] => {
    const sentences = text.match(/.+[.!?]+\s+|.+$/g) || [];
    const chunks = [];
    let chunk = "";

    sentences.forEach((sentence) => {
        if (sentence.length > maxLength) {
            const words = sentence.match(/.+? |.+$/g);
            words?.forEach((word) => {
                if (word.length > maxLength) {
                    while (word.length) {
                        if (chunk.length) {
                            chunks.push(chunk);
                        }
                        chunk = word.slice(0, maxLength);
                        word = word.slice(maxLength);
                    }
                } else {
                    if (
                        chunk.length &&
                        chunk.length + word.length > maxLength
                    ) {
                        chunks.push(chunk);
                        chunk = word;
                    } else {
                        chunk += word;
                    }
                }
            });
        } else {
            if (chunk.length + sentence.length > maxLength) {
                chunks.push(chunk);
                chunk = sentence;
            } else {
                chunk += sentence;
            }
        }
    });

    if (chunk) {
        chunks.push(chunk);
    }

    return chunks;
};

const MAX_RETRIES = 3;

// Helper function to call TTS and return the audio buffer
export const textToSpeech = async (
    openai: OpenAI,
    model: string,
    voice: Voice,
    text: string,
): Promise<Buffer> => {
    let tries = 0;
    while (true) {
        try {
            const mp3 = await openai.audio.speech.create({
                model,
                voice: voice.toLowerCase() as Voice,
                input: text,
            });
            return Buffer.from(await mp3.arrayBuffer());
        } catch (error) {
            if (tries >= MAX_RETRIES) {
                throw error;
            }
            tries += 1;
        }
    }
};

// Serialize and write audio segments to a file.
export const writeAudioSegmentsToFile = async (
    filepath: string,
    audioSegments: AudioSegment[],
): Promise<void> => {
    process.stdout.write(chalk.yellow("Writing TTS audio output to file..."));
    await writeJSON(
        filepath,
        audioSegments.map((buff) => ({
            ...buff,
            audio: buff.audio.map((buffer) => Array.from(buffer)),
        })),
    );
    console.log(
        CLEAR_LINE + chalk.green(`Finished writing TTS audio output to file.`),
    );
};

// Read and deserialize audio segments from a file.
export const readAudioSegmentsFromFile = async (
    filepath: string,
): Promise<AudioSegment[] | undefined> => {
    try {
        if (existsSync(filepath)) {
            process.stdout.write(
                chalk.yellow("Reading cached TTS audio output..."),
            );
            const audioBuffers = (
                await parseJSON<
                    Array<{
                        title: string;
                        audio: Array<Array<number>>;
                    }>
                >(filepath)
            ).map((buff) => ({
                ...buff,
                audio: buff.audio.map((buffer) => Buffer.from(buffer)),
            }));
            console.log(
                CLEAR_LINE + chalk.green(`Reusing cached TTS audio output.`),
            );
            return audioBuffers;
        }
    } catch (error) {
        console.error(
            "\n" + chalk.red(`Error reading audio segments: ${String(error)}`),
        );
    }

    return undefined;
};

// Generate audio.
export const generateAudio = async (
    intermediateDirectory: string,
    openai: OpenAI,
    ttsModel: string | undefined = DEFAULT_TTS_MODEL,
    ttsVoice: Voice | undefined = DEFAULT_TTS_VOICE,
    metadata: Metadata,
    segments: Array<TextSegment>,
): Promise<AudioSegment[]> => {
    const intermediateAudioPath = path.join(
        intermediateDirectory,
        "audio-buffers.json",
    );

    const cachedAudioSegments = await readAudioSegmentsFromFile(
        intermediateAudioPath,
    );
    if (cachedAudioSegments) {
        return cachedAudioSegments;
    }

    const audioSegments: AudioSegment[] = [];

    console.log(
        `Using voice ${chalk.blue(sentenceCase(ttsVoice))} and model ${chalk.blue(ttsModel)}.`,
    );

    if (metadata.title) {
        // Convert the title to audio
        console.log(`Processing title: ${chalk.blue(metadata.title)}`);
        const titleAudio = await textToSpeech(
            openai,
            ttsModel,
            ttsVoice,
            metadata.title,
        );

        audioSegments.push({ audio: [titleAudio], title: "Title" });
    }

    // Convert each segment to audio
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentBuffers = [];

        if (segment.head) {
            console.log(`Processing segment head: ${chalk.blue(segment.head)}`);
            const headAudio = await textToSpeech(
                openai,
                ttsModel,
                ttsVoice,
                segment.head,
            );
            segmentBuffers.push(headAudio);
        }

        if (segment.content && segment.content.length > 0) {
            const contentChunks = splitTextIntoChunks(
                segment.content,
                TTS_MAX_CHARS,
            );
            for (let j = 0; j < contentChunks.length; j++) {
                const chunk = contentChunks[j];
                console.log(
                    `Processing segment #${chalk.green(i + 1)} of ${chalk.green(
                        segments.length,
                    )}, chunk #${chalk.green(j + 1)} of ${chalk.green(
                        contentChunks.length,
                    )}`,
                );
                const chunkAudio = await textToSpeech(
                    openai,
                    ttsModel,
                    ttsVoice,
                    chunk,
                );
                segmentBuffers.push(chunkAudio);
            }
        }
        audioSegments.push({
            title: segment.head ?? "",
            audio: segmentBuffers,
        });
    }

    await writeAudioSegmentsToFile(intermediateAudioPath, audioSegments);

    // Write title audio for comparing final audio quality. Can be removed
    // without affecting anything.
    const intermediateTitlePath = path.join(intermediateDirectory, "title.mp3");
    await writeFile(intermediateTitlePath, audioSegments[0].audio[0]);

    return audioSegments;
};
