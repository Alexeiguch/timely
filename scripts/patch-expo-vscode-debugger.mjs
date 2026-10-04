import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const extensionRoot = join(homedir(), ".vscode", "extensions");
const extensionPrefix = "expo.vscode-expo-tools-1.6.3";
const oldSnippet = "localRoot:t.root,remoteRoot:";
const fixedSnippet = "localRoot:t.root.fsPath,remoteRoot:";

const extensionDirectories = (await readdir(extensionRoot, { withFileTypes: true }))
  .filter(
    (entry) =>
      entry.isDirectory() && entry.name.startsWith(extensionPrefix),
  )
  .map((entry) => entry.name)
  .sort();

if (extensionDirectories.length === 0) {
  throw new Error(
    `Expo Tools 1.6.3 is not installed under ${extensionRoot}. Install expo.vscode-expo-tools first.`,
  );
}

for (const extensionDirectory of extensionDirectories) {
  const bundlePath = join(
    extensionRoot,
    extensionDirectory,
    "out",
    "src",
    "extension.js",
  );
  const bundle = await readFile(bundlePath, "utf8");

  if (bundle.includes(fixedSnippet)) {
    console.log(`Already repaired: ${bundlePath}`);
    continue;
  }

  const occurrences = bundle.split(oldSnippet).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `Expected one Expo Tools debugger localRoot site in ${bundlePath}, found ${occurrences}. The extension may have changed; do not patch it automatically.`,
    );
  }

  const backupPath = `${bundlePath}.timely-backup`;
  await copyFile(bundlePath, backupPath);
  await writeFile(bundlePath, bundle.replace(oldSnippet, fixedSnippet));
  console.log(`Repaired: ${bundlePath}`);
  console.log(`Backup: ${backupPath}`);
}

console.log("Reload the VS Code window before attaching the debugger.");
