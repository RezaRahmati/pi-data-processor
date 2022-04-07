import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { default as fetch } from 'node-fetch';
import { default as FormData } from 'form-data';
import { default as converter } from 'json-2-csv';
import { globby } from 'globby';

dotenv.config();

(async () => {
    const folder = process.env.FOLDER;
    const subFolders = (process.env.SUB_FOLDERS || '').split(',');

    for (let subFolder of subFolders) {
        const finalPath = path.join(folder, subFolder).replace(/\\/g, '/');
        try {
            await scanFolder(finalPath);
        } catch (err) {
            console.error(`Error processing ${subFolder}`, err);
        }
    }
})();

async function scanFolder(folder) {
    try {
        const delayMs = +process.env.DELAY;
        const likelihood = process.env.LIKELIHOOD;
        const start = new Date();

        console.log(`************ ${folder} ***************`);

        // Get the files as an array
        const files = (await globby([`${folder}/**/*`])).filter(
            (f) => !f.includes('cmor-result'),
        );

        const promises = [];

        let fileIndex = 0;
        let processedCount = 0;
        let filesCount = files.length;

        console.log(`${filesCount} files found in ${folder}`);

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
            formData.append('likelihood', likelihood);

            promises.push(
                fetch(process.env.API_URL, {
                    method: 'POST',
                    headers: {
                        'api-key': process.env.API_KEY,
                        Accept: 'application/json',
                    },
                    body: formData,
                })
                    .then((res) => {
                        processedCount += 1;
                        if (!res.ok) {
                            try {
                                return res.json();
                            } catch (err) {
                                console.error('Error converting to json 1', res);
                                throw new Error(res.text());
                            }
                        }

                        try {
                            return res.json();
                        } catch (err) {
                            console.error('Error converting to json 2', res);
                            throw new Error(res.text());
                        }
                    })
                    .then((res) => {
                        if (res.fileName) {
                            console.log(
                                `Processing ${res.fileName} done. ${processedCount} of ${filesCount}`,
                            );
                        } else {
                            console.error(
                                `Error Processing ${file}. ${processedCount} of ${filesCount}`,
                                'error:',
                                res,
                            );
                        }

                        return res;
                    })
                    .catch((err) => {
                        console.error('Error', file, err);
                        return null;
                    }),
            );
        }

        const responses = await Promise.allSettled(promises);

        const data = responses
            .map((r) => {
                if (r.status === 'fulfilled') {
                    const value = r.value;

                    if (value) {
                        if (value.fileName) {
                            return {
                                fileName: value.fileName || '',
                                hasAnyPiData: (value.stats && value.stats.length > 0) || '',
                                fullFileName: value.fullFileName || '',
                                fileSizeBytes: value.fileSizeBytes || '',
                                durationSeconds: value.durationSeconds || '',
                                stats:
                                    (value.stats || [])
                                        .map((d) => `${d.infoType || ''}:${d.count || ''}`)
                                        .join(`;`) || '',
                                dataVeryLikely: dlpDataToString((value.data || []).filter((d) => d.likelihood === 'VERY_LIKELY'), false),
                                dataLikely: dlpDataToString((value.data || []).filter((d) => d.likelihood === 'LIKELY'), false),
                                dataOther: dlpDataToString((value.data || [])
                                    .filter(
                                        (d) =>
                                            d.likelihood !== 'VERY_LIKELY' &&
                                            d.likelihood !== 'LIKELY',
                                    ), true),
                                error: '',
                            };
                        }

                        return {
                            fileName: '',
                            hasAnyPiData: '',
                            fullFileName: '',
                            fileSizeBytes: '',
                            durationSeconds: '',
                            stats: '',
                            dataVeryLikely: '',
                            dataLikely: '',
                            dataOther: '',
                            error: JSON.stringify(value),
                        };
                    }

                    return null;
                } else {
                    return {
                        fileName: '',
                        hasAnyPiData: '',
                        fullFileName: '',
                        fileSizeBytes: '',
                        durationSeconds: '',
                        stats: '',
                        dataVeryLikely: '',
                        dataLikely: '',
                        dataOther: '',
                        error: r.reason,
                    };
                }
            })
            .filter((o) => !!o);

        const dateTime = getDate();

        const csvData = await converter.json2csvAsync(data);
        fs.writeFileSync(path.join(folder, `cmor-result-${dateTime}.csv`), csvData);

        const allSuccessfulFiles = data.map((d) => d.fullFileName);
        const allUnsuccessfulFiles = files.filter(
            (f) => !allSuccessfulFiles.includes(f),
        );
        if (allUnsuccessfulFiles && allUnsuccessfulFiles.length) {
            const allUnsuccessfulFilesCsv = await converter.json2csvAsync(
                allUnsuccessfulFiles.map((f) => ({ fullFileName: f })),
            );
            fs.writeFileSync(
                path.join(folder, `cmor-result-missing-files-${dateTime}.csv`),
                allUnsuccessfulFilesCsv,
            );
        }

        const end = new Date();

        console.log(
            `Processing ${filesCount} files done in ${Math.floor(
                (end - start) / 1000 / 60,
            )} minutes`,
        );
    } catch (e) {
        console.error('Whoops!', e);
    }
}

const getDate = () => {
    return new Date()
        .toLocaleString()
        .replace(/[T,]/gi, '')
        .replace(/[\/: ]/gi, '-');
};

const delay = (ms) => {
    return new Promise((resolve, reject) => setTimeout(resolve, ms));
};

const dlpDataToString = (data, includeLikelihood) => {
    const likelihood = (d) => includeLikelihood ? `[${d.likelihood}]` : '';
    return (data || [])
        .map((d) => `${d.infoType || ''}${likelihood(d)}:${d.data || ''}`)
        .join(`;`)
        .replace(/,/g, ' ')
        .substring(0, 32000) || '';
}