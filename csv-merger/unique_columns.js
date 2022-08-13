import * as csvParse from 'csv-parse';

import { firstLine } from './first-line.js';

export async function getUniqueColumns(inputFiles) {
    const uniqueColumnsSet = new Set();

    for (const inputFile of inputFiles) {
        const headerString = await firstLine(inputFile);
        if (!headerString) {
            continue;
        }
        const header = await getColumnHeaders(inputFile, headerString);

        header.forEach((column) => {
            uniqueColumnsSet.add(column);
        });
    }

    const uniqueColumns = Array.from(uniqueColumnsSet);

    return uniqueColumns;
}

function getColumnHeaders(inputFile, headerString) {
    return new Promise((resolve, reject) => {
        csvParse.parse(headerString, (error, result) => {
            if (error) {
                return reject(error);
            }

            if (!Array.isArray(result) || result.length < 1) {
                return reject(`invalid csv header ${inputFile}`);
            }

            resolve(result[0]);
        });
    });
}
