import { cp, mkdir, rm } from "node:fs/promises";

const files = [
  "assets",
  "src",
  "index.html",
  "manifest.json",
  "sw.js"
];

await rm("www", { recursive: true, force: true });
await mkdir("www", { recursive: true });

for (const file of files) {
  await cp(file, `www/${file}`, { recursive: true });
}

console.log("Built web assets into www");
