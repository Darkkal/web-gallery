import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "./search-parser";

describe("search-parser", () => {
  describe("parseSearchQuery", () => {
    it("should map tag: prefix to tag_names: and quote values with colons", () => {
      const res = parseSearchQuery("tag:勝利の女神:NIKKE");
      expect(res.cleanQuery).toBe('tag_names:"勝利の女神:NIKKE"');
      expect(res.sourceFilter).toBeNull();
    });

    it("should quote raw terms containing colons when not preceded by a valid column filter", () => {
      const res = parseSearchQuery("勝利の女神:NIKKE");
      expect(res.cleanQuery).toBe('"勝利の女神:NIKKE"');
      expect(res.sourceFilter).toBeNull();
    });

    it("should handle user: prefix with colon in value", () => {
      const res = parseSearchQuery("user:John:Doe");
      expect(res.cleanQuery).toBe('user_name:"John:Doe"');
      expect(res.sourceFilter).toBeNull();
    });

    it("should handle valid tag prefix without colons in value", () => {
      const res = parseSearchQuery("tag:car");
      expect(res.cleanQuery).toBe("tag_names:car");
    });

    it("should extract source filter and clean remaining query", () => {
      const res = parseSearchQuery("source:twitter tag:勝利の女神:NIKKE");
      expect(res.sourceFilter).toBe("twitter");
      expect(res.cleanQuery).toBe('tag_names:"勝利の女神:NIKKE"');
    });

    it("should handle invalid column prefixes by quoting the whole term", () => {
      const res = parseSearchQuery("invalid_column:value");
      expect(res.cleanQuery).toBe('"invalid_column:value"');
    });

    it("should preserve already double-quoted terms", () => {
      const res = parseSearchQuery('tag:"勝利の女神:NIKKE"');
      expect(res.cleanQuery).toBe('tag_names:"勝利の女神:NIKKE"');
    });
  });
});
