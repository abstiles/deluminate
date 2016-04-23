onmessage = function(e) {
  var id = e.data.id;
  var src = e.data.src;
  isAnimatedGif(src, function(result) {
    postMessage(
      { 'id': id
      , 'result': result
      });
  });
}

function isAnimatedGif(src, cb) {
  var request = new XMLHttpRequest();
  if (src.indexOf('data:') == 0) {
    return;
  }
  request.open('GET', src, true);
  request.responseType = 'arraybuffer';
  request.addEventListener('load', function () {
    var arr = new Uint8Array(request.response),
      i, len, length = arr.length, frames = 0;

    // make sure it's a gif (GIF8)
    if (arr[0] !== 0x47 || arr[1] !== 0x49 ||
        arr[2] !== 0x46 || arr[3] !== 0x38) {
      cb(false);
      return;
    }

    //ported from php http://www.php.net/manual/en/function.imagecreatefromgif.php#104473
    //an animated gif contains multiple "frames", with each frame having a
    //header made up of:
    // * a static 4-byte sequence (\x00\x21\xF9\x04)
    // * 4 variable bytes
    // * a static 2-byte sequence (\x00\x2C) (some variants may use \x00\x21 ?)
    // We read through the file til we reach the end of the file, or we've found
    // at least 2 frame headers
    for (i=0, len = length - 9; i < len; ++i) {
      if (arr[i] === 0x00 && arr[i+1] === 0x21 &&
          arr[i+2] === 0xF9 && arr[i+3] === 0x04 &&
          arr[i+8] === 0x00 &&
          (arr[i+9] === 0x2C || arr[i+9] === 0x21))
      {
        frames++;
      }
      if (frames > 1) {
        break;
      }
    }

    // if frame count > 1, it's animated
    cb(frames > 1);
  });
  request.send();
}
