import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Issue #167: the version workflow runs a REAL `cog bump --auto`. The dry-run
// plan could never catch changelog/version-commit failures. This integration
// test runs the pinned real Cocogitto against a self-contained synthetic
// pre-release repository (fixed tagged base + one conventional commit), so it
// is deterministic regardless of the repository's current HEAD / whether a
// release already exists. It covers BOTH the release transition and the
// already-released no-op case.

const repoRoot = process.cwd();

function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): string {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    cwd: opts.cwd,
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
  });
}

/**
 * The repo cog.toml pre-bump hook shells out to `npm version`. CI runners
 * always provide npm; dev containers may not. When npm is missing, inject a
 * minimal behavioural shim (bumps the version fields in package.json +
 * package-lock.json) into PATH so the bump mechanics stay exercisable.
 */
function npmPathPrepend(baseDir: string): NodeJS.ProcessEnv | undefined {
  try {
    execFileSync("npm", ["--version"], { stdio: "ignore" });
    return undefined;
  } catch {
    const binDir = join(baseDir, "npm-shim");
    mkdirSync(binDir, { recursive: true });

    const shimJs = join(binDir, "npm-version-shim.cjs");
    writeFileSync(
      shimJs,
      [
        'const fs = require("fs");',
        "// Mirrors `npm version <x> --no-git-tag-version`: last arg is the version.",
        "const ver = process.argv[process.argv.length - 1];",
        'for (const f of ["package.json", "package-lock.json"]) {',
        '  const p = JSON.parse(fs.readFileSync(f, "utf8"));',
        "  p.version = ver;",
        '  if (p.packages && p.packages[""]) p.packages[""].version = ver;',
        '  fs.writeFileSync(f, JSON.stringify(p, null, 2) + "\\n");',
        "}",
        "",
      ].join("\n"),
    );

    const npmShim = join(binDir, "npm");
    writeFileSync(
      npmShim,
      [
        "#!/usr/bin/env bash",
        `exec "${process.execPath}" "${shimJs}" "$@"`,
        "",
      ].join("\n"),
    );
    chmodSync(npmShim, 0o755);

    return {
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      NODE_ENV: process.env.NODE_ENV,
    };
  }
}

