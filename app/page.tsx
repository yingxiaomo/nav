import fs from 'fs';
import path from 'path';
import HomeClient from '../components/home-client';
import { DEFAULT_DATA } from '../lib/types';

export default function Page() {
  let wallpapersBase64: string[] = [];

  try {
    const publicDir = path.join(process.cwd(), 'public');
    const wallpaperDir = path.join(publicDir, 'wallpapers');
    const dataFile = path.join(publicDir, 'data.json');
    
    let maxWallpapers = DEFAULT_DATA.settings.maxPackedWallpapers || 10; 
    
    if (fs.existsSync(dataFile)) {
      try {
        const fileContent = fs.readFileSync(dataFile, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        if (jsonData.settings && typeof jsonData.settings.maxPackedWallpapers === 'number') {
            maxWallpapers = jsonData.settings.maxPackedWallpapers;
        }
      } catch {
        console.error('[Build] 读取 data.json 配置失败，使用默认值');
      }
    }
    
    if (fs.existsSync(wallpaperDir)) {
      const files = fs.readdirSync(wallpaperDir);
      
      const imageFiles = files.filter(file => 
        ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(path.extname(file).toLowerCase())
      );

      
      const selected = imageFiles.slice(0, maxWallpapers);

      
      wallpapersBase64 = selected.map(file => `/wallpapers/${file}`);
      
      console.log(`已索引 ${wallpapersBase64.length} 张壁纸路径`);
    }
  } catch (error) {
    console.error('构建预处理失败:', error);
  }

  return <HomeClient initialWallpapers={wallpapersBase64} />;
}