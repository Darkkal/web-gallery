import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

// Issue #150 regression guard: a stray quote in a workflow `run:` block shipped
// to master and failed CI with `unexpected EOF while looking for matching ')'`.
// Every run-block of every Forgejo workflow must therefore parse as shell.
// Issue #167: additionally assert the single one-job version workflow meets the
// manual Cocogitto-lite contract (no cross-job outputs, no publication, exact
// atomic refs, fail-closed, clean no-op from Git state).

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
});

describe("manual Cocogitto version workflow (#167)", () => {
  const release = join(process.cwd(), ".forgejo", "workflows", "version.yml");
  const yaml = readFileSync(release, "utf8");
  const parsed = YAML.parse(yaml) as {
    on: Record<string, unknown>;
    env: Record<string, string>;
    permissions: Record<string, string>;
    jobs: Record<
      string,
      {
        if?: string;
        outputs?: Record<string, string>;
        steps: Array<Record<string, unknown>>;
      }
    >;
  };

  it("is manual (workflow_dispatch) only, with no push-trigger, plan job, or outputs", () => {
    expect(parsed.on).not.toHaveProperty("push");
    expect(parsed.on).toHaveProperty("workflow_dispatch");
    const jobs = Object.keys(parsed.jobs);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toBe("version");
    expect(parsed.jobs.version.outputs).toBeUndefined();
    expect(parsed.jobs.version.if).toBeUndefined(); // no gate/condition
  });

  it("pins and digest-verifies Cocogitto 7.0.0 across the whole file", () => {
    expect(parsed.env.COG_VERSION).toBe("7.0.0");
    expect(parsed.env.COG_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(yaml).toContain("sha256sum --check --strict -");
  });

  it("fails closed on missing release credentials", () => {
    const block = extractRunBlocks(yaml).find((b) =>
      b.includes("secret 'RELEASE_TOKEN'"),
    );
    expect(block).toBeDefined();
    expect(block).toContain("secret 'RELEASE_USER'");
  });

  it("records pre-bump state and classifies clean no-op from Git state, not stdout", () => {
    const all = extractRunBlocks(yaml).join("\n");
    expect(all).toContain("BEFORE_HEAD");
    expect(all).toContain("BEFORE_TAGS");
    expect(all).toContain("NEW_TAGS");
    expect(all).toContain("git tag --points-at HEAD");
    expect(all).toContain("clean no-op");
    expect(all).toMatch(/RELEASE_REQUIRED=false/);
    // Regression (#167 review): the no-op is only when HEAD *and* the set of
    // tags at HEAD are both unchanged — an existing tag must not force a
    // release. Compare before/after tags, not just an empty NEW_TAGS.
    expect(all).toContain('[ "${BEFORE_TAGS}" = "${NEW_TAGS}" ]');
    // No stdout text-parsing of the cog output to decide no-op.
    expect(all).not.toContain("cog bump --dry-run");
  });

  it("enforces dispatch on refs/heads/master before any versioning/push", () => {
    const all = extractRunBlocks(yaml).join("\n");
    // Regression (#167 review): workflow_dispatch can select a feature branch;
    // we must reject any ref that is not master and verify HEAD == remote master.
    expect(all).toContain('"${REF}" != "refs/heads/master"');
    expect(all).toContain("must be dispatched on 'master'");
    expect(all).toContain("git ls-remote origin refs/heads/master");
    expect(all).toContain("refusing to version an unpushed or non-master ref");
  });

  it("verifies one aligned version commit/tag and refuses malformed state", () => {
    const all = extractRunBlocks(yaml).join("\n");
    expect(all).toContain("chore(version)");
    expect(all).toContain("package.json version");
    expect(all).toContain("CHANGELOG.md lacks");
    expect(all).toContain("unclean worktree after bump");
  });

  it("pushes only HEAD:master and the exact new tag, atomically", () => {
    const all = extractRunBlocks(yaml).join("\n");
    expect(all).toContain("git push --atomic");
    expect(all).toContain('"HEAD:refs/heads/master"');
    expect(all).toMatch(/refs\/tags\/\$\{TAG\}/);
  });

  it("contains no publication/prohibited constructs", () => {
    const all = extractRunBlocks(yaml).join("\n");
    const prohibited = [
      "forgejo-release",
      "docker build",
      "docker push",
      "ghcr.io",
      ":latest",
      "npm run build",
      "push: tags",
    ];
    for (const p of prohibited) {
      expect(all, `version workflow must not contain '${p}'`).not.toContain(p);
    }
    // No cross-job/triggering constructs remain.
    expect(yaml).not.toContain("RELEASES_ENABLED");
    expect(yaml).not.toContain("next_tag");
    expect(yaml).not.toContain("needs:");
  });

  it("uses a full-history checkout with persisted credentials disabled", () => {
    const checkout = parsed.jobs.version.steps.find(
      (s) => (s as { uses?: string }).uses === "actions/checkout@v4",
    ) as { with?: Record<string, unknown> } | undefined;
    expect(checkout).toBeDefined();
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
    expect(checkout?.with?.["persist-credentials"]).toBe(false);
  });
});

describe("no cross-job boundary remains (issue #167)", () => {
  it("does not define any job outputs or needs in the version workflow", () => {
    const yaml = readFileSync(
      join(process.cwd(), ".forgejo", "workflows", "version.yml"),
      "utf8",
    );
    expect(yaml).not.toMatch(/^\s{4}outputs:/m);
    expect(yaml).not.toMatch(/needs:/);
  });
});
