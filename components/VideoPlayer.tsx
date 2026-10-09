'use client';

function toEmbedUrl(url: string): { type: 'youtube' | 'video'; src: string } {
  // YouTube patterns: watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0` };
  return { type: 'video', src: url };
}

export default function VideoPlayer({ url }: { url: string }) {
  const { type, src } = toEmbedUrl(url);
  if (type === 'youtube') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="w-full" style={{ aspectRatio: '16/9', maxHeight: '100%' }}>
          <iframe
            src={src}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
            style={{ aspectRatio: '16/9' }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <video src={src} controls className="max-w-full max-h-full" style={{ maxHeight: 'calc(100vh - 140px)' }} />
    </div>
  );
}
