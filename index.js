import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { default as fetch, AbortError } from 'node-fetch';
import { default as FormData } from 'form-data';
import { default as converter } from 'json-2-csv';
import { globby } from 'globby';
import AbortController from 'abort-controller';
import csvWriter from 'csv-write-stream';
import pump from 'pump';
import moment from 'moment';
import sha256File from 'sha256-file';
import JSONdb from 'simple-json-db';

dotenv.config();

(async () => {
    const folder = process.env.FOLDER;
    const subFolders = (process.env.SUB_FOLDERS || '').split(',');

    const hashFileName = path.join(folder, `cmor-hash.json`);
    const hashDb = new JSONdb(hashFileName);
    hashDb.set('dummy', true);

    const processedFileName = path.join(folder, `cmor-processed.json`);
    const processedDb = new JSONdb(processedFileName);
    processedDb.set('dummy', true);

    for (let subFolder of subFolders) {
        const finalPath = path.join(folder, subFolder).replace(/\\/g, '/');
        try {
            await scanFolder(finalPath, hashDb, processedDb);
        } catch (err) {
            console.error(`Error processing ${subFolder}`, err);
        }
    }
})();

async function scanFolder(folder, hashDb, processedDb) {
    try {
        const delayMs = +process.env.DELAY;
        const likelihood = process.env.LIKELIHOOD;
        const keywords = process.env.KEYWORDS;
        const regex = [
            process.env.REGEX_0,
            process.env.REGEX_1,
            process.env.REGEX_2,
            process.env.REGEX_3,
            process.env.REGEX_4,
        ].filter((i) => !!i);
        const exclude_extensions = (process.env.EXCLUDE_EXT || '')
            .toLowerCase()
            .split(',')
            .map((e) => `.${e}`);

        const startTime = new Date();

        const dateTime = getDate();

        const { append: resultAppend, end: resultEnd } = csvAppend(path.join(folder, `cmor-result-${dateTime}.csv`));

        console.log(`************ ${folder} ***************`);

        // Get the files as an array
        const files = (await globby([`${folder}/**/*`]))
            .filter((f) => !f.includes('cmor-'))
            .filter(
                (f) => !exclude_extensions.includes(path.extname(f).toLowerCase())
            );

        const promises = [];

        let fileIndex = 0;
        let processedCount = 0;
        let filesCount = files.length;

        console.log(`${filesCount} files found in ${folder}`);

        for (let file of files) {
            fileIndex += 1;

            const fileSize = fs.statSync(file).size;
            if (!fs.existsSync(file) || fileSize > 100 * 1000 * 1000) {
                processedCount += 1;
                continue;
            }

            const fileHash = calculateHash(file);

            const hashKey = `${fileHash}-${fileSize}`;

            if (hashDb.get(hashKey)) {
                console.log(`Skipping Duplicate ${file}`);
                promises.push(Promise.resolve({
                    fileName: path.basename(file),
                    hasAnyPiData: '',
                    fullFileName: file,
                    fileSizeBytes: fileSize,
                    durationSeconds: 0,
                    stats: '',
                    dataVeryLikely: '',
                    dataLikely: '',
                    dataOther: '',
                    error: 'Duplicate',
                }));

                continue;
            }

            hashDb.set(hashKey, true);

            if (processedDb.has(file)) {
                console.log(`Skipping ${file}`);
                processedCount += 1;
                continue;
            }

            await delay(delayMs);

            console.log(
                `[${new Date().toISOString()}]: Processing ${file} started. ${fileIndex} of ${filesCount}`
            );

            const formData = new FormData();
            formData.append('file', fs.createReadStream(file));
            formData.append('infoTypes', process.env.INFO_TYPES);
            formData.append('fullFileName', file);
            formData.append('likelihood', likelihood);

            if (!!keywords) {
                formData.append('keywords', keywords);
            }

            if (regex && regex.length) {
                regex.forEach((item) => {
                    formData.append('regex', item);
                });
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => {
                controller.abort();
            }, 15 * 60 * 1000); // 10 minutes

            promises.push(
                fetch(
                    process.env.API_URL,
                    //'https://pidata.getsandbox.com:443',
                    {
                        method: 'POST',
                        headers: {
                            'api-key': process.env.API_KEY,
                            Accept: 'application/json',
                        },
                        body: formData,
                        signal: controller.signal,
                    }
                )
                    .then((res) => {
                        clearTimeout(timeout);
                        processedCount += 1;
                        if (!res.ok) {
                            try {
                                return res.json();
                            } catch (err) {
                                console.error(
                                    `[${new Date().toISOString()}]: Error converting to json 1`,
                                    res.text()
                                );
                                throw new Error(res.text());
                            }
                        }

                        try {
                            return res.json();
                        } catch (err) {
                            console.error(
                                `[${new Date().toISOString()}]: Error converting to json 2`,
                                res.text()
                            );
                            throw new Error(res.text());
                        }
                    })
                    .then(async (res) => {
                        if (res.fileName) {
                            console.log(
                                `[${new Date().toISOString()}]: Processing ${res.fileName
                                } done. ${processedCount} of ${filesCount}`
                            );
                        } else {
                            console.error(
                                `[${new Date().toISOString()}]: Error Processing ${file}. ${processedCount} of ${filesCount}`,
                                'error:',
                                res
                            );
                        }

                        const data = responseToData(res);
                        resultAppend(data);
                        await resultEnd;

                        if (res.fileName) {
                            processedDb.set(res.fullFileName, true);
                        } else if (hashDb.has(hashKey)) {
                            hashDb.delete(hashKey);
                        }

                        return res;
                    })
                    .catch((err) => {
                        if (hashDb.has(hashKey)) {
                            hashDb.delete(hashKey);
                        }
                        console.error(`[${new Date().toISOString()}]: Error`, file, err);
                        clearTimeout(timeout);
                        return null;
                    })
            );
        }

        await Promise.allSettled(promises);

        const AllProcessedFiles = Object.keys(processedDb.JSON());

        const allUnsuccessfulFiles = files.filter(
            (f) => !AllProcessedFiles.includes(f)
        );

        if (allUnsuccessfulFiles && allUnsuccessfulFiles.length) {

            const allUnsuccessfulFilesCsv = await converter.json2csvAsync(
                allUnsuccessfulFiles.map((f) => ({ fullFileName: f }))
            );
            fs.writeFileSync(
                path.join(folder, `cmor-missing-files-${dateTime}.csv`),
                allUnsuccessfulFilesCsv
            );
        }

        const endTime = new Date();

        console.log(
            `Processing ${filesCount} files done in ${Math.floor(
                (endTime - startTime) / 1000 / 60
            )} minutes`
        );
    } catch (e) {
        console.error('Whoops!', e);
    }
}

