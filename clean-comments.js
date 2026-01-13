const fs = require('fs');
const path = require('path');


const removeComments = (code) => {
  
  code = code.replace(/\/\*[\s\S]*?\*\
  
  code = code.replace(/(?:^|[^:\/])\/\/.*$/gm, (match) => {
    
    if (/(['"])\/\
      return match;
    }
    
    if (/https?:\/\
      return match;
    }
    
    return match.replace(/\/\/.*$/, '');
  });
  return code;
};


const getFilesToClean = () => {
  const files = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  
  const traverse = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '.git' && entry.name !== 'node_modules' && entry.name !== '.next') {
          traverse(fullPath);
        }
      } else if (extensions.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  };
  
  traverse('.');
  return files;
};


const cleanComments = () => {
  const files = getFilesToClean();
  
  console.log('开始清理注释...');
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const cleaned = removeComments(content);
      fs.writeFileSync(file, cleaned, 'utf8');
      console.log(`已清理: ${file}`);
    } catch (error) {
      console.error(`清理失败: ${file}`, error);
    }
  }
  
  console.log('注释清理完成！');
};

cleanComments();