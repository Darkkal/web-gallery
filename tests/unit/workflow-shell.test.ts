import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression (issue #150): a stray quote in a workflow `run:` block shipped to
// master and failed the release plan job with
// `unexpected EOF while looking for matching ')'` — only visible at CI time.
// Every run-block of every Forgejo workflow must therefore parse as shell.

function workflowFiles(): string[] {
  const dir = join(process.cwd(), ".forgejo", "workflows");
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

/** Extract the literal-block content of each `run: |` mapping. */
function extractRunBlocks(yaml: string): string[] {
  const blocks: string[] = [];
  const lines = yaml.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)(?:run|script):\s*[|>][-+]?\s*$/);
    if (!match) continue;
    const indent = match[1].length;
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) {
        body.push("");
        continue;
      }
      const lineIndent = line.match(/^\s*/)?.[0].length ?? 0;
      if (lineIndent <= indent) break;
      body.push(line.slice(indent + 2));
    }
    while (body.length && !body[body.length - 1].trim()) body.pop();
    if (body.length) blocks.push(body.join("\n"));
  }
  return blocks;
}

describe("workflow run blocks parse as shell (issue #150)", () => {
  it("every workflow run block passes bash -n", () => {
    const files = workflowFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const yaml = readFileSync(file, "utf8");
      const blocks = extractRunBlocks(yaml);
      for (let i = 0; i < blocks.length; i++) {
        let result: { status: number | null; stderr: string };
        try {
          execFileSync("bash", ["-n"], { input: blocks[i], encoding: "utf8" });
          result = { status: 0, stderr: "" };
        } catch (err) {
          result = err as { status: number | null; stderr: string };
        }
        expect(
          result.status,
          `${file} run-block #${i + 1} has shell syntax errors:\n${result.stderr}\n---\n${blocks[i]}`,
        ).toBe(0);
      }
    }
  });

  it("the cocogitto pipeline plans and validates before releasing", () => {
    const release = join(process.cwd(), ".forgejo", "workflows", "release.yml");
    const yaml = readFileSync(release, "utf8");
    const blocks = extractRunBlocks(yaml);
    // plan job: history validation + dry-run version computation.
    // cog check runs as an inline step; assert it directly on the workflow.
    expect(yaml).toContain("cog check --from-latest-tag");
    expect(blocks.some((b) => b.includes("cog bump --dry-run --auto"))).toBe(
      true,
    );
    // release job: native bump + ATOMIC version-commit/tag push (#160).
    const releaseBlock = blocks.find(
      (b) => b.includes("cog bump --auto\n") || b.endsWith("cog bump --auto"),
    );
    expect(releaseBlock).toBeDefined();
    expect(
      blocks.some((b) =>
        b.includes('git push --atomic origin "HEAD:refs/heads/master"'),
      ),
    ).toBe(true);
    // The rejected release-PR / release-branch orchestration stays gone.
    expect(blocks.some((b) => b.includes("Open release PR"))).toBe(false);
    expect(blocks.some((b) => b.includes("release/v"))).toBe(false);
  });
});

describe("clean/no-op push skips publishing entirely (#161 review)", () => {
  it("every publish-facing step sits under the job-level gate", () => {
    const release = join(process.cwd(), ".forgejo", "workflows", "release.yml");
    const fileYaml = readFileSync(release, "utf8");
    const jobStart = fileYaml.indexOf("  release:");
    expect(jobStart).toBeGreaterThan(-1);
    const releaseSection = fileYaml.slice(jobStart);
    // The job-level gate must appear BEFORE any publish-facing step.
    const gateEnd = releaseSection.indexOf("next_version != ''");
    expect(gateEnd).toBeGreaterThan(-1);
    for (const stepName of [
      "Create atomic version commit + tag on master",
      "Build standalone binaries",
      "Create release archives",
      "Publish release + assets",
      "Publish Docker image to Forgejo registry",
    ]) {
      const stepIdx = releaseSection.indexOf(stepName);
      expect(stepIdx, `missing step: ${stepName}`).toBeGreaterThan(-1);
      expect(
        stepIdx,
        `step '${stepName}' must come after the job-level gate`,
      ).toBeGreaterThan(gateEnd);
    }
  });
});

describe("release gate cutover policy (#161 review)", () => {
  const release = join(process.cwd(), ".forgejo", "workflows", "release.yml");
  const yaml = readFileSync(release, "utf8");

  it("manual workflow_dispatch is always allowed", () => {
    expect(yaml).toContain("github.event_name == 'workflow_dispatch'");
  });

  it("push-triggered releases require vars.RELEASES_ENABLED == 'true'", () => {
    expect(yaml).toContain("vars.RELEASES_ENABLED == 'true'");
  });

  it("push-triggered releases also require a planned next version", () => {
    expect(yaml).toContain("needs.plan.outputs.next_version != ''");
  });
});

