// OpenAI TTS voice options (as of 2 July 2024).
export enum Voice {
    Alloy = "alloy",
    Echo = "echo",
    Fable = "fable",
    Onyx = "onyx",
    Nova = "nova",
    Shimmer = "shimmer",
}

// OpenAI TTS model options.
export enum TTSModel {
    // Standard model.
    TTS_1 = "tts-1",
    // Higher quality but more expensive model.
    TTS_1_HD = "tts-1-hd",
}

// PDF metadata.
export interface Metadata {
    title?: string;
    // LLM generated title if no title is available
    fallbackTitle?: string;
    authors?: string[];
    abstract?: string;
    // Original paper keywords.
    keywords?: string[];
    // LLM rewritten keywords.
    tags?: string[];
    image?: string;
    imageModel?: string;
    voice?: Voice;
    ttsModel?: string;
}

// Segment of a PDF's text content.
export interface TextSegment {
    head: string | undefined;
    content: string;
}

// Audio segment with title and audio buffers.
export interface AudioSegment {
    audio: Buffer[];
    title: string;
}
