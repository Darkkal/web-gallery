import { type NextRequest, NextResponse } from "next/server";
import {
  autocompleteContent,
  autocompleteHandle,
  autocompleteTag,
  autocompleteTitle,
  autocompleteUser,
} from "@/lib/db/repositories/autocomplete";
import type {
  AutocompleteResponse,
  AutocompleteSuggestion,
} from "@/types/autocomplete";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const column = searchParams.get("column")?.toLowerCase();
  const q = searchParams.get("q") || "";
  const limitStr = searchParams.get("limit") || "8";
  const limit = Math.max(1, Math.min(50, parseInt(limitStr, 10) || 8));
  const context = searchParams.get("context") || undefined;

  if (!column) {
    return NextResponse.json({ suggestions: [] } as AutocompleteResponse);
  }

  let suggestions: AutocompleteSuggestion[] = [];

  try {
    switch (column) {
      case "tag":
        suggestions = await autocompleteTag(q, limit, context);
        break;
      case "user":
        suggestions = await autocompleteUser(q, limit);
        break;
      case "handle":
        suggestions = await autocompleteHandle(q, limit);
        break;
      case "title":
        suggestions = await autocompleteTitle(q, limit);
        break;
      case "content":
        suggestions = await autocompleteContent(q, limit);
        break;
      case "source":
      case "extractor": {
        // For source and extractor, return static values matching posts.extractorType
        const staticValues = [
          "twitter",
          "pixiv",
          "gelbooruv02",
          "ehentai",
          "exhentai",
        ];
        suggestions = staticValues
          .filter((v) => v.startsWith(q.toLowerCase()))
          .map((v) => ({
            value: v,
            label: v,
            type: "value" as const,
          }));
        break;
      }
      default:
        suggestions = [];
    }
  } catch (error) {
    console.error("Autocomplete API Error:", error);
    // Return empty suggestions array on error to fail gracefully in the UI
    return NextResponse.json({ suggestions: [] } as AutocompleteResponse);
  }

  return NextResponse.json({ suggestions } as AutocompleteResponse);
}
