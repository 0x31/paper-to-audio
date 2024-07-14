import prompts from "prompts";
import { Buffer } from "buffer";
import OpenAI from "openai";
import { Metadata } from "../types.js";
import chalk from "chalk";
import { randomElement, sanitizeFilename } from "../utils/utils.js";
import path from "path";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import terminalImage, { Options } from "term-img";
import { getShortTitle } from "../metadata/metadata.js";

const DEFAULT_IMAGE_MODEL = "dall-e-3";

// Colors are chosen randomly as theme colors when generating images, to add
// diversity.
const colors = [
    "red",
    "orange",
    "yellow",
    "mustard",
    "green",
    "blue",
    "indigo",
    "violet",
    "white",
    "black",
    "pink",
    "purple",
    "lime",
    "silver",
    "gold",
];

enum CoverStyle {
    Specific,
    Generic,
    Artistic,
}

export const generateDalleImage = async (
    openai: OpenAI,
    imageModel: string,
    metadata: Metadata,
    style?: CoverStyle,
): Promise<string> => {
    const themeColor = randomElement(colors);

    const shortTitle = getShortTitle(metadata);

    const prompt =
        style === CoverStyle.Generic && metadata.title
            ? `The text \`\`\`${metadata.title}\`\`\` on top of a background inspired by the contents of the title, digital file preview image for the research paper`
            : `Generate a cover artwork for the research paper ${
                  metadata.title ? "titled" : "on the topic of"
              } \`\`\`${
                  metadata.title || metadata.fallbackTitle
              }\`\`\`. Use ${themeColor} as a highlight color, but not too strong. ${
                  style === CoverStyle.Artistic
                      ? `Trendy artistic graphic design, designed in Figma, inspired by Dribbble. ${shortTitle ? `The only text should be \`${shortTitle}\`` : "No text."}`
                      : metadata.title
                        ? "Display the full title text, which is the most important part of the image."
                        : ""
              } Exported PNG file, full zoom. ${
                  metadata.abstract
                      ? `The full abstract is as follows: ${metadata.abstract}`
                      : ""
              }`;

    const response = await openai.images.generate({
        model: imageModel,
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
    });
    console.log(
        `Revised prompt returned from ${chalk.blue(imageModel)}: ${chalk.blue(response.data[0].revised_prompt)}`,
    );
    return response.data[0].b64_json!;
};

export const generateCoverImage = async (
    intermediateDirectory: string,
    openai: OpenAI,
    imageModel: string = DEFAULT_IMAGE_MODEL,
    metadata: Metadata,
): Promise<string> => {
    const imagePath = path.join(intermediateDirectory, "images");
    await mkdir(imagePath, { recursive: true });

    let images: string[] = [];

    // Read existing images from imagePath
    const existingImages = (await readdir(imagePath))
        .filter((file) => path.extname(file).toLowerCase() === ".png")
        .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)![0]); // Extract numeric part from filename a
            const numB = parseInt(b.match(/\d+/)![0]); // Extract numeric part from filename b

            return numA - numB; // Compare and sort numerically
        })
        .map((file) => path.join(imagePath, file));

    const imgcatOptions: Options & { name: string } = {
        name: `${sanitizeFilename(metadata.title ?? "")}.png`,
        width: 64,
        preserveAspectRatio: true,
    };
    let generate = true;

    if (process.env.TERM_PROGRAM !== "iTerm.app") {
        console.warn(
            chalk.red(
                `WARNING: Displaying image previews is only supported for iTerm3, please open images manually.`,
            ),
        );
    }

    // Images names are numbers.`highestImageName` is the largest such number,
    // to be used as the starting point for generated images.
    let highestImageName = 0;
    existingImages.forEach((file) => {
        const num = parseInt(
            path.basename(file).replace(path.extname(file), ""),
            10,
        );
        if (!isNaN(num) && num > highestImageName) {
            highestImageName = num;
        }
    });

    if (existingImages.length > 0) {
        generate = false;
        images = [...existingImages];

        // Display existing images
        for (let i = 0; i < images.length; i++) {
            console.log(chalk.yellow(`Displaying existing image #${i + 1}`));
            const imageBuffer = await readFile(images[i]);
            console.log(
                terminalImage(imageBuffer, {
                    ...imgcatOptions,
                    fallback: () => `Image #${i + 1}: ${chalk.blue(images[i])}`,
                }),
            );
        }
    }

    while (true) {
        if (generate) {
            console.log(
                chalk.yellow(
                    `Generating cover image options using ${chalk.blue(imageModel)}...`,
                ),
            );

            try {
                const newImages = await Promise.all([
                    generateDalleImage(
                        openai,
                        imageModel,
                        metadata,
                        CoverStyle.Specific,
                    ),
                    generateDalleImage(
                        openai,
                        imageModel,
                        metadata,
                        CoverStyle.Generic,
                    ),
                    generateDalleImage(
                        openai,
                        imageModel,
                        metadata,
                        CoverStyle.Artistic,
                    ),
                ]).then((images) =>
                    images.map((image) => Buffer.from(image, "base64")),
                );

                // Save new images to imagePath
                for (let i = 0; i < newImages.length; i++) {
                    const imageName = String(highestImageName + 1);
                    highestImageName += 1;

                    const newImagePath = path.join(
                        imagePath,
                        `${imageName}.png`,
                    );
                    await writeFile(newImagePath, newImages[i]);
                    images.push(newImagePath);

                    // Display new images
                    console.log(
                        chalk.yellow(`Displaying new image #${images.length}`),
                    );
                    console.log(
                        terminalImage(newImages[i], {
                            ...imgcatOptions,
                            fallback: () =>
                                `Image #${imageName}: ${chalk.blue(
                                    newImagePath,
                                )}`,
                        }),
                    );
                }
            } catch (error) {
                console.warn(String(error));
            }
        }

        // Ask user to select an image
        const selected = await prompts({
            type: "select",
            name: "selectedImage",
            message: "Select an image:",
            choices: [
                ...images.map((image, index) => ({
                    title: `Image #${index + 1} ${chalk.gray("(" + path.basename(image) + ")")}`,
                    value: index,
                })),
                { title: "Generate more", value: -1 },
            ],
        });

        if (selected.selectedImage === undefined) {
            throw new Error("No image selected.");
        }

        if (selected.selectedImage === -1) {
            generate = true;
            // Clear images array to generate new images
            continue;
        }

        return images[selected.selectedImage];
    }
};
