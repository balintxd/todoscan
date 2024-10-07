import fs from 'graceful-fs';
import path from 'path';
import * as commander from 'commander';
import Todo from './classes/Todo.js';
import BaseConfig from './BaseConfig.js';
import Priority from './enums/Priority.js';
import chalk from 'chalk';
import dayjs from 'dayjs';
import ConfigType from './enums/ConfigType.js';

let sharedConfig = BaseConfig;
let localConfig: Object;

async function scanDirectory(directory: string): Promise<Todo[]> {
    let results: Todo[] = [];

    try {
        const files = await fs.promises.readdir(directory);

        for (const file of files) {
            const filePath = path.join(directory, file);
            const fileStats = await fs.promises.stat(filePath);

            if (fileStats.isDirectory()) {
                const dirName = path.basename(filePath);
                if (!sharedConfig.directoryExceptions.includes(dirName)) {
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
            encoding: sharedConfig.encoding as BufferEncoding
        });
        const results: Todo[] = [];
        const lines = data.split('\n');

        lines.forEach((line, index) => {
            const todoRegex = new RegExp(sharedConfig.pattern.regex);
            if (
                line.length <= sharedConfig.pattern.limit
                && todoRegex.test(sharedConfig.pattern.caseSensitive ? line : line.toLowerCase())
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

function loadConfig(directory: string, configType: ConfigType) {
    const configPath = path.join(directory, (configType === ConfigType.Local ? '.todoscan.local.json' : '.todoscan.json'));

    if (fs.existsSync(configPath)) {
        try {
            const configData = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configData);
            if (configType === ConfigType.Local) {
                localConfig = config;
            } else {
                sharedConfig = config;
            }
        } catch (err) {
            console.error(`Error reading or parsing ${configType === ConfigType.Local ? 'local' : 'shared'} config`, err);
        }
    } 
}

function loadConfigs(directory: string) {
    loadConfig(directory, ConfigType.Local);
    loadConfig(directory, ConfigType.Shared);
}

const program = new commander.Command();

program.name('todoscan')
    .description('CLI utility for maintaining TODOs in your code');

program.command('scan')
    .description('Scans a directory for TODOs')
    .argument('<directory>', 'The directory to scan')
    .option('-q, --quiet', 'Executes the scan without any miscellaneous information')
    .option('-a, --all', 'Lists all of the scan results')
    .option('-u --user <user>', 'Scan for TODOs related to a specific user')
    .option('-p --priority <priority>', 'Scan for a specific priority level of TODOs')
    .option('-d --due <date>', 'Scan for TODOs due before a specific date')
    .action(async (directory, options) => {
        loadConfigs(directory);

        const timeStart = performance.now();
        const originalResults = await scanDirectory(directory);
        const timeEnd = performance.now();
        const timeDelta = Math.round((timeEnd - timeStart) + Number.EPSILON) / 1000;
        let results = originalResults;

        if (options.user) {
            results = results.filter((todo: Todo) => {
                return todo.responsibles?.includes(options.user);
            });
        }

        if (options.priority) {
            options.priority = options.priority.toLowerCase();
            if (!(options.priority in Priority)) {
                console.warn(`Unknown priority level: ${options.priority}`);
            }
            results = results.filter((todo: Todo) => {
                return todo.priority === options.priority;
            });
        }

        if (options.due) {
            results = results.filter((todo: Todo) => {
                return (dayjs(todo.dueDate) <= dayjs(options.due));
            });
        }

        if (options.all) {
            results.forEach(todo => console.log(todo.toString()));
        }

        if (!options.quiet) {
            console.log(`Found ${results.length} TODOs in ${timeDelta}s`);

            if (timeDelta > sharedConfig.timeWarning) {
                console.warn(`Scanning time exceeded the limit (${sharedConfig.timeWarning}s). Are you sure the exceptions are set up right? You can hide this message by increasing the limit in the config.`);
            }

            const { lowPrioCount, medPrioCount, highPrioCount } = results.reduce((c, todo: Todo) => {
                if (todo.priority === Priority.High) c.highPrioCount++;
                if (todo.priority === Priority.Medium) c.medPrioCount++;
                if (todo.priority === Priority.Low) c.lowPrioCount++;
                return c;
            }, { lowPrioCount: 0, medPrioCount: 0, highPrioCount: 0 });
            
            if (highPrioCount > 0) {
                console.log(`Found ${highPrioCount} TODO(s) in ${chalk.redBright('HIGH')} priority`);
            }
            if (medPrioCount > 0) {
                console.log(`Found ${medPrioCount} TODO(s) in ${chalk.red('MED')} priority`);
            }
            if (lowPrioCount > 0) {
                console.log(`Found ${lowPrioCount} TODO(s) in ${chalk.gray('LOW')} priority`);
            }

            const now = dayjs();
            const endOfDay = dayjs().endOf('day');
            const endOfWeek = dayjs().endOf('week');
            const endOfMonth = dayjs().endOf('month');

            const { pastDue, dueDay, dueWeek, dueMonth } = results.reduce((c, todo: Todo) => {
                if (todo.dueDate) {
                    const dueDate = dayjs(todo.dueDate);
                    if (dueDate < now) c.pastDue++;
                    else if (dueDate < endOfDay) c.dueDay++;
                    else if (dueDate < endOfWeek) c.dueWeek++;
                    else if (dueDate < endOfMonth) c.dueMonth++;
                }
                return c;
            }, { pastDue: 0, dueDay: 0, dueWeek: 0, dueMonth: 0 });

            if (pastDue > 0) {
                console.log(`Found ${pastDue} TODO(s) past due`);
            }
            if (dueDay > 0) {
                console.log(`Found ${dueDay} TODO(s) due today`);
            }
            if (dueWeek > 0) {
                console.log(`Found ${dueWeek} TODO(s) due this week`);
            }
            if (dueMonth > 0) {
                console.log(`Found ${dueMonth} TODO(s) due this month`);
            }
        }
    });

program.parse(process.argv);
