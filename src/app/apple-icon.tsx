import { ImageResponse } from "next/og";

// iOS ignores SVG icons for "Add to Home Screen"; this renders the same
// mark as icon.svg as a 180×180 PNG.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const block = (left: number, top: number) => (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: 45,
        height: 45,
        borderRadius: 8,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 17, height: 17, borderRadius: 3, background: "#0f172a" }} />
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#0f172a", display: "flex", position: "relative" }}>
        {block(34, 34)}
        {block(101, 34)}
        {block(34, 101)}
        <div style={{ position: "absolute", left: 107, top: 107, width: 14, height: 14, borderRadius: 3, background: "#fff" }} />
        <div style={{ position: "absolute", left: 129, top: 107, width: 17, height: 14, borderRadius: 3, background: "#fff" }} />
        <div style={{ position: "absolute", left: 107, top: 129, width: 39, height: 17, borderRadius: 3, background: "#fff" }} />
      </div>
    ),
    size
  );
}
