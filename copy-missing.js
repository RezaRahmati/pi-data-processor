import * as path from 'path';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
    const folder = process.env.FOLDER;
    const aggregatedMissingFileName = process.env.COPY_MISSING_FILE_PATH;
    const output = process.env.COPY_MISSING_OUTPUT;

    const missingFiles = fs
        .readFileSync(aggregatedMissingFileName, { encoding: 'utf-8', flag: 'r' })
        .split('\n').slice(1).filter(i => !!i);

    console.log(`${missingFiles.length} missing files found`);

    const copyResult = missingFiles.map(file => copyFile(replaceBackslashToSlash(file), replaceBackslashToSlash(output), replaceBackslashToSlash(folder)));

    console.log(`${copyResult.filter(i => i === true).length} files copied successfully`);

})();

function copyFile(file, target, baseFolder) {

    const newFilePath = file.replace(baseFolder, target);

    if (!fs.existsSync(file)) {
        console.error(`file ${file} doesn't exists`);
        return false;
    }

    const destinationDir = path.dirname(newFilePath);
    if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
    }

    fs.copyFileSync(file, newFilePath);

    return true;
}

function replaceBackslashToSlash(str) {
    return str.replace(/\//g, '/').replace(/"/g, '')
}
