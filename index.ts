import fs from 'graceful-fs';
import path from 'path';
import * as commander from 'commander';
import Todo from './classes/Todo.js';
import baseConfig from './.todoscan.json' assert { type: 'json' };

let config = baseConfig;

async function scanDirectory(directory: string): Promise<Todo[]> {
    let results: Todo[] = [];

    try {
        const files = await fs.promises.readdir(directory);

        for (const file of files) {
            const filePath = path.join(directory, file);
            const fileStats = await fs.promises.stat(filePath);

            if (fileStats.isDirectory()) {
                const dirName = path.basename(filePath);
                if (!config.directoryExceptions.includes(dirName)) {
                    const subDirResults = await scanDirectory(filePath);
                    results = results.concat(subDirResults);
                }
            } else if (fileStats.isFile()) {
                const fileTodos = await scanFileForTodos(filePath);
                results = results.concat(fileTodos);
            }
        }
    } catch (err) {
        console.error(`Error scanning directory: ${err}`);
    }

    return results;
}

async function scanFileForTodos(filePath: string): Promise<Todo[]> {
    try {
        const data = await fs.promises.readFile(filePath, {
            encoding: config.encoding as BufferEncoding
        });
        const results: Todo[] = [];
        const lines = data.split('\n');

        lines.forEach((line, index) => {
            const todoRegex = new RegExp(config.pattern.regex);
            if (
                line.length <= config.pattern.limit
                && todoRegex.test(config.pattern.caseSensitive ? line : line.toLowerCase())
            ) {
                results.push(new Todo(
                    filePath,
                    index + 1,
                    line.trim()
                ));
            }
        });

        return results;
    } catch (err) {
        console.log(`Error reading file ${filePath}: ${err}`);
        return [];
    }
}

const program = new commander.Command();

program.name('todoscan')
    .description('CLI utility for maintaining TODOs in your code');

program.command('scan')
    .description('Scans a directory for TODOs')
    .argument('<directory>', 'The directory to scan')
    .option('-q, --quiet', 'Executes the scan without any miscellaneous information')
    .option('-a, --all', 'Lists all of the scan results')
    .action(async (directory, options) => {
        const timeStart = performance.now();
        const results = await scanDirectory(directory);
        const timeEnd = performance.now();
        const timeDelta = Math.round((timeEnd - timeStart) + Number.EPSILON) / 1000;
        if (options.all) {
            results.forEach(todo => console.log(todo.toString()));
        }
        if (!options.quiet) {
            console.log(`Found ${results.length} TODOs in ${timeDelta}s`);
        }
    });

program.parse(process.argv);
