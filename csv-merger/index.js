import { getUniqueColumns } from './unique_columns.js';
import { writeWithColumns } from './write_with_columns.js';

export async function merge(
    inputFiles,
    partialOptions = {},
) {
    const options = formOptions(partialOptions);
    const uniqueColumns = await getUniqueColumns(inputFiles);
    let isFirstOutput = true;
    let output = '';

    for (const inputFile of inputFiles) {
        output += await writeWithColumns(
            inputFile, uniqueColumns, isFirstOutput, options,
        );

        isFirstOutput = false;
    }

    if (options.writeOutput) {
        return output === '';
    }

    return output;
}

function formOptions(partialOptions) {
    const options = {
        ...{
            commandLineExecution: false,
            outputPath: 'merged.csv',
            writeOutput: false,
        },
        ...partialOptions,
    };

    return options;
}