describe("pinned Cocogitto archive digest (#160)", () => {
  const release = join(process.cwd(), ".forgejo", "workflows", "release.yml");
  const yaml = readFileSync(release, "utf8");

  /** Mirror of the workflow's local digest-verification command shape. */
  function verifyDigest(
    digest: string,
    file: string,
  ): {
    status: number | null;
    stderr: string;
  } {
    try {
      execFileSync(
        "bash",
        [
          "-c",
          'printf "%s  %s\\n" "$1" "$2" | sha256sum --check --strict -',
          "verify",
          digest,
          file,
        ],
        { encoding: "utf8" },
      );
      return { status: 0, stderr: "" };
    } catch (err) {
      return err as { status: number | null; stderr: string };
    }
  }

  it("pins exactly one shared workflow-level 64-hex digest", () => {
    const defs = yaml.match(/^\s*COG_SHA256:\s*"?([0-9a-f]{64})"?\s*$/gm);
    expect(defs, "workflow-level COG_SHA256 definition").not.toBeNull();
    expect(defs).toHaveLength(1);
    // Workflow-level scope only (2-space indent); no per-step overrides.
    expect(yaml).toMatch(/^ {2}COG_SHA256: "[0-9a-f]{64}"$/m);
    expect(yaml).not.toMatch(/^\s{4,}COG_SHA256:/m);
  });

  it("both install paths verify the downloaded archive against the pin", () => {
    expect(yaml.match(/sha256sum --check --strict -/g)).toHaveLength(2);
    expect(yaml.match(/printf '%s {2}%s\\n' "\$\{COG_SHA256\}"/g)).toHaveLength(
      2,
    );
  });

  it("requests no nonexistent .sha256 sidecar URL", () => {
    expect(yaml).not.toContain(".sha256");
  });

  it("the verification command accepts an archive matching its digest", () => {
    const dir = mkdtempSync(join(tmpdir(), "cog-digest-"));
    try {
      const archive = join(dir, "cog.tar.gz");
      execFileSync("tar", [
        "-czf",
        archive,
        "-C",
        process.cwd(),
        "package.json",
      ]);
      const digest = execFileSync("sha256sum", [archive], { encoding: "utf8" })
        .split(" ")[0]
        .trim();
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
      expect(verifyDigest(digest, archive).status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the verification command rejects altered bytes (--strict)", () => {
    const dir = mkdtempSync(join(tmpdir(), "cog-digest-"));
    try {
      const archive = join(dir, "cog.tar.gz");
      execFileSync("tar", [
        "-czf",
        archive,
        "-C",
        process.cwd(),
        "package.json",
      ]);
      const expected = execFileSync("sha256sum", [archive], {
        encoding: "utf8",
      })
        .split(" ")[0]
        .trim();
      appendFileSync(archive, Buffer.from([0x00]));
      expect(verifyDigest(expected, archive).status).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("release credential preflight (#160)", () => {
  const release = join(process.cwd(), ".forgejo", "workflows", "release.yml");
  const yaml = readFileSync(release, "utf8");

  it("uses only the RELEASE_TOKEN/RELEASE_USER secrets (Forgejo forbids FORGEJO_* names)", () => {
    expect(yaml).not.toContain("FORGEJO_RELEASE_");
    expect(
      yaml.match(/secrets\.RELEASE_TOKEN/g)?.length,
    ).toBeGreaterThanOrEqual(3);
    expect(yaml).toContain("secrets.RELEASE_USER");
  });

  it("docker login authenticates as the release user, not the dispatching actor", () => {
    expect(yaml).toContain('"${RELEASE_USER}"');
    expect(yaml).not.toContain("github.actor");
  });

  it("fails fast with clear errors before any authenticated step", () => {
    const checkIdx = yaml.indexOf("Verify release credentials are configured");
    expect(checkIdx).toBeGreaterThan(-1);
    for (const marker of [
      "secret 'RELEASE_TOKEN' is not set or empty",
      "secret 'RELEASE_USER' is not set or empty",
    ]) {
      expect(yaml).toContain(marker);
    }
    // Preflight must precede remote configuration, version-commit creation,
    // the forgejo-release upload and the Docker login.
    for (const later of [
      "Configure authenticated remote",
      "Create atomic version commit + tag on master",
      "Publish release + assets",
      "Publish Docker image to Forgejo registry",
    ]) {
      const idx = yaml.indexOf(later);
      expect(idx, `${later} missing`).toBeGreaterThan(-1);
      expect(idx).toBeGreaterThan(checkIdx);
    }
  });

  it("authors the version commit with a deterministic release identity", () => {
    expect(yaml).toContain('git config user.name "${RELEASE_USER}"');
    expect(yaml).toContain(
      'git config user.email "${RELEASE_USER}@users.noreply.${FORGEJO_HOST%/}"',
    );
    const identityIdx = yaml.indexOf(
      "Configure deterministic release identity",
    );
    // Use the run-line occurrence, not earlier header-comment mentions.
    const bumpIdx = yaml.lastIndexOf("cog bump --auto");
    expect(identityIdx).toBeGreaterThan(-1);
    expect(bumpIdx).toBeGreaterThan(identityIdx);
  });
});
