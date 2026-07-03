// 图片处理工具函数

/**
 * 将图片文件转换为WebP格式
 * @param file 原始图片文件
 * @param quality 转换质量 (0-100)
 * @returns Promise<File> 转换后的WebP文件
 */
export const convertToWebP = (file: File, quality: number = 85): Promise<File> => {
  return new Promise((resolve, reject) => {
    // 检查文件是否为图片
    if (!file.type.startsWith('image/')) {
      reject(new Error('只能转换图片文件'));
      return;
    }

    // 如果已经是WebP格式，直接返回
    if (file.type === 'image/webp') {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        // 创建Canvas元素
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        // 绘制图片
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建Canvas上下文'));
          return;
        }
        ctx.drawImage(img, 0, 0);

        // 转换为WebP格式
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片转换失败'));
              return;
            }

            // 创建新的File对象
            const webpFileName = `${file.name.split('.')[0]}.webp`;
            const webpFile = new File([blob], webpFileName, { type: 'image/webp' });
            resolve(webpFile);
          },
          'image/webp',
          quality / 100
        );
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };
  });
};

/**
 * 检查浏览器是否支持WebP格式
 * @returns boolean 是否支持WebP
 */
export const isWebPSupported = (): boolean => {
  // 检查是否在浏览器环境中
  if (typeof window === 'undefined') {
    return true; // 服务器端默认支持
  }

  // 检查Canvas是否支持WebP转换
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

/**
 * 获取图片尺寸信息
 * @param file 图片文件
 * @returns Promise<{ width: number; height: number }> 图片尺寸
 */
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        reject(new Error('无法获取图片尺寸'));
      };
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };
  });
};