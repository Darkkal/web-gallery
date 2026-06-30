import { vi } from "vitest";

// Mock Next.js utilities commonly used in server actions
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
