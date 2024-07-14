import { assert } from "@sindresorhus/is";
import OpenAI from "openai";

export const convertFormula = async (
    openai: OpenAI,
    llmModel: string,
    formula: string,
): Promise<string> => {
    const response = await openai.chat.completions.create({
        model: llmModel,
        messages: [
            {
                role: "system",
                content: `Convert the user's formula into a human-readable form suitable for TTS. This is an API so return JSON like '{"formula": "..."}', with no other text, and don't return any errors, falling back to the provided formula if necessary.`,
            },
            { role: "user", content: formula },
        ],
        response_format: { type: "json_object" },
    });

    try {
        const rewritten =
            JSON.parse(response.choices[0].message.content?.trim() ?? "{}")
                .formula ?? formula;

        // Assert the result is a string.
        assert.string(rewritten);

        return rewritten;
    } catch (error) {
        console.error(error);
        return formula;
    }
};
