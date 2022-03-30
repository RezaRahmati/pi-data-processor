import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv'
import { default as fetch } from 'node-fetch';
import { default as FormData } from "form-data";
import { default as converter } from 'json-2-csv';
import { globby } from 'globby';

dotenv.config();

(async () => {

    try {
        const start = new Date();
        const dir = process.env.FOLDER;
        const delayMs = +process.env.DELAY;

        // Get the files as an array
        const files = (await globby([`${dir}/**/*`])).filter(f => !f.includes('cmor-result'));

        const promises = [];

        let fileIndex = 0;
        let processedCount = 0;
        let filesCount = files.length;

        for (let file of files) {

            await delay(delayMs);

            fileIndex += 1;

            if (!fs.existsSync(file)) {
                continue;
            }

            console.log(`Processing ${file} started. ${fileIndex} of ${filesCount}`);

            const formData = new FormData();
            formData.append('file', fs.createReadStream(file));
            formData.append('infoTypes', process.env.INFO_TYPES);
            formData.append('fullFileName', file);
            formData.append('likelihood', 'VERY_LIKELY');

            promises.push(
                fetch(process.env.API_URL, {
                    method: 'POST',
                    headers: {
                        "api-key": process.env.API_KEY,
                    },
                    body: formData
                })
                    .then((res) => {
                        processedCount += 1;
                        if (!res.ok) {
                            try {
                                return res.json();
                            } catch (err) {
                                console.error(res);
                                throw new Error(res)
                            }
                        }

                        return res.json();
                    })
                    .then((res) => {
                        if (res.fileName) {
                            console.log(`Processing ${res.fileName} done. ${processedCount} of ${filesCount}`);
                        } else {
                            console.error(`Error Processing ${file}. ${processedCount} of ${filesCount}`, res);
                        }

                        return res;
                    })
            );

        }

        const responses = await Promise.allSettled(promises);
        const data = responses.map(r => {
            if (r.status === 'fulfilled') {
                const value = r.value;

                return {
                    fileName: value.fileName || '',
                    hasAnyPiData: value.stats && value.stats.length > 0,
                    fullFileName: value.fullFileName || '',
                    fileSizeBytes: value.fileSizeBytes || '',
                    durationSeconds: value.durationSeconds || '',
                    data: (value.data || []).map(d => `${d.infoType || ''}:${d.data || ''}`).join(`;`) || '',
                    stats: (value.stats || []).map(d => `${d.infoType || ''}:${d.count || ''}`).join(`;`) || '',
                    error: '',
                }
            } else {
                return {
                    fileName: '',
                    hasAnyPiData: '',
                    fullFileName: '',
                    fileSizeBytes: '',
                    durationSeconds: '',
                    data: '',
                    stats: '',
                    error: r.reason
                }
            }
        });

        const dateTime = getDate();

        const csvData = await converter.json2csvAsync(data);
        fs.writeFileSync(path.join(dir, `cmor-result-${dateTime}.csv`), csvData);

        const allSuccessfulFiles = data.map(d => d.fileName);
        const allUnsuccessfulFiles = files.filter(f => !allSuccessfulFiles.includes(f));
        if (allUnsuccessfulFiles && allUnsuccessfulFiles.length) {
            const allUnsuccessfulFilesCsv = await converter.json2csvAsync(allUnsuccessfulFiles.map(f => ({ fullFileName: f })));
            fs.writeFileSync(path.join(dir, `cmor-result-missing-files-${dateTime}.csv`), allUnsuccessfulFilesCsv);
        }

        const end = new Date();

        console.log(`Processing ${filesCount} files done in ${(end - start) / 1000}s`)
    }
    catch (e) {
        console.error("Whoops!", e);
    }

})();

const getDate = () => {
    return new Date().toLocaleString().replace(/[T,]/gi, '').replace(/[\/: ]/gi, '-');
}

const delay = (ms) => {
    return new Promise((resolve, reject) => setTimeout(resolve, ms));
}
