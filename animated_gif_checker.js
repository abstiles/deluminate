onmessage = function(e) {
  var id = e.data.id;
  var src = e.data.src;
  isAnimatedGif(src).then((result) => {
    postMessage(
      { 'id': id
      , 'result': result
      });
  });
}

async function isAnimatedGif(src) {
  if (src.indexOf('data:') == 0) {
    return;
  }
  const response = await fetch(src);
  const arrayBuffer = await response.arrayBuffer();
  const arr = new Uint8Array(arrayBuffer);

  // make sure it's a gif (GIF8)
  if (arr[0] !== 0x47 || arr[1] !== 0x49 ||
      arr[2] !== 0x46 || arr[3] !== 0x38) {
    return false;
  }

  //ported from php http://www.php.net/manual/en/function.imagecreatefromgif.php#104473
  //an animated gif contains multiple "frames", with each frame having a
  //header made up of:
  // * a static 4-byte sequence (\x00\x21\xF9\x04)
  // * 4 variable bytes
  // * a static 2-byte sequence (\x00\x2C) (some variants may use \x00\x21 ?)
  // We read through the file til we reach the end of the file, or we've found
  // at least 2 frame headers
  let frames = 0;
  const length = arr.length;
  for (let i=0; i < length - 9; ++i) {
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
  return frames > 1;
}