function getDate() {
    return moment().format('YYYY-MM-DD-HH-mm');
}

const delay = (ms) => {
    return new Promise((resolve, reject) => setTimeout(resolve, ms));
};

const dlpDataToString = (data, includeLikelihood) => {
    const likelihood = (d) => (includeLikelihood ? `[${d.likelihood}]` : '');
    return (
        (data || [])
            .map((d) => `${d.infoType || ''}${likelihood(d)}:${d.data || ''}`)
            .join(`;`)
            .replace(/,/g, ' ')
            .substring(0, 32000) || ''
    );
};

function responseToData(value) {
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
            dataVeryLikely: dlpDataToString(
                (value.data || []).filter((d) => d.likelihood === 'VERY_LIKELY'),
                false
            ),
            dataLikely: dlpDataToString(
                (value.data || []).filter((d) => d.likelihood === 'LIKELY'),
                false
            ),
            dataOther: dlpDataToString(
                (value.data || []).filter(
                    (d) => d.likelihood !== 'VERY_LIKELY' && d.likelihood !== 'LIKELY'
                ),
                true
            ),
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

function csvAppend(path) {
    let appendToExisting = fs.existsSync(path);

    const writeStream = fs.createWriteStream(path, {
        flags: appendToExisting ? 'a' : 'w',
    });
    const writer = csvWriter({ sendHeaders: !appendToExisting });
    writer.pipe(writeStream);
    const append = (args) => {
        if (Array.isArray(args)) {
            for (let arg of args) {
                writer.write(arg);
            }
        } else {
            writer.write(args);
        }
        return writer;
    };
    const end = () => {
        return new Promise((resolve) => {
            pump(writer, writeStream, (err) => {
                resolve();
            });
            writer.end();
        });
    };
    return {
        append,
        end,
    };
}

function calculateHash(fileName) {
    return sha256File(fileName);
}
