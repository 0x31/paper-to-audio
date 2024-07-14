import { expect, describe, test } from "vitest";
import { splitTextIntoChunks } from "../src/audio/generateAudio.js";

describe("splitTextIntoChunks", () => {
    test("correctly splits text into chunks", () => {
        const text = "Sentence one.Sentence two. Sentence three! Sentence four";

        for (const maxLength of [1, 2, 10, 20, 50]) {
            const chunks = splitTextIntoChunks(text, maxLength);

            // Chunks do not exceed maxLength.
            for (const chunk of chunks) {
                expect(chunk.length).to.be.lessThanOrEqual(maxLength);
            }

            // Chunks combine back into original text.
            expect(chunks.join("")).to.equal(text);
        }
    });
});
