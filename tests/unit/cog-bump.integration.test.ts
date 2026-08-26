import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression (issue #160): the plan job only dry-runs the bump
// (`cog bump --dry-run --auto`), which never exercises CHANGELOG.md mutation
// or version-commit creation — so the first real dispatch failed with
// `cannot find default separator '- - -' in CHANGELOG.md`. This integration
// test runs the pinned Cocogitto in a disposable clone of this exact tree and
// asserts the full bump postconditions.

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
 * The cog.toml pre-bump hook shells out to `npm version`. CI runners always
 * provide npm; dev containers may not. When npm is missing, inject a minimal
 * behavioural shim (bumps the version fields in package.json +
 * package-lock.json) into PATH so the bump mechanics under test stay fully
 * exercisable outside CI.
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

describe("cocogitto bump integration (#160)", () => {
  const releaseYaml = readFileSync(
    join(repoRoot, ".forgejo", "workflows", "release.yml"),
    "utf8",
  );

  it("bumps a disposable clone to v0.8.0 with manifest, changelog, commit and tag", () => {
    // Read the pin from the workflow so this test can never drift from it.
    const version = releaseYaml.match(/COG_VERSION:\s*"([^"]+)"/)?.[1];
    const digest = releaseYaml.match(/COG_SHA256:\s*"([0-9a-f]{64})"/)?.[1];
    expect(version, "pinned COG_VERSION in release.yml").toBeTruthy();
    expect(digest, "pinned COG_SHA256 in release.yml").toBeTruthy();

    const dir = mkdtempSync(join(tmpdir(), "cog-bump-it-"));
    try {
      // Disposable clone of the committed tree under test (history + tags).
      const clone = join(dir, "clone");
      run("git", ["clone", "--quiet", `file://${repoRoot}`, clone]);
      // cog needs the real commit/tag graph: a shallow source would make it
      // compute a bogus next version (v0.0.1) instead of v0.8.0.
      const shallowMarker = join(clone, ".git", "shallow");
      if (existsSync(shallowMarker)) {
        throw new Error(
          "integration clone is shallow — checkout must use fetch-depth: 0",
        );
      }
      run("git", ["config", "user.name", "release-test"], { cwd: clone });
      run("git", ["config", "user.email", "release-test@example.com"], {
        cwd: clone,
      });

      // Download + digest-verify the pinned archive exactly like the workflow.
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
          digest as string,
          archive,
        ],
        { encoding: "utf8" },
      );
      const member = run("bash", [
        "-c",
        `tar -tzf "${archive}" | grep -E '(^|/)cog$' | head -1`,
      ]).trim();
      run("tar", ["-xzf", archive, "-C", dir]);
      const cog = join(dir, member);

      // The separator Cocogitto requires must already be in the tree; its
      // absence is exactly the failure that broke dispatch #205.
      const changelogBefore = readFileSync(join(clone, "CHANGELOG.md"), "utf8");
      expect(changelogBefore).toMatch(/^# Changelog\n\n- - -\n/m);

      // cog logs progress (incl. "Bumped version") on stderr; merge streams.
      const out = run("bash", ["-c", '"$0" bump --auto 2>&1', cog], {
        cwd: clone,
        env: npmPathPrepend(dir),
      });
      // Visible in runner logs for diagnosability.
      console.log("[cog bump --auto]\n" + out);
      expect(out).toContain("Bumped version");

      // Postconditions: manifest bumped, version commit + tag created.
      const diag = [
        run("git", ["log", "--oneline", "-5"], { cwd: clone }),
        run("git", ["status", "--short"], { cwd: clone }),
        readFileSync(join(clone, "package.json"), "utf8").slice(0, 200),
      ].join("\n---\n");
      const pkg = JSON.parse(readFileSync(join(clone, "package.json"), "utf8"));
      expect(pkg.version, `tree package.json:\n${diag}`).toBe("0.8.0");
      expect(run("git", ["tag", "-l", "v0.8.0"], { cwd: clone }).trim()).toBe(
        "v0.8.0",
      );
      expect(
        run("git", ["log", "-1", "--format=%s"], { cwd: clone }).trim(),
      ).toBe("chore(version): v0.8.0");

      // The new section sits after the preamble separator; history below.
      const changelogAfter = readFileSync(join(clone, "CHANGELOG.md"), "utf8");
      expect(changelogAfter).toContain("## v0.8.0");
      expect(changelogAfter.indexOf("## v0.8.0")).toBeLessThan(
        changelogAfter.indexOf("## [0.7.0]"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 240_000);
});
