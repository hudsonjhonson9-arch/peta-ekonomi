/*!
 * Pemindai tepi dokumen berbasis OpenCV.js (versi browser, modul ESM).
 *
 * Disalin dan disesuaikan dari jscanify v1.4.x
 * https://github.com/puffinsoft/jscanify
 * (c) 2023 ColonelParrot and other contributors | MIT License
 *
 * Alasan disalin: paket npm "jscanify" membawa dependensi "canvas" dan "jsdom"
 * (untuk versi Node) yang butuh kompilasi native dan membuat `npm install`
 * gagal di image Docker node:alpine. Versi browser hanya butuh file ini plus
 * OpenCV.js yang dimuat sebagai global `window.cv`.
 *
 * Perubahan dari aslinya:
 * - objek hasil contours.get(i) kini dilepas (delete) agar memori WebAssembly
 *   tidak terus bertambah selama kamera terbuka;
 * - bila hasil jauh lebih kecil dari kertas di sumber, sumber diperkecil dulu
 *   dengan INTER_AREA sebelum warpPerspective supaya teks tidak buram karena
 *   undersampling (warp INTER_LINEAR melewatkan piksel saat mengecil).
 *
 * MIT License
 *
 * Copyright (c) 2023 ColonelParrot
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

function distance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export default class Jscanify {
  /**
   * Mencari kontur kertas terbesar di dalam gambar.
   * @param {*} img cv.Mat
   * @returns kontur terbesar (panggil .delete() setelah dipakai), atau null
   */
  findPaperContour(img) {
    const cv = window.cv;
    const imgGray = new cv.Mat();
    cv.Canny(img, imgGray, 50, 200);

    const imgBlur = new cv.Mat();
    cv.GaussianBlur(imgGray, imgBlur, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);

    const imgThresh = new cv.Mat();
    cv.threshold(imgBlur, imgThresh, 0, 255, cv.THRESH_OTSU);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    cv.findContours(imgThresh, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let maxContourIndex = -1;
    for (let i = 0; i < contours.size(); ++i) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      contour.delete();
      if (area > maxArea) {
        maxArea = area;
        maxContourIndex = i;
      }
    }

    const maxContour = maxContourIndex >= 0 ? contours.get(maxContourIndex) : null;

    imgGray.delete();
    imgBlur.delete();
    imgThresh.delete();
    contours.delete();
    hierarchy.delete();
    return maxContour;
  }

  /**
   * Meluruskan perspektif kertas di dalam gambar.
   * @param {*} image canvas / img / video yang bisa dibaca cv.imread
   * @param {*} resultWidth lebar hasil
   * @param {*} resultHeight tinggi hasil
   * @param {*} cornerPoints opsional: titik sudut yang sudah diketahui
   *            ({ topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner })
   * @returns HTMLCanvasElement, atau null bila kertas tidak ditemukan
   */
  extractPaper(image, resultWidth, resultHeight, cornerPoints) {
    const cv = window.cv;
    const canvas = document.createElement("canvas");
    const img = cv.imread(image);
    const maxContour = cornerPoints ? null : this.findPaperContour(img);

    if (!cornerPoints && maxContour == null) {
      img.delete();
      return null;
    }

    const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } =
      cornerPoints || this.getCornerPoints(maxContour, img);

    if (!topLeftCorner || !topRightCorner || !bottomLeftCorner || !bottomRightCorner) {
      img.delete();
      if (maxContour) maxContour.delete();
      return null;
    }

    // Hasil biasanya jauh lebih kecil dari kertas di frame penuh (mis. 4K → 1654px).
    // WarpPerspective INTER_LINEAR langsung ke ukuran kecil melewatkan piksel
    // (undersampling) sehingga teks jadi lembut. Perkecil sumber dulu dengan
    // INTER_AREA (rata-rata piksel = anti-alias benar), baru warp mendekati 1:1.
    let src = img;
    let tl = { x: topLeftCorner.x, y: topLeftCorner.y };
    let tr = { x: topRightCorner.x, y: topRightCorner.y };
    let bl = { x: bottomLeftCorner.x, y: bottomLeftCorner.y };
    let br = { x: bottomRightCorner.x, y: bottomRightCorner.y };
    const lebarSumber =
      (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2;
    const faktor = resultWidth > 0 ? lebarSumber / resultWidth : 1;
    let kecil = null;
    if (faktor > 1.15) {
      const skala = 1 / faktor;
      kecil = new cv.Mat();
      cv.resize(
        img,
        kecil,
        new cv.Size(Math.max(1, Math.round(img.cols * skala)), Math.max(1, Math.round(img.rows * skala))),
        0,
        0,
        cv.INTER_AREA
      );
      src = kecil;
      const perkecil = (p) => ({ x: p.x * skala, y: p.y * skala });
      tl = perkecil(tl);
      tr = perkecil(tr);
      bl = perkecil(bl);
      br = perkecil(br);
    }

    const warpedDst = new cv.Mat();
    const dsize = new cv.Size(resultWidth, resultHeight);
    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x, tl.y,
      tr.x, tr.y,
      bl.x, bl.y,
      br.x, br.y,
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      resultWidth, 0,
      0, resultHeight,
      resultWidth, resultHeight,
    ]);

    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(src, warpedDst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    cv.imshow(canvas, warpedDst);

    if (kecil) kecil.delete();
    img.delete();
    warpedDst.delete();
    srcTri.delete();
    dstTri.delete();
    M.delete();
    if (maxContour) maxContour.delete();
    return canvas;
  }

  /**
   * Menghitung empat titik sudut dari sebuah kontur.
   * @param {*} contour hasil findPaperContour
   * @returns { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner }, masing-masing { x, y }
   */
  getCornerPoints(contour) {
    const cv = window.cv;
    const rect = cv.minAreaRect(contour);
    const center = rect.center;

    let topLeftCorner;
    let topLeftCornerDist = 0;
    let topRightCorner;
    let topRightCornerDist = 0;
    let bottomLeftCorner;
    let bottomLeftCornerDist = 0;
    let bottomRightCorner;
    let bottomRightCornerDist = 0;

    for (let i = 0; i < contour.data32S.length; i += 2) {
      const point = { x: contour.data32S[i], y: contour.data32S[i + 1] };
      const dist = distance(point, center);
      if (point.x < center.x && point.y < center.y) {
        if (dist > topLeftCornerDist) {
          topLeftCorner = point;
          topLeftCornerDist = dist;
        }
      } else if (point.x > center.x && point.y < center.y) {
        if (dist > topRightCornerDist) {
          topRightCorner = point;
          topRightCornerDist = dist;
        }
      } else if (point.x < center.x && point.y > center.y) {
        if (dist > bottomLeftCornerDist) {
          bottomLeftCorner = point;
          bottomLeftCornerDist = dist;
        }
      } else if (point.x > center.x && point.y > center.y) {
        if (dist > bottomRightCornerDist) {
          bottomRightCorner = point;
          bottomRightCornerDist = dist;
        }
      }
    }

    return { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner };
  }
}