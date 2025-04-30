const { render } = require("@scenejs/render");

render({
  input: "./animated_banner.html",
  name: "scene",
  codec: "libvpx-vp9",
  output: "output.webm",
  height: 360,
  width: 820,
  fps: 24,
  alpha: true,
  ffmpegPath: require("@ffmpeg-installer/ffmpeg").path,
});