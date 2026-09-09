import { albums } from "../../data/albums";

export default function AlbumGrid() {
  if (albums.length === 0) {
    return <p className="text-sm text-on-surface-variant">还没有相册。</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {albums.map((a, i) => (
        <a
          key={a.id}
          href={`/albums/${a.slug}`}
          className="fade-up group overflow-hidden rounded-m3 bg-surface-container transition-transform hover:-translate-y-0.5"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <img
            src={a.cover}
            alt={a.title}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover"
          />
          <div className="p-3">
            <h3 className="font-medium text-on-surface">{a.title}</h3>
            {a.description && (
              <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant">
                {a.description}
              </p>
            )}
            <p className="mt-1 text-xs text-on-surface-variant">{a.photos.length} photos</p>
          </div>
        </a>
      ))}
    </div>
  );
}
