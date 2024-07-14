import fs from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import axios from "axios";
import chalk from "chalk";
import { CLEAR_LINE } from "../utils/utils.js";

const DEFAULT_GROBID_URL = "https://kermitt2-grobid.hf.space";

export const callGrobid = async (
    intermediateDirectory: string,
    grobidUrl: string = DEFAULT_GROBID_URL,
    pdfPath: string,
): Promise<string> => {
    const intermediateXMLPath = path.join(
        intermediateDirectory,
        "intermediate.xml",
    );

    if (fs.existsSync(intermediateXMLPath)) {
        try {
            console.log(chalk.green(`Reusing cached GROBID response.`));
            return (await readFile(intermediateXMLPath)).toString();
        } catch (error) {
            console.error(error);
        }
    }

    const pdfBuffer = await readFile(pdfPath);
    const formData = new FormData();
    formData.append("input", new Blob([pdfBuffer]), "input.pdf");

    process.stdout.write(chalk.yellow(`Calling GROBID API...`));
    const response = await axios.post(
        new URL("/api/processFulltextDocument", grobidUrl).toString(),
        formData,
        {
            headers: { "Content-Type": "multipart/form-data" },
        },
    );
    console.log(CLEAR_LINE + chalk.green(`Done calling GROBID.`));

    await writeFile(intermediateXMLPath, response.data);

    return response.data;
};