/** Build a self-contained synthetic pre-release repo; returns its path. */
function buildSyntheticRepo(tag: string): { dir: string; clone: string } {
  const dir = mkdtempSync(join(tmpdir(), "cog-synth-"));
  const clone = join(dir, "repo");
  mkdirSync(clone, { recursive: true });
  run("git", ["init", "-q", clone]);
  run("git", ["config", "user.name", "release-test"], { cwd: clone });
  run("git", ["config", "user.email", "release-test@example.com"], {
    cwd: clone,
  });

  // Copy the repo's cog.toml verbatim (keeps the real manifest pre-bump hook).
  const cogToml = readFileSync(join(repoRoot, "cog.toml"), "utf8");
  writeFileSync(join(clone, "cog.toml"), cogToml);

  // A minimal package.json + package-lock.json with the base version.
  writeFileSync(
    join(clone, "package.json"),
    JSON.stringify(
      { name: "pilot-synth", version: tag.replace(/^v/, ""), private: true },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    join(clone, "package-lock.json"),
    JSON.stringify(
      {
        name: "pilot-synth",
        version: tag.replace(/^v/, ""),
        lockfileVersion: 3,
        packages: {
          "": { name: "pilot-synth", version: tag.replace(/^v/, "") },
        },
      },
      null,
      2,
    ) + "\n",
  );

  // CHANGELOG.md with the Cocogitto-required `- - -` preamble separator.
  writeFileSync(
    join(clone, "CHANGELOG.md"),
    `# Changelog\n\n- - -\n\n## [${tag.replace(/^v/, "")}](https://example.com) (2026-01-01)\n\n### Features\n\n* base\n`,
  );

  run("git", ["add", "-A"], { cwd: clone });
  run("git", ["commit", "-qm", "chore: synthetic base"], { cwd: clone });
  run("git", ["tag", tag], { cwd: clone });

  // One conventional feature commit so the next bump is a minor release.
  writeFileSync(join(clone, "feat.txt"), "feature\n");
  run("git", ["add", "feat.txt"], { cwd: clone });
  run("git", ["commit", "-qm", "feat: synthetic feature"], { cwd: clone });

  return { dir, clone };
}

/** Resolve the pinned Cocogitto binary (downloads + digest-verifies). */
function installCog(version: string, digest: string, dir: string): string {
  const base = `https://github.com/cocogitto/cocogitto/releases/download/${version}`;
  const archive = join(dir, "cog.tar.gz");
  run("curl", [
    "-fsSL",
    `${base}/cocogitto-${version}-x86_64-unknown-linux-musl.tar.gz`,
    "-o",
    archive,
  ]);
  execFileSync(
    "bash",
    [
      "-c",
      'printf "%s  %s\\n" "$1" "$2" | sha256sum --check --strict -',
      "check",
      digest,
      archive,
    ],
    { encoding: "utf8" },
  );
  const member = run("bash", [
    "-c",
    `tar -tzf "${archive}" | grep -E '(^|/)cog$' | head -1`,
  ]).trim();
  run("tar", ["-xzf", archive, "-C", dir]);
  return join(dir, member);
}

describe("cocogitto real bump (#167)", () => {
  const versionYaml = readFileSync(
    join(repoRoot, ".forgejo", "workflows", "version.yml"),
    "utf8",
  );
  const version = versionYaml.match(/COG_VERSION:\s*"([^"]+)"/)?.[1];
  const digest = versionYaml.match(/COG_SHA256:\s*"([0-9a-f]{64})"/)?.[1];

  expect(version, "pinned COG_VERSION in version.yml").toBeTruthy();
  expect(digest, "pinned COG_SHA256 in version.yml").toBeTruthy();

  it("produces a release transition (commit + tag + aligned version) from a base before a release exists", () => {
    const { dir, clone } = buildSyntheticRepo("v0.1.0");
    try {
      const cog = installCog(version as string, digest as string, dir);
      const out = run("bash", ["-c", '"$0" bump --auto 2>&1', cog], {
        cwd: clone,
        env: npmPathPrepend(dir),
      });
      console.log("[cog bump --auto]\n" + out);
      expect(out).toContain("Bumped version");

      const pkg = JSON.parse(readFileSync(join(clone, "package.json"), "utf8"));
      expect(pkg.version).toBe("0.2.0");
      expect(run("git", ["tag", "-l", "v0.2.0"], { cwd: clone }).trim()).toBe(
        "v0.2.0",
      );
      expect(
        run("git", ["log", "-1", "--format=%s"], { cwd: clone }).trim(),
      ).toBe("chore(version): v0.2.0");
      expect(run("git", ["status", "--porcelain"], { cwd: clone }).trim()).toBe(
        "",
      );
      const changelog = readFileSync(join(clone, "CHANGELOG.md"), "utf8");
      expect(changelog).toContain("## v0.2.0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 240_000);

  it("is a clean no-op when the latest tag equals HEAD (already released)", () => {
    const { dir, clone } = buildSyntheticRepo("v0.1.0");
    try {
      const cog = installCog(version as string, digest as string, dir);
      // First bump to v0.2.0 (creates the release).
      run("bash", ["-c", '"$0" bump --auto >/dev/null 2>&1', cog], {
        cwd: clone,
        env: npmPathPrepend(dir),
      });
      const headAfter = run("git", ["rev-parse", "HEAD"], {
        cwd: clone,
      }).trim();
      // Now HEAD == v0.2.0 tag: a second bump must be a clean no-op.
      const second = run("bash", ["-c", '"$0" bump --auto 2>&1', cog], {
        cwd: clone,
        env: npmPathPrepend(dir),
      });
      // No new tag/commit beyond v0.2.0; HEAD unchanged.
      expect(run("git", ["rev-parse", "HEAD"], { cwd: clone }).trim()).toBe(
        headAfter,
      );
      expect(
        run("git", ["log", "-1", "--format=%s"], { cwd: clone }).trim(),
      ).toBe("chore(version): v0.2.0");
      expect(run("git", ["tag", "-l", "v0.2.0"], { cwd: clone }).trim()).toBe(
        "v0.2.0",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 240_000);
});
