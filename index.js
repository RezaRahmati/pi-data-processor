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
        const dir = process.env.FOLDER;
        // Get the files as an array
        const files = await globby([`${dir}/**/*`]);

        const promises = [];

        for (const file of files) {

            await delay(300);
            console.log("Processing '%s' started", file);

            const formData = new FormData();
            formData.append('file', fs.createReadStream(file));
            formData.append('infoTypes', process.env.INFO_TYPES);
            formData.append('fullFileName', file);

            promises.push(
                fetch(process.env.API_URL, {
                    method: 'POST',
                    headers: {
                        "api-key": process.env.API_KEY,
                    },
                    body: formData
                })
                    .then(res => res.json())
                    .then((res) => {
                        if (res.stausCode && res.stausCode !== 200) {
                            console.error(res);
                            return res;
                        }
                        else {
                            console.log("Processing '%s' done", res.fileName);
                            return res;
                        }
                    })
            );

        }

        const responses = await Promise.allSettled(promises);
        const data = responses.map(r => {
            if (r.status === 'fulfilled') {
                const value = r.value;
                value.data = (value.data || []).filter(d => d.likelihood == 'VERY_LIKELY');
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


        const csvData = await converter.json2csvAsync(data);

        fs.writeFileSync(path.join(dir, `result-${getDate()}.csv`), csvData);
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
