import OpenAI from "openai";
import { Metadata } from "../types.js";
import { DEFAULT_LLM_MODEL } from "../text/formulas/processFormulas.js";
import chalk from "chalk";
import { assert } from "@sindresorhus/is";
import { CLEAR_LINE } from "../utils/utils.js";

export const generateTags = async (
    openai: OpenAI,
    llmModel: string = DEFAULT_LLM_MODEL,
    metadata: Metadata,
): Promise<string[]> => {
    process.stdout.write(
        chalk.yellow(
            `Generating tags based on keywords using ${chalk.blue(llmModel)}...`,
        ),
    );

    const response = await openai.chat.completions.create({
        model: llmModel,
        messages: [
            {
                role: "system",
                content: `Parse the keywords for the following research paper, fixing any formatting issues, using title case, and ignoring any sentences accidentally included. If no keywords are provided, generate tags based on the title and abstract. The response should be a JSON in the format \`{"tags": ["tag1", "tag2", ...]}\``,
            },
            {
                role: "user",
                content: `Title: \`\`\`${metadata.title || metadata.fallbackTitle}\`\`\`\nAbstract: \`\`\`${metadata.abstract}\`\`\`\nKeywords (separated by //): \`\`\`${metadata.keywords?.join("//")}\`\`\``,
            },
        ],
        response_format: { type: "json_object" },
    });

    try {
        const tags: string[] =
            JSON.parse(response.choices[0].message.content?.trim() ?? "[]")
                .tags ?? [];

        // Check response type.
        assert.array(tags, assert.string);

        console.log(
            CLEAR_LINE +
                chalk.green(`Generated tags: `) +
                tags.map((tag) => chalk.blue(tag)).join(", "),
        );

        return tags;
    } catch (error) {
        console.error(error);
        return [];
    }
};
