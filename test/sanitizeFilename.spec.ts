import { expect, describe, test } from "vitest";
import { sanitizeFilename } from "../src/utils/utils.js";

describe("sanitizeFilename", () => {
    test("replaces invalid characters", () => {
        expect(sanitizeFilename("test/file.mp3")).to.equal("test_file.mp3");
        expect(sanitizeFilename("test/file.mp3", "-")).to.equal(
            "test-file.mp3",
        );
        expect(sanitizeFilename("test\x01file.mp3")).to.equal("test_file.mp3");
        expect(sanitizeFilename("test\\file.mp3")).to.equal("test_file.mp3");
    });

    test("removes double replacement characters", () => {
        expect(sanitizeFilename("test//file.mp3")).to.equal("test_file.mp3");
    });

    test("doesn't change valid filenames", () => {
        expect(sanitizeFilename("test file.mp3")).to.equal("test file.mp3");
        expect(sanitizeFilename("test.tar.gz")).to.equal("test.tar.gz");
    });
});
