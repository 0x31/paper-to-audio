import fs from "fs";
import OpenAI from "openai";
import { config } from "dotenv";

import chalk from "chalk";
import { generateCoverImage } from "./images/generateCoverImage.js";
import { flagIsSet, replaceExtension, resolvePdfPath } from "./utils/utils.js";
import { generateMP3File } from "./audio/generateMP3File.js";
import { generateAudio, randomVoice } from "./audio/generateAudio.js";
import { TTSModel, Voice } from "./types.js";
import { getIntermediateDirectory } from "./fs/intermediateDirectory.js";
import { extractSegments } from "./text/extractSegments.js";
import prompts from "prompts";
import { generateTags } from "./metadata/generateTags.js";
import { writeMetadata } from "./metadata/metadata.js";
import { generateTitle } from "./metadata/generateTitle.js";

const {
    OPENAI_API_KEY,
    LLM_MODEL,
    GROBID_URL,
    SKIP_CITATIONS,
    INCLUDE_FIGURES,
    SKIP_NOTES,
    IMAGE_MODEL,
    TTS_MODEL,
    TTS_VOICE,
} = config().parsed ?? {};

const main = async (...args: string[]) => {
    ////////////////////////////////////////////////////////////////////////////

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    if (!args[0]) {
        console.log(chalk.red(`Usage: paper-to-audio ./path/to/document.pdf`));
        process.exit(1);
    }

    const filepath = await resolvePdfPath(args[0]);
    const outputFilepath = replaceExtension(filepath, ".mp3");

    // Check if output file already exists.
    if (fs.existsSync(outputFilepath)) {
        console.warn(
            chalk.red(`File ${chalk.blue(outputFilepath)} already exists.`),
        );
        const response = await prompts({
            type: "confirm",
            name: "overwrite",
            message: `Do you want to overwrite ${outputFilepath}?`,
            initial: false, // default is no
        });

        if (!response.overwrite) {
            process.exit(1);
        }
    }

    console.log(chalk.yellow(`Processing ${chalk.blue(filepath)}.`));

    const intermediateDirectory = await getIntermediateDirectory(filepath);

    console.log(
        chalk.yellow(
            `Storing intermediate files in ${chalk.blue(intermediateDirectory)}.`,
        ),
    );

    // EXTRACT TEXT FROM PDF USING GROBID //////////////////////////////////////

    const { metadata, segments } = await extractSegments(
        intermediateDirectory,
        openai,
        filepath,
        {
            grobidUrl: GROBID_URL,
            llmModel: LLM_MODEL,
            includeFigures: flagIsSet(INCLUDE_FIGURES),
            skipCitations: flagIsSet(SKIP_CITATIONS),
            skipNotes: flagIsSet(SKIP_NOTES),
        },
    );

    // PARSE KEYWORDS //////////////////////////////////////////////////////////

    if (
        (!metadata.title || metadata.title.length === 0) &&
        !metadata.fallbackTitle
    ) {
        metadata.fallbackTitle = await generateTitle(
            openai,
            LLM_MODEL,
            metadata,
            segments,
        );

        // Update metadata.
        await writeMetadata(intermediateDirectory, metadata);
    }

    // PARSE KEYWORDS //////////////////////////////////////////////////////////

    if (!metadata.tags || metadata.tags.length === 0) {
        metadata.tags = await generateTags(openai, LLM_MODEL, metadata);

        // Update metadata.
        await writeMetadata(intermediateDirectory, metadata);
    }

    // GENERATE COVER IMAGE USING DALL-E ///////////////////////////////////////

    if (!metadata.image) {
        metadata.imageModel = IMAGE_MODEL ?? metadata.imageModel;
        metadata.image = await generateCoverImage(
            intermediateDirectory,
            openai,
            metadata.imageModel,
            metadata,
        );

        // Update metadata.
        await writeMetadata(intermediateDirectory, metadata);
    }

    // GENERATE AUDIO USING OPENAI TTS /////////////////////////////////////////

    metadata.ttsModel = (TTS_MODEL ?? metadata.ttsModel) as
        | TTSModel
        | undefined;
    metadata.voice = (TTS_VOICE ?? metadata.voice ?? randomVoice()) as Voice;

    const audioSegments = await generateAudio(
        intermediateDirectory,
        openai,
        metadata.ttsModel,
        metadata.voice,
        metadata,
        segments,
    );

    // Update metadata.
    await writeMetadata(intermediateDirectory, metadata);

    // ENCODE MP3 WITH CHAPTER MARKINGS ////////////////////////////////////////

    await generateMP3File(outputFilepath, audioSegments, metadata);

    ////////////////////////////////////////////////////////////////////////////
};

main(...process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exit(1);
});
