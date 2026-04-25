/**
 * pdf-parse v2 依賴 pdfjs-dist，模組初始化會用到瀏覽器 Canvas/DOM 型別（DOMMatrix 等）。
 * 在 Node 環境先補上最小實作，再 import pdf-parse，避免啟動即 ReferenceError。
 */
if (globalThis.DOMMatrix === undefined) {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class DOMMatrix {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0
    m11 = 1
    m12 = 0
    m21 = 0
    m22 = 1
    m41 = 0
    m42 = 0
    is2D = true
    isIdentity = true
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor() {
      /* pdf 文字抽取僅在載入階段 new DOMMatrix()，不需完整矩陣運算 */
    }
    static fromFloat32Array() {
      return new DOMMatrix() as unknown as globalThis.DOMMatrix
    }
    static fromFloat64Array() {
      return new DOMMatrix() as unknown as globalThis.DOMMatrix
    }
    static fromMatrix() {
      return new DOMMatrix() as unknown as globalThis.DOMMatrix
    }
    multiply() {
      return new DOMMatrix() as unknown as globalThis.DOMMatrix
    }
    preMultiply() {
      return this as unknown as globalThis.DOMMatrix
    }
    translate() {
      return this as unknown as globalThis.DOMMatrix
    }
    scale() {
      return this as unknown as globalThis.DOMMatrix
    }
    rotate() {
      return this as unknown as globalThis.DOMMatrix
    }
    invert() {
      return this as unknown as globalThis.DOMMatrix
    }
  }
  globalThis.DOMMatrix = DOMMatrix as unknown as typeof globalThis.DOMMatrix
}

if (globalThis.Path2D === undefined) {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class Path2D {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(_path?: globalThis.Path2D | string) {
      void _path
    }
  }
  globalThis.Path2D = Path2D as unknown as typeof globalThis.Path2D
}

if (globalThis.ImageData === undefined) {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class ImageData {
    data: Uint8ClampedArray
    width: number
    height: number
    constructor(sw: number, sh: number) {
      this.width = sw
      this.height = sh
      this.data = new Uint8ClampedArray(sw * sh * 4)
    }
  }
  globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData
}
