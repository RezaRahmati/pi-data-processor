import * as csvParse from 'csv-parse';
import * as csvStringify from 'csv-stringify';
import fs from 'fs';
import { Transform } from 'stream';

export function writeWithColumns(
    inputFile,
    uniqueColumns,
    isFirstOutput,
    options,
) {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(inputFile);

        const csvParesr = csvParse.parse({ columns: true });
        const csvStringifier = csvStringify.stringify({ header: isFirstOutput, columns: uniqueColumns });

        const outputStream = readStream
            .pipe(csvParesr)
            .pipe(csvStringifier)
            .pipe(new StatsStream(inputFile));

        if (options.writeOutput) {
            const writeStream = fs.createWriteStream(options.outputPath, {
                flags: isFirstOutput ? 'w' : 'a',
            });

            outputStream
                .pipe(writeStream)
                .on('close', () => {
                    return resolve('');
                })
                .on('error', reject);
        } else {
            let data = '';

            outputStream
                .on('data', (chunk) => {
                    data += chunk.toString();
                })
                .on('error', reject)
                .on('finish', () => {
                    resolve(data);
                });
        }
    });
}

export class StatsStream extends Transform {
    rowCount = 0;
    file = '';

    constructor(file) {
        super();
        this.file = file
    }

    // tslint:disable-next-line:variable-name
    _transform(chunk, _encoding, next) {
        const stringContent = chunk.toString();
        const rowsLength = (stringContent.match(/\n/g) || []).length;
        this.rowCount += rowsLength;

        this.push(chunk);

        next();
    }

    _flush(next) {
        next();
        console.log(`merged ${this.rowCount} rows from ${this.file}`);
    }
}
