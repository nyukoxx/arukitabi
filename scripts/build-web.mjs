import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const webDir = path.join(projectRoot, "www");

await mkdir(webDir, { recursive: true });

for (const file of ["index.html", "style.css", "app.js"]) {
  await copyFile(path.join(projectRoot, file), path.join(webDir, file));
}

console.log(`Web assets copied to ${webDir}`);
