const fs = require('fs');
const path = require('path');

// 配置需要清理的文件类型
const fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];
// 配置需要排除的目录
const excludeDirs = ['node_modules', '.next', '.git', 'public'];

// 清理单个文件的注释
function cleanFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 清理多行注释 /* ... */
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 清理单行注释 // ... 但不包括URL和字符串中的//
    content = content.replace(/(?<!['"`])(?<!:)\/\/.*$/gm, '');
    
    // 清理多余的空行
    content = content.replace(/\n\s*\n/g, '\n\n');
    
    // 保存清理后的内容
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`已清理: ${filePath}`);
  } catch (error) {
    console.error(`✗ 清理失败: ${filePath}`, error.message);
  }
}

// 递归遍历目录
function traverseDirectory(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      // 跳过排除目录
      if (!excludeDirs.includes(file.name)) {
        traverseDirectory(fullPath);
      }
    } else if (file.isFile()) {
      // 只处理指定类型的文件
      if (fileExtensions.some(ext => file.name.endsWith(ext))) {
        cleanFile(fullPath);
      }
    }
  }
}

// 开始清理
console.log('开始清理项目注释...');
traverseDirectory(path.resolve(__dirname));
console.log('注释清理完成！');
