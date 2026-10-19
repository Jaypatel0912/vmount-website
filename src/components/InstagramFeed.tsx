import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { brand, reels } from "../data/site";

/**
 * Live Instagram feed. By default it reads /api/instagram (the Netlify function in
 * netlify/functions/instagram.mjs), which pages through every post on the account.
 * VITE_INSTAGRAM_FEED_URL can point somewhere else (e.g. a Behold.so JSON feed).
 * If the feed is not connected or fails, the embedded reels are shown instead.
 */
const FEED_URL = (import.meta.env.VITE_INSTAGRAM_FEED_URL as string | undefined) || "/api/instagram";
const PAGE_SIZE = 12;

type Post = {
  id: string;
  type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  isReel: boolean;
  mediaUrl: string;
  thumbUrl: string;
  permalink: string;
  caption: string;
  timestamp?: string;
};

function normalize(json: any): Post[] {
  const raw: any[] = Array.isArray(json) ? json : json?.posts ?? json?.data ?? [];
  return raw
    .map((p) => {
      const type = p.mediaType ?? p.media_type ?? "IMAGE";
      const first = p.children?.[0] ?? p.children?.data?.[0];
      const mediaUrl = p.mediaUrl ?? p.media_url ?? first?.mediaUrl ?? first?.media_url ?? "";
      const thumbUrl =
        p.sizes?.medium?.mediaUrl ?? p.thumbnailUrl ?? p.thumbnail_url ?? (type === "VIDEO" ? "" : mediaUrl);
      return {
        id: String(p.id),
        type,
        isReel: Boolean(p.isReel) || type === "VIDEO" || String(p.permalink ?? "").includes("/reel/"),
        mediaUrl,
        thumbUrl: thumbUrl || mediaUrl,
        permalink: p.permalink ?? brand.instagram,
        caption: p.prunedCaption ?? p.caption ?? "",
        timestamp: p.timestamp,
      } as Post;
    })
    .filter((p) => p.mediaUrl);
}

type FeedState = { status: "loading" | "ready" | "error"; posts: Post[]; next: string | null; loadingMore: boolean };

function pageUrl(after?: string | null) {
  const url = new URL(FEED_URL, window.location.origin);
  url.searchParams.set("limit", String(PAGE_SIZE));
  if (after) url.searchParams.set("after", after);
  return url.toString();
}

async function fetchPage(after?: string | null) {
  const r = await fetch(pageUrl(after));
  if (!r.ok || !r.headers.get("content-type")?.includes("json")) throw new Error(String(r.status));
  const json = await r.json();
  return { posts: normalize(json), next: (json?.next as string | null | undefined) ?? null };
}

function useFeed() {
  const [state, setState] = useState<FeedState>({ status: "loading", posts: [], next: null, loadingMore: false });

  useEffect(() => {
    let cancelled = false;
    fetchPage()
      .then(({ posts, next }) => !cancelled && setState({ status: posts.length ? "ready" : "error", posts, next, loadingMore: false }))
      .catch(() => !cancelled && setState((s) => ({ ...s, status: "error" })));
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = () => {
    if (!state.next || state.loadingMore) return;
    setState((s) => ({ ...s, loadingMore: true }));
    fetchPage(state.next)
      .then(({ posts, next }) =>
        setState((s) => {
          const seen = new Set(s.posts.map((p) => p.id));
          return { ...s, posts: [...s.posts, ...posts.filter((p) => !seen.has(p.id))], next, loadingMore: false };
        }),
      )
      .catch(() => setState((s) => ({ ...s, loadingMore: false })));
  };

  return { ...state, loadMore };
}

const isVideoUrl = (p: Post) => p.type === "VIDEO";

function Tile({ post, index, onOpen }: { post: Post; index: number; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <motion.button
      layoutId={`ig-${post.id}`}
      className={`ig-tile${post.isReel ? " is-reel" : ""}`}
      onClick={onOpen}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: (index % 4) * 0.06 }}
      aria-label={post.isReel ? "Play reel" : "Open photo"}
    >
      <img src={post.thumbUrl} alt={post.caption.slice(0, 80) || "Instagram post"} loading="lazy" />
      {isVideoUrl(post) && hover && <video src={post.mediaUrl} muted autoPlay loop playsInline />}
      <span className="ig-badge">{post.isReel ? "▶ Reel" : post.type === "CAROUSEL_ALBUM" ? "▣ Album" : "Photo"}</span>
      {post.caption && <span className="ig-caption">{post.caption}</span>}
    </motion.button>
  );
}

function Lightbox({ post, onClose }: { post: Post; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <motion.div className="ig-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div layoutId={`ig-${post.id}`} className="ig-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ig-modal-media">
          {isVideoUrl(post) ? (
            <video src={post.mediaUrl} poster={post.thumbUrl} controls autoPlay playsInline />
          ) : (
            <img src={post.mediaUrl} alt={post.caption.slice(0, 80) || "Instagram post"} />
          )}
        </div>
        <div className="ig-modal-side">
          <div className="ig-modal-head">
            <img src={brand.logo} alt="" />
            <strong>{brand.instagramHandle}</strong>
          </div>
          <p>{post.caption}</p>
          <a className="btn btn-primary" href={post.permalink} target="_blank" rel="noreferrer">
            View on Instagram
          </a>
        </div>
        <button className="ig-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </motion.div>
    </motion.div>
  );
}

function FallbackReels() {
  return (
    <div className="reels">
      {reels.map((code, i) => (
        <motion.div
          key={code}
          className="reel"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: i * 0.1 }}
        >
          <iframe src={`https://www.instagram.com/reel/${code}/embed`} title={`VMount Instagram reel ${i + 1}`} loading="lazy" allow="encrypted-media" />
        </motion.div>
      ))}
    </div>
  );
}

export default function InstagramFeed() {
  const { status, posts, next, loadingMore, loadMore } = useFeed();
  const [open, setOpen] = useState<Post | null>(null);

  return (
    <section className="section" id="instagram">
      <div className="section-head insta-head">
        <div>
          <span className="eyebrow">Live from Instagram</span>
          <h2>Latest posts &amp; reels</h2>
        </div>
        <motion.a href={brand.instagram} target="_blank" rel="noreferrer" className="btn btn-ghost" whileHover={{ scale: 1.04 }}>
          Follow {brand.instagramHandle}
        </motion.a>
      </div>

      {status === "loading" && (
        <div className="ig-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="ig-tile ig-skeleton" />
          ))}
        </div>
      )}

      {status === "ready" && (
        <>
          <div className="ig-grid">
            {posts.map((p, i) => (
              <Tile key={p.id} post={p} index={i} onOpen={() => setOpen(p)} />
            ))}
          </div>
          <div className="more">
            {next ? (
              <motion.button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                {loadingMore ? "Loading…" : "Load more posts"}
              </motion.button>
            ) : (
              <a className="link" href={brand.instagram} target="_blank" rel="noreferrer">
                See everything on Instagram →
              </a>
            )}
          </div>
        </>
      )}

      {status === "error" && <FallbackReels />}

      <AnimatePresence>{open && <Lightbox key={open.id} post={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </section>
  );
}
