"use client";

import { ArrowUpRight } from "lucide-react";
import Reveal from "../../motion/Reveal";
import VideoFacade from "../VideoFacade";
import styles from "../Showcase.module.css";

// Video examples: one large click-to-play feature plus link tiles. The grid has
// exactly as many cells as there are real assets — no filler tiles.
export default function VideoWall({ tenant }) {
  const wall = tenant?.showcase?.videoWall;
  if (!wall?.primary?.videoId) return null;

  const tiles = wall.tiles || [];

  return (
    <section className={styles.section} id="videos">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <h2 className={styles.h2}>{wall.headline || "Video examples"}</h2>
          {wall.body && <p className={styles.sectionBody}>{wall.body}</p>}
        </Reveal>
        <Reveal delay={0.08}>
          <div className={styles.wall}>
            <div className={styles.wallPrimary}>
              <VideoFacade
                videoId={wall.primary.videoId}
                title={wall.primary.title}
                caption={wall.primary.caption}
              />
            </div>
            {tiles.map((tile) => {
              const href =
                tile.type === "reel"
                  ? `https://www.instagram.com/reel/${tile.code}/`
                  : tile.url;
              return (
                <a
                  key={tile.title}
                  className={`${styles.wallTile} ${
                    tile.type === "channel" ? styles.wallTileAccent : ""
                  }`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.wallTileIcon} aria-hidden="true">
                    <ArrowUpRight size={20} />
                  </span>
                  <h3 className={styles.wallTileTitle}>{tile.title}</h3>
                  {tile.caption && <p className={styles.wallTileCaption}>{tile.caption}</p>}
                </a>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
