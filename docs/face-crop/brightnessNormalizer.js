export class BrightnessNormalizer {
  constructor() {
    this.images = [];
  }
  
  addImage(imageData) {
    this.images.push(imageData);
  }
  
  clear() {
    this.images = [];
  }
  
  normalize() {
    if (this.images.length === 0) {
      throw new Error('No images to normalize');
    }
    
    const hsvImages = this.images.map(img => this.rgbToHsv(img));
    const skinStats = hsvImages.map(hsv => this.analyzeSkinRegion(hsv));
    
    const validStats = skinStats.filter(stat => stat !== null);
    if (validStats.length === 0) {
      throw new Error('No valid skin regions detected');
    }
    
    const targetBrightness = validStats.reduce((sum, stat) => sum + stat.avgV, 0) / validStats.length;
    const targetSaturation = validStats.reduce((sum, stat) => sum + stat.avgS, 0) / validStats.length;
    
    const normalizedImages = hsvImages.map((hsv, i) => {
      const stat = skinStats[i];
      if (!stat) {
        return this.hsvToRgb(hsv);
      }
      
      const vScale = targetBrightness / stat.avgV;
      const sScale = targetSaturation / stat.avgS;
      
      return this.applyScaling(hsv, vScale, sScale);
    });
    
    return {
      normalizedImages,
      targetBrightness,
      targetSaturation
    };
  }
  
  rgbToHsv(imageData) {
    const data = imageData.data;
    const h = [];
    const s = [];
    const v = [];
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const diff = max - min;
      
      let hue = 0;
      if (diff !== 0) {
        if (max === r) {
          hue = ((g - b) / diff + (g < b ? 6 : 0)) * 60;
        } else if (max === g) {
          hue = ((b - r) / diff + 2) * 60;
        } else {
          hue = ((r - g) / diff + 4) * 60;
        }
      }
      
      const saturation = max === 0 ? 0 : (diff / max) * 255;
      const value = max * 255;
      
      h.push(hue);
      s.push(saturation);
      v.push(value);
    }
    
    return { h, s, v, width: imageData.width, height: imageData.height };
  }
  
  hsvToRgb(hsv) {
    const imageData = new ImageData(hsv.width, hsv.height);
    const data = imageData.data;
    
    for (let i = 0; i < hsv.h.length; i++) {
      const h = hsv.h[i] / 60;
      const s = hsv.s[i] / 255;
      const v = hsv.v[i] / 255;
      
      const c = v * s;
      const x = c * (1 - Math.abs((h % 2) - 1));
      const m = v - c;
      
      let r = 0, g = 0, b = 0;
      
      if (h >= 0 && h < 1) {
        r = c; g = x; b = 0;
      } else if (h >= 1 && h < 2) {
        r = x; g = c; b = 0;
      } else if (h >= 2 && h < 3) {
        r = 0; g = c; b = x;
      } else if (h >= 3 && h < 4) {
        r = 0; g = x; b = c;
      } else if (h >= 4 && h < 5) {
        r = x; g = 0; b = c;
      } else {
        r = c; g = 0; b = x;
      }
      
      const idx = i * 4;
      data[idx] = Math.round((r + m) * 255);
      data[idx + 1] = Math.round((g + m) * 255);
      data[idx + 2] = Math.round((b + m) * 255);
      data[idx + 3] = 255;
    }
    
    return imageData;
  }
  
  analyzeSkinRegion(hsv) {
    const skinPixels = [];
    
    for (let i = 0; i < hsv.h.length; i++) {
      const h = hsv.h[i];
      const s = hsv.s[i];
      const v = hsv.v[i];
      
      const isSkin = (h < 35 || h > 200) && s > 40 && v > 50;
      
      if (isSkin) {
        skinPixels.push({ v, s });
      }
    }
    
    if (skinPixels.length < hsv.h.length * 0.05) {
      const allPixels = [];
      for (let i = 0; i < hsv.h.length; i++) {
        allPixels.push({ v: hsv.v[i], s: hsv.s[i] });
      }
      return this.calculateAverage(allPixels);
    }
    
    return this.calculateAverage(skinPixels);
  }
  
  calculateAverage(pixels) {
    const sumV = pixels.reduce((sum, p) => sum + p.v, 0);
    const sumS = pixels.reduce((sum, p) => sum + p.s, 0);
    
    return {
      avgV: sumV / pixels.length,
      avgS: sumS / pixels.length
    };
  }
  
  applyScaling(hsv, vScale, sScale) {
    const scaled = {
      h: hsv.h,
      s: hsv.s.map(s => Math.min(255, Math.max(0, s * sScale))),
      v: hsv.v.map(v => Math.min(255, Math.max(0, v * vScale))),
      width: hsv.width,
      height: hsv.height
    };
    
    return this.hsvToRgb(scaled);
  }
}