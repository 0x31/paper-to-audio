declare module "mp3-duration" {
    const mp3Duration: (audio: Buffer) => Promise<number>;
    export default mp3Duration;
}

declare module "bfj" {
    interface BFJOptions {}

    function parse<T>(filePath: ReadStream, options?: BFJOptions): Promise<T>;
    function write<T>(
        filePath: string,
        data: T,
        options?: BFJOptions,
    ): Promise<void>;

    export = { parse, write };
}
