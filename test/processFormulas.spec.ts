import { expect, describe, test, vi } from "vitest";
import { JSDOM } from "jsdom";
import OpenAI from "openai";
import { processFormulas } from "../src/text/formulas/processFormulas.js";

// Mock the convertFormula function
vi.mock("../src/text/formulas/convertFormula.js", () => ({
    convertFormula: async (
        _openai: OpenAI,
        _llmModel: string,
        formula: string,
    ) => {
        const commonSymbols = {
            "+": "plus",
            "=": "equals",
            "^2": " squared",
        };
        return Object.entries(commonSymbols).reduce(
            (formula, [symbol, word]) => formula.replace(symbol, word),
            formula,
        );
    },
}));

const openai = {} as unknown as OpenAI;
const llmModel = "llm";

describe("processFormulas", () => {
    test("processes formula tags and converts them to English", async () => {
        const html = `
      <div>
        <formula>1 + 2</formula>
        <p>Some text</p>
        <formula>E = mc^2</formula>
        <formula></formula>
      </div>
    `;
        const dom = new JSDOM(html);
        const document = dom.window.document;
        const element = document.querySelector("div");

        const processedElement = await processFormulas(
            openai,
            llmModel,
            element!,
        );

        const formulas = processedElement?.querySelectorAll("formula");
        expect(formulas?.[0]?.textContent).toBe("1 plus 2");
        expect(formulas?.[1]?.textContent).toBe("E equals mc squared");
    });
});
