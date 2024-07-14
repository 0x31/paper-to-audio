import xpath from "xpath";
import OpenAI from "openai";
import chalk from "chalk";
import { convertFormula } from "./convertFormula.js";

export const DEFAULT_LLM_MODEL = "gpt-4o";

// Function to convert formulas in an Element node using XPath
export const processFormulas = async (
    openai: OpenAI,
    llmModel: string | undefined = DEFAULT_LLM_MODEL,
    htmlElement: Element,
): Promise<Element> => {
    // Select all <formula> elements using XPath
    const formulaNodes = xpath.select(
        "//*[local-name()='formula']",
        htmlElement,
    ) as Element[];

    if (formulaNodes.length > 0) {
        console.log(
            chalk.yellow(
                `Rewriting formulas using ${chalk.blue(llmModel)} to be suitable for TTS...`,
            ),
        );
    }

    for (let i = 0; i < formulaNodes.length; i++) {
        const formula = formulaNodes[i];
        const formulaText = formula.textContent || "";
        console.log(
            `Processing formula ${chalk.yellow(i + 1)} of ${chalk.yellow(
                formulaNodes.length,
            )}: ${chalk.blue(formulaText)}`,
        );

        const humanReadable = await convertFormula(
            openai,
            llmModel,
            formulaText,
        );
        console.log("> " + chalk.green(humanReadable));
        formula.textContent = humanReadable;
    }

    return htmlElement;
};
