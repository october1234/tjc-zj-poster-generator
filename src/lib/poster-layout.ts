export const POSTER_WIDTH = 1920;
export const POSTER_HEIGHT = 1080;
export const PHOTO_WIDTH = 1282;
export const PHOTO_HEIGHT = 962;

export type Photo = {
  src: string;
  name: string;
  width: number;
  height: number;
  region: { x: number; y: number; width: number; height: number };
};
export type Crop = { zoom: number; x: number; y: number };
export const DEFAULT_CROP: Crop = { zoom: 1, x: 0.5, y: 0.5 };
export const SAMPLE_PHOTO: Photo = {
  src: `${import.meta.env.BASE_URL}assets/sample.jpg`,
  name: "範例照片",
  width: 1920,
  height: 1080,
  // Only the photograph from the supplied reference is visible.
  region: { x: 638, y: 118, width: PHOTO_WIDTH, height: PHOTO_HEIGHT },
};

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function photoGeometry(photo: Photo, crop: Crop) {
  const { region } = photo;
  const scale = Math.max(PHOTO_WIDTH / region.width, PHOTO_HEIGHT / region.height) * clamp(crop.zoom, 1, 4);
  const overflowX = Math.max(0, region.width * scale - PHOTO_WIDTH);
  const overflowY = Math.max(0, region.height * scale - PHOTO_HEIGHT);
  return {
    width: photo.width * scale,
    height: photo.height * scale,
    left: -overflowX * clamp(crop.x) - region.x * scale,
    top: -overflowY * clamp(crop.y) - region.y * scale,
    overflowX,
    overflowY,
    scale,
  };
}
