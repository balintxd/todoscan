const BaseConfig = {
    pattern: {
        regex: "\\btodo\\b",
        limit: 300,
        caseSensitive: false
    },
    encoding: "utf-8",
    timeWarning: 5,
    directoryExceptions: [
        "vendor",
        "node_modules",
        ".git",
        "sass",
        "js",
        "Migrations"
    ],
    fileExceptions: [
        //
    ]
};

export default BaseConfig;