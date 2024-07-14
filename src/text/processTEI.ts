import { DOMParser as XMLParser } from "xmldom";

import xpath from "xpath";
import { Metadata, TextSegment } from "../types.js";
import { sentenceCase } from "change-case";

// Function to extract metadata from a TEI document, including title, authors
// and abstract.
export const extractTeiMetadata = (doc: Document): Metadata => {
    // Extract the <teiHeader> element
    const teiHeader = xpath.select1(
        "//*[local-name()='teiHeader']",
        doc,
    ) as Element;

    if (!teiHeader) {
        throw new Error("TEI header not found");
    }

    // Extract the title using XPath
    const titleNode = xpath.select1(
        "//*[local-name()='fileDesc']//*[local-name()='title' and @level='a' and @type='main']",
        teiHeader,
    );
    const title = (titleNode as Node)?.textContent?.trim() || "";

    // Extract the authors using XPath
    const authorNodes = xpath.select(
        "//*[local-name()='fileDesc']//*[local-name()='author']/*[local-name()='persName']",
        teiHeader,
    ) as Node[];
    const authors = authorNodes.map((authorNode) => {
        return Array.from(authorNode.childNodes)
            .map((node) => node.textContent)
            .join(" ")
            .trim();
    });

    // Extract the abstract using XPath
    const abstractNode = xpath.select1(
        "//*[local-name()='profileDesc']//*[local-name()='abstract']",
        teiHeader,
    );
    const abstract = (abstractNode as Node)?.textContent?.trim();

    // Extract the keywords using XPath
    const keywordNodes = xpath.select(
        "//*[local-name()='profileDesc']//*[local-name()='keywords']/*[local-name()='term']",
        teiHeader,
    ) as Node[];
    const keywords = keywordNodes.map(
        (keywordNode) => keywordNode.textContent?.trim() || "",
    );

    return { title, authors, abstract, keywords };
};

// Function to process the TEI body element, extracting segments each containing
// a header and its text content.
export const processTeiBody = (
    body: Element,
    options: { includeFigures?: boolean; skipNotes?: boolean } = {},
): Array<TextSegment> => {
    const result: Array<TextSegment> = [];
    const childNodes = Array.from(body.childNodes);

    // Remove empty Text nodes
    const filteredNodes = childNodes.filter((node) => {
        if (node.constructor.name === "Text" && node.nodeValue?.trim() === "") {
            return false;
        }
        if (node.nodeName === "figure" && !options.includeFigures) {
            return false;
        }
        if (node.nodeName === "notes" && options.skipNotes) {
            return false;
        }
        return true;
    });

    // Process remaining nodes
    filteredNodes.forEach((node) => {
        if (node.constructor.name === "Element") {
            const element = node as Element;
            const headElement = element.getElementsByTagName("head")[0];
            let head: string | undefined = undefined;

            if (headElement) {
                const headText = headElement.textContent?.trim() || "";
                const headAttr = headElement
                    .getAttribute("n")
                    ?.replace(/.$/, "");
                head = headAttr
                    ? `Section ${headAttr} - ${headText}`
                    : headText;
                element.removeChild(headElement);
            } else {
                if (element.nodeName !== "div") {
                    // Use node name, e.g. `Note`, `Figure`, etc.
                    head = sentenceCase(element.nodeName);
                }
            }

            const content = element.textContent!;
            result.push({ head, content });
        } else {
            const content = node.textContent!;
            // convert(new Serializer().serializeToString(node)); //
            result.push({ head: sentenceCase(node.nodeName), content });
        }
    });

    return result;
};

// Adjust reference text for readability.
export const processReferences = (
    bodyNode: Element,
    options: { skipCitations?: boolean } = {},
): Element => {
    if (bodyNode && typeof bodyNode === "object") {
        const refNodes = xpath.select(
            "//*[local-name()='ref' and @type='bibr']",
            bodyNode,
        ) as Node[];

        refNodes.forEach((refNode) => {
            if (options.skipCitations) {
                refNode.textContent = "";
            }

            const originalContent = refNode.textContent;

            if (
                originalContent?.startsWith("[") &&
                originalContent.endsWith("]")
            ) {
                refNode.textContent = originalContent.replace(
                    /^\[(.*)\]$/,
                    "[Reference $1]",
                );
            } else if (
                originalContent?.startsWith("[") &&
                originalContent.endsWith(",")
            ) {
                refNode.textContent = originalContent.replace(
                    /^\[(.*),$/,
                    "[References $1,",
                );
            } else if (originalContent?.endsWith("]")) {
                refNode.textContent = originalContent.replace(
                    /^(.*)]$/,
                    "and $1]",
                );
            }
        });
    }

    return bodyNode;
};

// Extract the metadata and the main text from a TEI XML document.
export const parseTeiXML = async (
    xmlString: string,
): Promise<{ body: Element; metadata: Metadata }> => {
    // Parse the XML string
    const doc = new XMLParser().parseFromString(xmlString, "application/xml");

    const metadata = extractTeiMetadata(doc);

    // Define the XPath expression to find the <body> element
    const select = xpath.useNamespaces({ x: "http://www.w3.org/1999/xhtml" });

    const body = select("//*[local-name()='body']", doc, true) as Element;

    return { body, metadata };
};
