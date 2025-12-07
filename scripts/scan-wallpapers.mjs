// scripts/scan-wallpapers.mjs
import fs from 'fs';
import path from 'path';

const WALLPAPER_DIR = 'public/wallpapers';
const DATA_FILE = 'public/data.json';

const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];

try {
  console.log('🔍 正在扫描壁纸目录...');

  const files = fs.readdirSync(WALLPAPER_DIR);
  
  const wallpapers = files
    .filter(file => EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .map(file => `/wallpapers/${file}`); 

  console.log(`✅ 发现 ${wallpapers.length} 张壁纸`);

  const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(rawData);

  data.settings.wallpaperList = wallpapers;

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  console.log('🎉 data.json 已自动更新！');

} catch (error) {
  console.error('❌ 扫描失败:', error.message);
  if (error.code === 'ENOENT' && error.path === WALLPAPER_DIR) {
    console.log('📂 正在创建壁纸目录...');
    fs.mkdirSync(WALLPAPER_DIR, { recursive: true });
  }
}