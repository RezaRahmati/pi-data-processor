import fs from 'fs';

export function firstLine(filePath) {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(filePath, {
            encoding: 'utf8',
        });

        let content = '';
        let firstLineLength = 0;
        let chunkLineEndIndex = -1;

        readStream
            .on('data', (chunk) => {
                content += chunk;
                chunkLineEndIndex = chunk.indexOf('\n');

                if (chunkLineEndIndex < 0) {
                    firstLineLength += chunk.length;
                } else {
                    firstLineLength += chunkLineEndIndex;
                    readStream.close();
                }
            })
            .on('close', () => {
                const firstLineStartIndex = content.charCodeAt(0) === 0xFEFF ? 1 : 0;
                return resolve(content.slice(firstLineStartIndex, firstLineLength));
            })
            .on('error', reject);
    });
}
