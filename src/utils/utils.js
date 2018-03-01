Potree.utils = class {
  static createBackgroundTexture(width, height) {
    function gauss(x, y) {
      return 1 / (2 * Math.PI) * Math.exp(-(x * x + y * y) / 2);
    }

    // map.magFilter = THREE.NearestFilter;
    let size = width * height;
    let data = new Uint8Array(3 * size);

    let chroma = [1, 1.5, 1.7];
    let max = gauss(0, 0);

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let u = 2 * (x / width) - 1;
        let v = 2 * (y / height) - 1;

        let i = x + width * y;
        let d = gauss(2 * u, 2 * v) / max;
        let r = (Math.random() + Math.random() + Math.random()) / 3;
        r = (d * 0.5 + 0.5) * r * 0.03;
        r = r * 0.4;

        // d = Math.pow(d, 0.6);

        data[3 * i + 0] = 255 * (d / 15 + 0.05 + r) * chroma[0];
        data[3 * i + 1] = 255 * (d / 15 + 0.05 + r) * chroma[1];
        data[3 * i + 2] = 255 * (d / 15 + 0.05 + r) * chroma[2];
      }
    }

    let texture = new THREE.DataTexture(data, width, height, THREE.RGBFormat);
    texture.needsUpdate = true;

    return texture;
  }

  static getMousePointCloudIntersection(mouse, camera, viewer, pointclouds, params = {}) {
    let renderer = viewer.renderer;

    let nmouse = {
      x: mouse.x / renderer.domElement.clientWidth * 2 - 1,
      y: -(mouse.y / renderer.domElement.clientHeight) * 2 + 1,
    };

    let pickParams = {};

    if (params.pickClipped) {
      pickParams.pickClipped = params.pickClipped;
    }

    pickParams.x = mouse.x;
    pickParams.y = renderer.domElement.clientHeight - mouse.y;

    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(nmouse, camera);
    let ray = raycaster.ray;

    let selectedPointcloud = null;
    let closestDistance = Infinity;
    let closestIntersection = null;
    let closestPoint = null;

    for (let pointcloud of pointclouds) {
      let point = pointcloud.pick(viewer, camera, ray, pickParams);

      if (!point) {
        continue;
      }

      let distance = camera.position.distanceTo(point.position);

      if (distance < closestDistance) {
        closestDistance = distance;
        selectedPointcloud = pointcloud;
        closestIntersection = point.position;
        closestPoint = point;
      }
    }

    if (selectedPointcloud) {
      return {
        location: closestIntersection,
        distance: closestDistance,
        pointcloud: selectedPointcloud,
        point: closestPoint,
      };
    } else {
      return null;
    }
  }

  static pixelsArrayToImage(pixels, width, height) {
    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    let context = canvas.getContext('2d');

    pixels = new pixels.constructor(pixels);

    for (let i = 0; i < pixels.length; i++) {
      pixels[i * 4 + 3] = 255;
    }

    let imageData = context.createImageData(width, height);
    imageData.data.set(pixels);
    context.putImageData(imageData, 0, 0);

    let img = new Image();
    img.src = canvas.toDataURL();
    // img.style.transform = "scaleY(-1)";

    return img;
  }

  static pixelsArrayToDataUrl(pixels, width, height) {
    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    let context = canvas.getContext('2d');

    pixels = new pixels.constructor(pixels);

    for (let i = 0; i < pixels.length; i++) {
      pixels[i * 4 + 3] = 255;
    }

    let imageData = context.createImageData(width, height);
    imageData.data.set(pixels);
    context.putImageData(imageData, 0, 0);

    let dataURL = canvas.toDataURL();

    return dataURL;
  }

  static pixelsArrayToCanvas(pixels, width, height) {
    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    let context = canvas.getContext('2d');

    pixels = new pixels.constructor(pixels);

    //for (let i = 0; i < pixels.length; i++) {
    //	pixels[i * 4 + 3] = 255;
    //}

    // flip vertically
    let bytesPerLine = width * 4;
    for (let i = 0; i < parseInt(height / 2); i++) {
      let j = height - i - 1;

      let lineI = pixels.slice(i * bytesPerLine, i * bytesPerLine + bytesPerLine);
      let lineJ = pixels.slice(j * bytesPerLine, j * bytesPerLine + bytesPerLine);
      pixels.set(lineJ, i * bytesPerLine);
      pixels.set(lineI, j * bytesPerLine);
    }

    let imageData = context.createImageData(width, height);
    imageData.data.set(pixels);
    context.putImageData(imageData, 0, 0);

    return canvas;
  }

  static removeListeners(dispatcher, type) {
    if (dispatcher._listeners === undefined) {
      return;
    }

    if (dispatcher._listeners[type]) {
      delete dispatcher._listeners[type];
    }
  }

  static mouseToRay(mouse, camera, width, height) {
    let normalizedMouse = {
      x: mouse.x / width * 2 - 1,
      y: -(mouse.y / height) * 2 + 1,
    };

    let vector = new THREE.Vector3(normalizedMouse.x, normalizedMouse.y, 0.5);
    let origin = new THREE.Vector3(normalizedMouse.x, normalizedMouse.y, 0);
    vector.unproject(camera);
    origin.unproject(camera);
    let direction = new THREE.Vector3().subVectors(vector, origin).normalize();

    let ray = new THREE.Ray(origin, direction);

    return ray;
  }

  static projectedRadius(radius, camera, distance, screenWidth, screenHeight) {
    if (camera instanceof THREE.OrthographicCamera) {
      return Potree.utils.projectedRadiusOrtho(
        radius,
        camera.projectionMatrix,
        screenWidth,
        screenHeight,
      );
    } else if (camera instanceof THREE.PerspectiveCamera) {
      return Potree.utils.projectedRadiusPerspective(
        radius,
        camera.fov * Math.PI / 180,
        distance,
        screenHeight,
      );
    } else {
      throw new Error('invalid parameters');
    }
  }

  static projectedRadiusPerspective(radius, fov, distance, screenHeight) {
    let projFactor = 1 / Math.tan(fov / 2) / distance;
    projFactor = projFactor * screenHeight / 2;

    return radius * projFactor;
  }

  static projectedRadiusOrtho(radius, proj, screenWidth, screenHeight) {
    let p1 = new THREE.Vector4(0);
    let p2 = new THREE.Vector4(radius);

    p1.applyMatrix4(proj);
    p2.applyMatrix4(proj);
    p1 = new THREE.Vector3(p1.x, p1.y, p1.z);
    p2 = new THREE.Vector3(p2.x, p2.y, p2.z);
    p1.x = (p1.x + 1.0) * 0.5 * screenWidth;
    p1.y = (p1.y + 1.0) * 0.5 * screenHeight;
    p2.x = (p2.x + 1.0) * 0.5 * screenWidth;
    p2.y = (p2.y + 1.0) * 0.5 * screenHeight;
    return p1.distanceTo(p2);
  }

  static topView(camera, node) {
    camera.position.set(0, 1, 0);
    camera.rotation.set(-Math.PI / 2, 0, 0);
    camera.zoomTo(node, 1);
  }

  static frontView(camera, node) {
    camera.position.set(0, 0, 1);
    camera.rotation.set(0, 0, 0);
    camera.zoomTo(node, 1);
  }

  static leftView(camera, node) {
    camera.position.set(-1, 0, 0);
    camera.rotation.set(0, -Math.PI / 2, 0);
    camera.zoomTo(node, 1);
  }

  static rightView(camera, node) {
    camera.position.set(1, 0, 0);
    camera.rotation.set(0, Math.PI / 2, 0);
    camera.zoomTo(node, 1);
  }

  /**
   *
   * 0: no intersection
   * 1: intersection
   * 2: fully inside
   */
  static frustumSphereIntersection(frustum, sphere) {
    let planes = frustum.planes;
    let center = sphere.center;
    let negRadius = -sphere.radius;

    let minDistance = Number.MAX_VALUE;

    for (let i = 0; i < 6; i++) {
      let distance = planes[i].distanceToPoint(center);

      if (distance < negRadius) {
        return 0;
      }

      minDistance = Math.min(minDistance, distance);
    }

    return minDistance >= sphere.radius ? 2 : 1;
  }

  // code taken from three.js
  // ImageUtils - generateDataTexture()
  static generateDataTexture(width, height, color) {
    let size = width * height;
    let data = new Uint8Array(4 * width * height);

    let r = Math.floor(color.r * 255);
    let g = Math.floor(color.g * 255);
    let b = Math.floor(color.b * 255);

    for (let i = 0; i < size; i++) {
      data[i * 3] = r;
      data[i * 3 + 1] = g;
      data[i * 3 + 2] = b;
    }

    let texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.needsUpdate = true;
    texture.magFilter = THREE.NearestFilter;

    return texture;
  }

  // from http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
  static getParameterByName(name) {
    name = name.replace(/[[]/, '\\[').replace(/[\]]/, '\\]');
    let regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    let results = regex.exec(document.location.search);
    return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }

  static setParameter(name, value) {
    // value = encodeURIComponent(value);

    name = name.replace(/[[]/, '\\[').replace(/[\]]/, '\\]');
    let regex = new RegExp('([\\?&])(' + name + '=([^&#]*))');
    let results = regex.exec(document.location.search);

    let url = window.location.href;
    if (results === null) {
      if (window.location.search.length === 0) {
        url = url + '?';
      } else {
        url = url + '&';
      }

      url = url + name + '=' + value;
    } else {
      let newValue = name + '=' + value;
      url = url.replace(results[2], newValue);
    }
    window.history.replaceState({}, '', url);
  }

  // see https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
  static clipboardCopy(text) {
    let textArea = document.createElement('textarea');

    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;

    textArea.style.width = '2em';
    textArea.style.height = '2em';

    textArea.style.padding = 0;

    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';

    textArea.style.background = 'transparent';

    textArea.value = text;

    document.body.appendChild(textArea);

    textArea.select();

    try {
      let success = document.execCommand('copy');
      if (success) {
        console.log('copied text to clipboard');
      } else {
        console.log('copy to clipboard failed');
      }
    } catch (err) {
      console.log('error while trying to copy to clipboard');
    }

    document.body.removeChild(textArea);
  }
};

Potree.utils.screenPass = new function() {
  this.screenScene = new THREE.Scene();
  this.screenQuad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2, 0));
  this.screenQuad.material.depthTest = true;
  this.screenQuad.material.depthWrite = true;
  this.screenQuad.material.transparent = true;
  this.screenScene.add(this.screenQuad);
  this.camera = new THREE.Camera();

  this.render = function(renderer, material, target) {
    this.screenQuad.material = material;

    if (typeof target === 'undefined') {
      renderer.render(this.screenScene, this.camera);
    } else {
      renderer.render(this.screenScene, this.camera, target);
    }
  };
}();