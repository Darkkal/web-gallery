const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  const standaloneDir = path.join(rootDir, ".next", "standalone");
  const distDir = path.join(rootDir, "dist");

  const pkgJsonPath = path.join(rootDir, "package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const version = pkgJson.version;

  console.log("1. Building Next.js standalone application...");
  execSync("npm run build", { stdio: "inherit", cwd: rootDir });

  console.log("2. Copying frontend static and public assets...");

  // Copy static assets
  const staticSrc = path.join(rootDir, ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  if (fs.existsSync(staticSrc)) {
    console.log(`Copying .next/static to ${staticDest}`);
    copyDirSync(staticSrc, staticDest);
  }

  // Copy public assets (excluding downloads and avatars folders)
  const publicSrc = path.join(rootDir, "public");
  const publicDest = path.join(standaloneDir, "public");
  if (fs.existsSync(publicSrc)) {
    fs.mkdirSync(publicDest, { recursive: true });
    const publicEntries = fs.readdirSync(publicSrc, { withFileTypes: true });
    for (const entry of publicEntries) {
      if (entry.name === "downloads" || entry.name === "avatars") {
        continue; // Exclude compiled downloads/avatars media caches
      }
      const srcPath = path.join(publicSrc, entry.name);
      const destPath = path.join(publicDest, entry.name);
      if (entry.isDirectory()) {
        copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  console.log("3. Copying database migrations and default templates...");

  // Copy drizzle migrations
  const migrationsSrc = path.join(rootDir, "drizzle");
  const migrationsDest = path.join(standaloneDir, "drizzle");
  if (fs.existsSync(migrationsSrc)) {
    copyDirSync(migrationsSrc, migrationsDest);
  }

  // Copy default config template
  const configTemplate = path.join(rootDir, "gallery-dl-default.conf");
  const configDest = path.join(standaloneDir, "gallery-dl-default.conf");
  if (fs.existsSync(configTemplate)) {
    fs.copyFileSync(configTemplate, configDest);
  }

  // Copy next-server compiled files for Turbopack runtime
  const nextServerSrc = path.join(
    rootDir,
    "node_modules",
    "next",
    "dist",
    "compiled",
    "next-server",
  );
  const nextServerDest = path.join(
    standaloneDir,
    "node_modules",
    "next",
    "dist",
    "compiled",
    "next-server",
  );
  if (fs.existsSync(nextServerSrc)) {
    console.log(`Copying next-server files to ${nextServerDest}`);
    copyDirSync(nextServerSrc, nextServerDest);
  }

  console.log(
    "4. Patching standalone server.js to run in virtual snapshot and mock inspector...",
  );
  const serverJsPath = path.join(standaloneDir, "server.js");
  if (fs.existsSync(serverJsPath)) {
    let serverJs = fs.readFileSync(serverJsPath, "utf8");
    // Comment out process.chdir(__dirname)
    serverJs = serverJs.replace(
      "process.chdir(__dirname)",
      "// process.chdir(__dirname)",
    );

    // Inject node:inspector, inspector mock, env loader, and libsql redirection at the very top of server.js
    const inspectorMock = `
// Load local .env file from current working directory if it exists
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
      console.log(\`[Server] Loaded environment variables from \${envPath}\`);
    } else {
      // Fallback parser if running on older node versions
      const dotenvContent = fs.readFileSync(envPath, 'utf8');
      for (const line of dotenvContent.split(/\\r?\\n/)) {
        const match = line.match(/^\\s*([^#\\s=]+)\\s*=\\s*(.*)$/);
        if (match) {
          const key = match[1];
          let val = match[2].trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[key] = val;
        }
      }
      console.log(\`[Server] Loaded environment variables (parsed) from \${envPath}\`);
    }
  }
} catch (err) {
  console.error(\`[Server] Failed to load .env file: \${err.message}\`);
}

// Mock inspector module which is missing in pkg base binaries and redirect hashed libsql requests
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
  if (request === 'node:inspector' || request === 'inspector') {
    return {
      Session: class Session {
        connect() {}
        disconnect() {}
        post() {}
        on() {}
      },
      console: {},
      url: () => null,
      open: () => {},
      close: () => {},
      waitForDebugger: () => {},
    };
  }
  if (typeof request === 'string' && request.startsWith('@libsql/client-')) {
    return originalRequire.call(this, '@libsql/client');
  }
  return originalRequire.apply(this, arguments);
};
`;
    serverJs = inspectorMock + "\n" + serverJs;

    // Patch startServer call to print URL and auto-open default browser
    const replacementStartServer = `startServer({
  dir,
  isDev: false,
  config: nextConfig,
  hostname,
  port: currentPort,
  allowRetry: false,
  keepAliveTimeout,
}).then(() => {
  const host = process.env.HOSTNAME || 'localhost';
  const openHost = (host === '0.0.0.0' || host === '::') ? 'localhost' : host;
  const url = \`http://\${openHost}:\${currentPort}\`;
  console.log(\`\\n[Server] Web Gallery is running at: \${url}\`);
  console.log(\`[Server] Opening \${url} in your default browser...\\n\`);
  
  const { exec } = require('child_process');
  let command;
  switch (process.platform) {
    case 'darwin':
      command = \`open "\${url}"\`;
      break;
    case 'win32':
      command = \`start "" "\${url}"\`;
      break;
    default:
      command = \`xdg-open "\${url}"\`;
      break;
  }
  exec(command, (err) => {
    if (err) {
      // Ignore errors if no GUI is present
    }
  });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});`;

    serverJs = serverJs.replace(
      /startServer\(\{[\s\S]+?\}\)\.catch\(\(err\) => \{\s*console\.error\(err\);\s*process\.exit\(1\);\s*\}\);/,
      replacementStartServer,
    );

    fs.writeFileSync(serverJsPath, serverJs, "utf8");
    console.log(
      "Successfully patched server.js with VFS patch, inspector mock, and browser auto-open",
    );
  } else {
    throw new Error("server.js not found in .next/standalone/");
  }

  console.log(
    "4.2. Pruning unwanted files and directories from standalone bundle...",
  );
  const pathsToPrune = [
    path.join(standaloneDir, "scratch"),
    path.join(standaloneDir, "dist"),
    path.join(standaloneDir, "tests"),
    path.join(standaloneDir, "test-results"),
    path.join(standaloneDir, "test-data"),
    path.join(standaloneDir, "test-media"),
    path.join(standaloneDir, "public", "downloads"),
    path.join(standaloneDir, "public", "avatars"),
    path.join(standaloneDir, "sqlite.db"),
    path.join(standaloneDir, ".env"),
  ];

  for (const prunePath of pathsToPrune) {
    if (fs.existsSync(prunePath)) {
      console.log(`Pruning: ${prunePath}`);
      fs.rmSync(prunePath, { recursive: true, force: true });
    }
  }

  console.log(
    "4.3. Patching [turbopack]_runtime.js files in standalone bundle...",
  );
  const target =
    "async function externalImport(id) {\n    let raw;\n    try {\n        raw = await import(id);\n    } catch (err) {\n        // TODO(alexkirsz) This can happen when a client-side module tries to load\n        // an external module we don't provide a shim for (e.g. querystring, url).\n        // For now, we fail semi-silently, but in the future this should be a\n        // compilation error.\n        throw new Error(`Failed to load external module ${id}: ${err}`);\n    }";

  const replacement =
    "async function externalImport(id) {\n    let raw;\n    try {\n        raw = await import(id);\n    } catch (err) {\n        try {\n            raw = require(id);\n        } catch (err2) {\n            // TODO(alexkirsz) This can happen when a client-side module tries to load\n            // an external module we don't provide a shim for (e.g. querystring, url).\n            // For now, we fail semi-silently, but in the future this should be a\n            // compilation error.\n            throw new Error(`Failed to load external module ${id}: ${err}`);\n        }\n    }";

  function patchRuntimesRecursive(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        patchRuntimesRecursive(fullPath);
      } else if (entry.isFile() && entry.name === "[turbopack]_runtime.js") {
        let content = fs.readFileSync(fullPath, "utf8");
        if (content.includes(target)) {
          content = content.replace(target, replacement);
          fs.writeFileSync(fullPath, content, "utf8");
          console.log(`Successfully patched externalImport in: ${fullPath}`);
        } else {
          console.warn(`Warning: target string not found in: ${fullPath}`);
        }
      }
    }
  }

  const chunksDir = path.join(standaloneDir, ".next", "server", "chunks");
  patchRuntimesRecursive(chunksDir);

  console.log(
    "4.4. Patching JS files to redirect hashed libsql client imports...",
  );
  function patchLibsqlImports(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        patchLibsqlImports(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        let content = fs.readFileSync(fullPath, "utf8");
        if (content.includes("@libsql/client-")) {
          console.log(`Patching libsql client import in: ${fullPath}`);
          content = content.replace(
            /@libsql\/client-[a-f0-9]+/g,
            "@libsql/client",
          );
          fs.writeFileSync(fullPath, content, "utf8");
        }
      }
    }
  }
  patchLibsqlImports(standaloneDir);

  console.log("4.5. Cleaning up symlinks inside standalone directory...");
  function cleanSymlinksRecursive(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        console.log(`Removing symlink: ${fullPath}`);
        fs.unlinkSync(fullPath);
      } else if (entry.isDirectory()) {
        cleanSymlinksRecursive(fullPath);
      }
    }
  }
  cleanSymlinksRecursive(standaloneDir);

  console.log("5. Packaging application using @yao-pkg/pkg in SEA mode...");
  fs.mkdirSync(distDir, { recursive: true });

  // Run pkg in standalone directory targeting package.json (which contains bin and pkg configuration)
  // Outputs to the root dist/ directory
  execSync(`npx pkg . --out-path "${distDir}"`, {
    stdio: "inherit",
    cwd: standaloneDir,
  });

  console.log(`Renaming binaries to include version v${version}...`);
  const binaryMappings = [
    { old: "web-gallery-linux", new: `web-gallery-v${version}-linux` },
    { old: "web-gallery-macos", new: `web-gallery-v${version}-macos` },
    { old: "web-gallery-win.exe", new: `web-gallery-v${version}-win.exe` },
  ];
  for (const mapping of binaryMappings) {
    const oldPath = path.join(distDir, mapping.old);
    const newPath = path.join(distDir, mapping.new);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`Renamed: ${mapping.old} -> ${mapping.new}`);
    }
  }

  console.log("6. Copying dependency setup scripts to release package...");
  const shSrc = path.join(rootDir, "scripts", "setup-deps.sh");
  const shDest = path.join(distDir, "setup-deps.sh");
  if (fs.existsSync(shSrc)) {
    fs.copyFileSync(shSrc, shDest);
    fs.chmodSync(shDest, 0o755); // make executable
    console.log("Copied setup-deps.sh to dist/");
  }

  const ps1Src = path.join(rootDir, "scripts", "setup-deps.ps1");
  const ps1Dest = path.join(distDir, "setup-deps.ps1");
  if (fs.existsSync(ps1Src)) {
    fs.copyFileSync(ps1Src, ps1Dest);
    console.log("Copied setup-deps.ps1 to dist/");
  }

  console.log(
    `\nSuccess! Standalone binaries and setup scripts generated in ${distDir}`,
  );
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
