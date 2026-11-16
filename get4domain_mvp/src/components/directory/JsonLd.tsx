import { serializeJsonLd } from '@/lib/v3-public/metadata';

/** One script tag per JSON-LD item, escaped so no text in a model can close the tag. */
export default function JsonLd({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <>
      {items.map((item, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }} />
      ))}
    </>
  );
}
