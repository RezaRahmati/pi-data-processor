import * as path from 'path';
import dotenv from 'dotenv';
import { globby } from 'globby';
import * as merge from "./csv-merger/index.js";

dotenv.config();

(async () => {
    const folder = process.env.FOLDER;

    const dateTime = getDate();

    const resultFiles = (await globby([`${folder}/**/cmor-result-*.csv`]));
    const missingFiles = (await globby([`${folder}/**/cmor-missing-*.csv`]));

    console.log(`Found ${resultFiles.length} result files`)
    console.log(`Found ${missingFiles.length} missing files`)

    const aggregatedResultFileName = path.join(folder, `cmor-aggregated-result-${dateTime}.csv`);
    await merge.merge(resultFiles, { writeOutput: true, outputPath: aggregatedResultFileName });

    const aggregatedMissingFileName = path.join(folder, `cmor-aggregated-missing-${dateTime}.csv`);
    await merge.merge(missingFiles, { writeOutput: true, outputPath: aggregatedMissingFileName });


})();

function getDate() {
    return new Date()
        .toLocaleString()
        .replace(/[T,]/gi, '')
        .replace(/[\/: ]/gi, '-');
}
