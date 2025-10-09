import chalk from 'chalk';

import gradient from 'gradient-string';

import fs from "fs";

import { fileURLToPath } from "url";

import { dirname } from "path";

// Rainbow / gradient log

const rainbow = (text) => {

  return gradient.rainbow(text);   // smooth rainbow ðŸŒˆ

}

// Custom gradient (pastel style)

const pastel = (text) => {

  return gradient(['#00008B', '#fad0c4', '#191970'])(text);

}

// __filename and __dirname equivalents in ESM

const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

const file = __filename;

// File watcher for hot reload

fs.watchFile(file, () => {

  fs.unwatchFile(file);

  console.log(chalk.redBright(`Update ${__filename}`));

  // In ESM we use dynamic import instead of require

  import(file + `?update=${Date.now()}`).catch(err =>

    console.error("âŒ Hot reload error:", err)

  );

});

export {

  rainbow,

  pastel

};