export default function Timeline({ items }: { items: { title: string; message: string; at: string }[] }) {
  return (
    <ol className="relative border-l border-border pl-4">
      {items.map((it, i) => (
        <li key={i} className="mb-4 ml-2">
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
          <p className="font-medium">{it.title}</p>
          <p className="text-xs text-muted">{it.message}</p>
          <p className="text-xs text-muted">{new Date(it.at).toLocaleString("es-CO")}</p>
        </li>
      ))}
    </ol>
  );
}
