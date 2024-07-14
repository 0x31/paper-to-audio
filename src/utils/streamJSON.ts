import bfj from "bfj";
import chalk from "chalk";
import fs from "fs";
import { readFile, writeFile } from "fs/promises";
import JSONStream from "jsonstream";

export const parseJSON = async <T>(filePath: string): Promise<T> => {
    try {
        return JSON.parse((await readFile(filePath)).toString());
    } catch (error) {
        console.warn(
            chalk.yellow(
                `Built-in JSON parser failed to read ${chalk.blue(
                    filePath,
                )}. Attempting to stream JSON.`,
            ),
        );
    }

    const readStream = fs.createReadStream(filePath, { encoding: "utf8" });
    const jsonStream = JSONStream.parse("*");

    return new Promise((resolve, reject) => {
        let result: T;
        readStream
            .pipe(jsonStream)
            .on("data", (data: T) => {
                result = data;
            })
            .on("end", () => resolve(result))
            .on("error", reject);
    });
};

export const writeJSON = async <T>(
    filePath: string,
    data: T,
): Promise<void> => {
    try {
        try {
            return await writeFile(filePath, JSON.stringify(data));
        } catch (error) {
            console.warn(
                chalk.yellow(
                    `Built-in JSON parser failed to write data to ${chalk.blue(
                        filePath,
                    )}. Attempting to stream JSON.`,
                ),
            );
        }

        const writeStream = fs.createWriteStream(filePath, {
            encoding: "utf8",
        });
        const jsonStream = JSONStream.stringify();

        jsonStream.pipe(writeStream);

        // JSONStream does allow writing objects.
        jsonStream.write(data as unknown as string | Uint8Array);

        jsonStream.end();

        return new Promise((resolve, reject) => {
            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
        });
    } catch (error) {
        // Third fallback, can be removed once secondary fallback has been tested.
        console.warn(
            chalk.yellow(
                `JSON stream failed to write data to ${chalk.blue(
                    filePath,
                )}. Attempting secondary fallback.`,
            ),
        );
        bfj.write(filePath, data);
    }
};
