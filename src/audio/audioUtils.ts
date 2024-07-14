import { readFile } from "fs/promises";
import { AudioSegment } from "../types.js";
import path from "path";

// Having a hard-coded padding.mp3 file was simpler than generating silent audio
// dynamically.
export const getHardcodedAudioPadding = async (): Promise<Buffer> =>
    await readFile(path.resolve("./src/audio/padding.mp3"));

// Concatenate audio segments into a buffer.
export const audioSegmentsToBuffer = async (
    audioSegments: AudioSegment[],
): Promise<Buffer> => {
    const paddingBuffer = await getHardcodedAudioPadding();
    return Buffer.concat(
        audioSegments
            .flatMap((audio) => audio.audio)
            .flatMap((buffer) => [buffer, paddingBuffer]),
    );
};
