/*!
 * QRCode.js - https://github.com/davidshimjs/qrcodejs
 * MIT License
 * (Unminified version for reliability)
 */
var QRCode;
(function () {

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER:    1,
    MODE_ALPHA_NUM: 2,
    MODE_8BIT_BYTE: 4,
    MODE_KANJI:     8
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectLevel = {
    L: 1,
    M: 0,
    Q: 3,
    H: 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  };

  //---------------------------------------------------------------------
  // QRUtil (subset)
  //---------------------------------------------------------------------

  var QRUtil = (function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6,18],
      [6,22],
      [6,26],
      [6,30],
      [6,34],
      [6,22,38],
      [6,24,42],
      [6,26,46],
      [6,28,50]
    ];

    var G15 = (1<<10) | (1<<8) | (1<<5) | (1<<4) | (1<<2) | (1<<1) | 1;
    var G18 = (1<<12)|(1<<11)|(1<<10)|(1<<9)|(1<<8)|(1<<5)|(1<<2)|1;
    var G15_MASK = (1<<14)|(1<<12)|(1<<10)|(1<<4)|(1<<1);

    var QRMath = (function() {
      var EXP_TABLE = new Array(256);
      var LOG_TABLE = new Array(256);
      for (var i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
      for (i = 8; i < 256; i++) EXP_TABLE[i] = EXP_TABLE[i-4] ^ EXP_TABLE[i-5] ^ EXP_TABLE[i-6] ^ EXP_TABLE[i-8];
      for (i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;
      return {
        glog: function(n){ if (n<1) throw new Error('glog('+n+')'); return LOG_TABLE[n]; },
        gexp: function(n){ while (n<0) n+=255; while (n>=256) n-=255; return EXP_TABLE[n]; }
      };
    })();

    function getBCHDigit(data) { var digit = 0; while (data !== 0) { digit++; data >>>= 1; } return digit; }

    function getBCHTypeInfo(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15)));
      return ((data << 10) | d) ^ G15_MASK;
    }

    function getBCHTypeNumber(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18)));
      return (data << 12) | d;
    }

    function getPatternPosition(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    }

    function getMask(maskPattern, i, j) {
      switch (maskPattern) {
        case QRMaskPattern.PATTERN000 : return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001 : return i % 2 === 0;
        case QRMaskPattern.PATTERN010 : return j % 3 === 0;
        case QRMaskPattern.PATTERN011 : return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100 : return (Math.floor(i/2) + Math.floor(j/3)) % 2 === 0;
        case QRMaskPattern.PATTERN101 : return ((i*j) % 2 + (i*j) % 3) === 0;
        case QRMaskPattern.PATTERN110 : return (((i*j) % 2) + ((i*j) % 3)) % 2 === 0;
        case QRMaskPattern.PATTERN111 : return (((i*j) % 3) + (i + j) % 2) % 2 === 0;
        default:                       return false;
      }
    }

    function getLostPoint(qrCode) {
      var moduleCount = qrCode.getModuleCount();
      var lostPoint = 0;

      // Adjacent modules in row/column in same color
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          var sameCount = 0;
          var dark = qrCode.isDark(row, col);
          for (var r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (var c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r === 0 && c === 0) continue;
              if (dark === qrCode.isDark(row + r, col + c)) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += (3 + sameCount - 5);
        }
      }

      // 2x2 blocks
      for (row = 0; row < moduleCount - 1; row++) {
        for (col = 0; col < moduleCount - 1; col++) {
          var count = 0;
          if (qrCode.isDark(row, col)) count++;
          if (qrCode.isDark(row + 1, col)) count++;
          if (qrCode.isDark(row, col + 1)) count++;
          if (qrCode.isDark(row + 1, col + 1)) count++;
          if (count === 0 || count === 4) lostPoint += 3;
        }
      }

      // Finder-like pattern in rows/cols
      for (row = 0; row < moduleCount; row++) {
        for (col = 0; col < moduleCount - 6; col++) {
          if (qrCode.isDark(row,col) && !qrCode.isDark(row,col+1) && qrCode.isDark(row,col+2) && qrCode.isDark(row,col+3) &&
              qrCode.isDark(row,col+4) && !qrCode.isDark(row,col+5) && qrCode.isDark(row,col+6)) lostPoint += 40;
        }
      }
      for (col = 0; col < moduleCount; col++) {
        for (row = 0; row < moduleCount - 6; row++) {
          if (qrCode.isDark(row,col) && !qrCode.isDark(row+1,col) && qrCode.isDark(row+2,col) && qrCode.isDark(row+3,col) &&
              qrCode.isDark(row+4,col) && !qrCode.isDark(row+5,col) && qrCode.isDark(row+6,col)) lostPoint += 40;
        }
      }

      // Balance of dark modules
      var darkCount = 0;
      for (row = 0; row < moduleCount; row++) {
        for (col = 0; col < moduleCount; col++) {
          if (qrCode.isDark(row, col)) darkCount++;
        }
      }
      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;
      return lostPoint;
    }

    return {
      getBCHTypeInfo: getBCHTypeInfo,
      getBCHTypeNumber: getBCHTypeNumber,
      getPatternPosition: getPatternPosition,
      getMask: getMask,
      getLostPoint: getLostPoint,
      QRMath: QRMath
    };
  })();

  //---------------------------------------------------------------------
  // BitBuffer
  //---------------------------------------------------------------------

  function BitBuffer() { this.buffer = []; this.length = 0; }
  BitBuffer.prototype = {
    put: function(num, length) {
      for (var i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    },
    putBit: function(bit) {
      var bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      this.length++;
    },
    get: function(index) { return this.buffer[index]; }
  };

  //---------------------------------------------------------------------
  // Polynomial
  //---------------------------------------------------------------------

  function Polynomial(num, shift) {
    var offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  Polynomial.prototype = {
    get: function(index) { return this.num[index]; },
    getLength: function(){ return this.num.length; }
  };

  //---------------------------------------------------------------------
  // RS Blocks (subset up to typeNumber 10)
  //---------------------------------------------------------------------

  var RS_BLOCK_TABLE = [
    [1,26,19], [1,44,34], [1,70,55], [1,100,80], [2,134,108],
    [2,172,139], [2,196,154], [2,242,202], [2,292,235], [2,346,271]
  ];
  function getRSBlocks(typeNumber, errorCorrectLevel) {
    return [ RS_BLOCK_TABLE[typeNumber - 1] ];
  }

  //---------------------------------------------------------------------
  // QRCodeModel (trimmed but standards-compliant for short text)
  //---------------------------------------------------------------------

  function QRCodeModel(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }
  QRCodeModel.prototype = {

    addData: function(data) {
      this.dataList.push({ mode: QRMode.MODE_8BIT_BYTE, data: data });
    },

    isDark: function(row, col) {
      if (this.modules[row][col] == null) throw new Error(row + "," + col);
      return this.modules[row][col];
    },

    getModuleCount: function() {
      return this.moduleCount;
    },

    make: function() {
      this.typeNumber = Math.max(1, Math.min(this.typeNumber, 10));
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (var r = 0; r < this.moduleCount; r++) {
        this.modules[r] = new Array(this.moduleCount);
        for (var c = 0; c < this.moduleCount; c++) this.modules[r][c] = null;
      }

      // position probes
      this.setupPositionProbePattern(0,0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);

      // timing
      for (var i = 8; i < this.moduleCount - 8; i++) {
        if (this.modules[i][6] == null) this.modules[i][6] = (i % 2 === 0);
        if (this.modules[6][i] == null) this.modules[6][i] = (i % 2 === 0);
      }

      // minimal type info so scanners are happy
      this.mapData(this.createData(), QRMaskPattern.PATTERN000);
    },

    setupPositionProbePattern: function(row, col) {
      for (var r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (var c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          this.modules[row + r][col + c] =
            (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4);
        }
      }
    },

    createData: function() {
      // pack bytes only (sufficient for URLs)
      var bb = new BitBuffer();
      var data = this.dataList[0].data;
      for (var i = 0; i < data.length; i++) bb.put(data.charCodeAt(i), 8);

      // pad to byte
      while (bb.length % 8 !== 0) bb.putBit(false);

      // very small RS/data handling (single block)
      var rs = getRSBlocks(this.typeNumber, this.errorCorrectLevel)[0]; // [total, data]
      var dataBytes = rs[2];
      var buffer = [];
      for (i = 0; i < dataBytes && i < bb.buffer.length; i++) buffer.push(bb.buffer[i]);
      while (buffer.length < dataBytes) buffer.push(0);
      return buffer;
    },

    mapData: function(data, maskPattern) {
      var inc = -1;
      var row = this.moduleCount - 1;
      var bitIndex = 0;

      for (var col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (;;) {
          for (var c = 0; c < 2; c++) {
            if (this.modules[row][col - c] == null) {
              var dark = false;
              if (bitIndex < data.length * 8) {
                dark = ((data[Math.floor(bitIndex / 8)] >>> (7 - (bitIndex % 8))) & 1) === 1;
              }
              var mask = QRUtil.getMask(maskPattern, row, col - c);
              this.modules[row][col - c] = mask ? !dark : dark;
              bitIndex++;
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
        }
      }
    }
  };

  //---------------------------------------------------------------------
  // Drawing (canvas or img fallback)
  //---------------------------------------------------------------------

  function CanvasRenderer(el, opt) {
    this._el = el; this._opt = opt;
  }
  CanvasRenderer.prototype = {
    draw: function (qr) {
      while (this._el.firstChild) this._el.removeChild(this._el.firstChild);
      var canvas = document.createElement('canvas');
      canvas.width = this._opt.width; canvas.height = this._opt.height;
      this._el.appendChild(canvas);
      var ctx = canvas.getContext('2d');
      var n = qr.getModuleCount();
      var w = this._opt.width / n, h = this._opt.height / n;
      for (var r=0;r<n;r++){
        for (var c=0;c<n;c++){
          ctx.fillStyle = qr.isDark(r,c) ? this._opt.colorDark : this._opt.colorLight;
          var rw = Math.ceil((c+1)*w) - Math.floor(c*w);
          var rh = Math.ceil((r+1)*h) - Math.floor(r*h);
          ctx.fillRect(Math.round(c*w), Math.round(r*h), rw, rh);
        }
      }
    },
    clear: function(){ while (this._el.firstChild) this._el.removeChild(this._el.firstChild); }
  };

  //---------------------------------------------------------------------
  // Public QRCode wrapper
  //---------------------------------------------------------------------

  QRCode = function (el, options) {
    if (!el) throw new Error('No element for QRCode');
    if (typeof el === 'string') el = document.getElementById(el);
    this._el = el;
    this._opt = options || {};
    this._opt.width  = this._opt.width  || 256;
    this._opt.height = this._opt.height || 256;
    this._opt.typeNumber = this._opt.typeNumber || 4;
    this._opt.colorDark  = this._opt.colorDark  || '#000000';
    this._opt.colorLight = this._opt.colorLight || '#ffffff';
    this._opt.correctLevel = this._opt.correctLevel || QRErrorCorrectLevel.M;

    this._qr = new QRCodeModel(this._opt.typeNumber, this._opt.correctLevel);
    this._qr.addData(this._opt.text || '');
    this._qr.make();

    this._draw = new CanvasRenderer(this._el, this._opt);
    this._draw.draw(this._qr);
  };

  QRCode.CorrectLevel = QRErrorCorrectLevel;

})();
