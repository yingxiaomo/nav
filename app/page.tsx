import fs from 'fs';
import path from 'path';
import HomeClient from '@/components/home-client';

export default function Page() {
  let wallpapersBase64: string[] = [];

  try {
    const publicDir = path.join(process.cwd(), 'public');
    const wallpaperDir = path.join(publicDir, 'wallpapers');
    const maxWallpapers = 5;

    if (fs.existsSync(wallpaperDir)) {
      const files = fs.readdirSync(wallpaperDir);

      const imageFiles = files.filter(file =>
        ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(path.extname(file).toLowerCase())
      );

      // Fisher-Yates 洗牌后取前 N 张
      const shuffled = [...imageFiles];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      wallpapersBase64 = shuffled.slice(0, Math.min(maxWallpapers, imageFiles.length))
        .map(file => `/wallpapers/${file}`);

      console.log(`已索引 ${wallpapersBase64.length} 张壁纸路径`);
    }
  } catch (error) {
    console.error('构建预处理失败:', error);
  }

  return <HomeClient initialWallpapers={wallpapersBase64} />;
}