// Wire contract for the `structuredContent` payload crossing the server -> UI
// seam. Zod-first: the schemas are the single declaration of the shape; the TS
// types are inferred from them. server.ts types its results against the
// inferred types (compile-time enforcement on the write side); the UI parses
// with parseView (runtime enforcement on the read side).
//
// Unknown keys are stripped (zod default) so an older UI bundle tolerates a
// newer server that added fields.
import { z } from "zod";

const CollectionViewSchema = z.object({
  id: z.string(),
  title: z.string(),
});

const ItemViewSchema = z.object({
  id: z.string(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  previewHref: z.string().nullable(),
  cogHref: z.string().nullable(),
  bbox: z.array(z.number()).nullable(),
});

const ViewSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("collections"),
    collections: z.array(CollectionViewSchema),
  }),
  z.object({
    kind: z.literal("items"),
    collectionId: z.string(),
    demo: z.boolean().optional(),
    items: z.array(ItemViewSchema),
  }),
]);

export type CollectionView = z.infer<typeof CollectionViewSchema>;
export type ItemView = z.infer<typeof ItemViewSchema>;
export type View = z.infer<typeof ViewSchema>;

// Parse a tool result's structuredContent into a View. Throws on a payload
// that doesn't match the contract so the UI surfaces the drift in its error
// banner instead of rendering an empty start screen.
export function parseView(structuredContent: unknown): View {
  const parsed = ViewSchema.safeParse(structuredContent);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
    throw new Error(
      `Unexpected result from server${where}: ${issue?.message ?? "invalid payload"}`,
    );
  }
  return parsed.data;
}
