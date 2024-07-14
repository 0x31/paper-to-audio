import { describe, test } from "vitest";
import { generateID3Tags } from "../src/audio/generateID3Tags.js";
import mp3Duration from "mp3-duration";
import { getHardcodedAudioPadding } from "../src/audio/audioUtils.js";
import { expect } from "chai";

describe("generateID3Tags", async () => {
    const paddingLength = await mp3Duration(await getHardcodedAudioPadding());

    test("generates ID3 tags with chapters", async () => {
        const tags = await generateID3Tags(
            [
                { title: "A", audio: [Buffer.from([])] },
                { title: "B", audio: [Buffer.from([])] },
            ],
            {
                title: "Example",
                authors: ["John Smith", "Adam Adam"],
                abstract: "Abstract",
                keywords: ["Tag 1", "Tag 2"],
                tags: ["Tag 1", "Tag 2"],
            },
        );
        expect(tags.chapter![0].elementID).to.equal("A");
        expect(tags.chapter![0].startTimeMs).to.equal(0);
        expect(tags.chapter![0].endTimeMs).to.equal(paddingLength * 1000);

        expect(tags.chapter![1].elementID).to.equal("B");
        expect(tags.chapter![1].startTimeMs).to.equal(paddingLength * 1000);
        expect(tags.chapter![1].endTimeMs).to.equal(2 * paddingLength * 1000);
        expect(tags.title).to.equal("Example");
        expect(tags.artist).to.equal("John Smith, Adam Adam");
        expect(tags.comment?.text).to.equal("Abstract\nKeywords: Tag 1; Tag 2");
        expect(tags.genre).to.equal("Tag 1//Tag 2");
    });
});
