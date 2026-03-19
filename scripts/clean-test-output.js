const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "out");
fs.rmSync(outDir, { recursive: true, force: true });
