import { Command } from "commander";
import * as path from "path";
import * as fs from "fs-extra";
import * as debugLog from "./debugLog";
import { createManager } from './utils';
import { generatePontConfig } from "./scripts/start";

const packageFilePath = path.join(__dirname, "..", "package.json");
console.log("packageFilePath", packageFilePath);
const packageInfo = JSON.parse(fs.readFileSync(packageFilePath, "utf8"));

const currentVersion = packageInfo.version;

const program = new Command();
program.version(currentVersion).usage('[命令] [配置项]');
program.description("powerful api code generator");

(async () => {
  try {
    const manager = await createManager();
    // program.option("-d, --debug", "output extra debugging")
    //        .action((name, options, command) => {
    //         console.log('name', name)
    //         console.log('options', options.debug)
    //        });
    program
      .command("start")
      .description("pont配置文件生成")
      .action(() => {
        generatePontConfig();
      });
    
      program
      .command('generate')
      .description('生成代码')
      .action(() => {
        // manager.regenerateFiles();
      });
    program.parse(process.argv);
  } catch (e) {
    console.error(e.stack);
    debugLog.error(e.toString());
  }
})();
