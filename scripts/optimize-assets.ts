import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import { textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import chokidar from 'chokidar';

// Configuration
const INPUT_DIR = 'raw-assets';
const OUTPUT_DIR = 'src/public/assets';
const TEMP_DIR = 'temp-optimization';

// Ensure directories exist
if (!fs.existsSync(INPUT_DIR)) fs.mkdirSync(INPUT_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const execAsync = promisify(exec);

// CLI Command Prefix
const CLI_CMD = 'bun run gltf-transform';

// Helper to get relative path
const getRelativePath = (filePath: string) => path.relative(INPUT_DIR, filePath);

// Helper to get output path
const getOutputPath = (filePath: string) => {
  const relPath = getRelativePath(filePath);
  const parsed = path.parse(relPath);
  // Always output as .glb
  return path.join(OUTPUT_DIR, parsed.dir, `${parsed.name}.glb`);
};

// Queue to handle concurrency
class Queue {
  private queue: (() => Promise<void>)[] = [];
  private active = 0;
  private maxConcurrency = 1; // Process one file at a time to avoid CPU freeze with KTX

  add(task: () => Promise<void>) {
    this.queue.push(task);
    this.next();
  }

  get length() {
    return this.queue.length + this.active;
  }

  private next() {
    if (this.active >= this.maxConcurrency || this.queue.length === 0) return;

    const task = this.queue.shift();
    if (task) {
      this.active++;
      task().finally(() => {
        this.active--;
        this.next();
      });
    }
  }
}

const processingQueue = new Queue();

async function optimizeFile(filePath: string) {
  const startTime = Date.now();
  const relPath = getRelativePath(filePath);
  const outputPath = getOutputPath(filePath);

  // Check extensions
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.gltf' && ext !== '.glb') return;

  // Check timestamps
  if (fs.existsSync(outputPath)) {
    const inputStat = fs.statSync(filePath);
    const outputStat = fs.statSync(outputPath);
    if (inputStat.mtimeMs <= outputStat.mtimeMs) {
      // console.log(`[Skip] ${relPath} is up to date.`);
      return;
    }
  }

  console.log(`[Processing] ${relPath}...`);

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Generate unique temp filename to avoid collisions
  const fileHash = crypto.createHash('md5').update(relPath).digest('hex');
  const tempFile = path.join(TEMP_DIR, `${fileHash}.temp.glb`);
  const ktxFile = path.join(TEMP_DIR, `${fileHash}.ktx.glb`);

  try {
    // Step 1: Load and Resize Textures using API
    const io = new NodeIO()
      .registerExtensions([])
      .registerDependencies({
        'sharp': sharp
      });

    const doc = await io.read(filePath);

    // Apply texture resizing logic
    await doc.transform(
      textureCompress({
        encoder: sharp,
        resize: [2048, 2048], // Resize > 2048 to 2048
        targetFormat: 'png', // Convert to PNG intermediate
        formats: /.*/,
      })
    );

    // Write intermediate file
    await io.write(tempFile, doc);

    // Step 2: Run CLI for KTX2 and Draco using exec for cross-platform support
    // Pass 1: UASTC (KTX2)
    await execAsync(`${CLI_CMD} uastc "${tempFile}" "${ktxFile}" --zstd 18 --level 2`);

    // Pass 2: Draco
    await execAsync(`${CLI_CMD} draco "${ktxFile}" "${outputPath}" --method edgebreaker`);

    console.log(`[Complete] ${relPath} -> ${getRelativePath(outputPath)} (${((Date.now() - startTime) / 1000).toFixed(2)}s)`);

  } catch (err) {
    console.error(`[Error] Failed to process ${relPath}:`, err);
  } finally {
    // Cleanup temp files for this specific file
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    if (fs.existsSync(ktxFile)) fs.unlinkSync(ktxFile);
  }
}

// Watch Mode
const isWatch = process.argv.includes('--watch');

if (isWatch) {
  console.log(`[Watch] Watching ${INPUT_DIR} for changes...`);
  const watcher = chokidar.watch(INPUT_DIR, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });

  watcher
    .on('add', path => processingQueue.add(() => optimizeFile(path)))
    .on('change', path => processingQueue.add(() => optimizeFile(path)))
    .on('unlink', filePath => {
        const outputPath = getOutputPath(filePath);
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
            console.log(`[Removed] ${getRelativePath(outputPath)}`);
        }
    });

} else {
  // Single pass
  console.log(`[Start] scanning ${INPUT_DIR}...`);
  // Recursive scan
  const getAllFiles = (dir: string, fileList: string[] = []) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    });
    return fileList;
  };

  const files = getAllFiles(INPUT_DIR);
  if (files.length === 0) {
    console.log("[Info] No files found to process.");
    // Cleanup empty temp dir
    try { fs.rmdirSync(TEMP_DIR); } catch (e) {}
  } else {
    // We need to wait for queue to empty before cleaning up temp dir,
    // but the script will exit naturally when queue is empty.
    // We can add a simple interval check or hook into the queue if needed.
    // For simplicity in single pass, we can just process.

    // Add all to queue
    files.forEach(file => processingQueue.add(() => optimizeFile(file)));

    // Minimal "Wait for completion" logic could be added here if we wanted to
    // explicitly remove TEMP_DIR at the very end.
    // Given the queue implementation, the process will exit when event loop is empty.
    // We can use a 'beforeExit' handler to clean the directory.
    process.on('beforeExit', () => {
        if (fs.existsSync(TEMP_DIR)) {
            // Only remove if empty or we want to force clean.
            // Since we clean individual files in finally block, the dir should be empty.
            try { fs.rmdirSync(TEMP_DIR); } catch (e) {}
        }
    });
  }
}
