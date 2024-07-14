import OpenAI from "openai";
import { Metadata, TextSegment } from "../types.js";
import { DEFAULT_LLM_MODEL } from "../text/formulas/processFormulas.js";
import chalk from "chalk";
import { assert } from "@sindresorhus/is";
import { CLEAR_LINE } from "../utils/utils.js";

export const generateTitle = async (
    openai: OpenAI,
    llmModel: string = DEFAULT_LLM_MODEL,
    metadata: Metadata,
    segments: TextSegment[],
): Promise<string> => {
    process.stdout.write(
        chalk.yellow(
            `${chalk.red("Unable to extract title.")} Generating fallback title using ${chalk.blue(llmModel)}...`,
        ),
    );

    const response = await openai.chat.completions.create({
        model: llmModel,
        messages: [
            {
                role: "system",
                content: `Generate a title for the following research paper, using the provided abstract or snippet. The response should be a JSON in the format \`{"title": "..."}\``,
            },
            {
                role: "user",
                content:
                    (metadata.abstract
                        ? `Abstract: \`\`\`${metadata.abstract}\`\`\`\n`
                        : "") +
                    `Snippet: \`\`\`${segments
                        .map((segment) => segment.head + "\n" + segment.content)
                        .join("\n")
                        .slice(0, 4096)}...\`\`\``,
            },
        ],
        response_format: { type: "json_object" },
    });

    try {
        const title: string[] =
            JSON.parse(response.choices[0].message.content?.trim() ?? "[]")
                .title ?? [];

        // Check response type.
        assert.string(title);

        console.log(
            CLEAR_LINE +
                chalk.green(`Generated fallback title: `) +
                chalk.blue(title),
        );

        return title;
    } catch (error) {
        console.error(error);
        return "";
    }
};
