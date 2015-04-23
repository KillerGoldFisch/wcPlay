/**
 * @class
 * Provides a visual interface for editing a Play script. Requires HTML5 canvas.
 *
 * @constructor
 * @param {external:jQuery~Object|external:jQuery~Selector|external:domNode} container - The container element.
 * @param {wcPlayEditor~Options} [options] - Custom options.
 */
function wcPlayEditor(container, options) {
  this.$container = $(container);
  this.$viewport = null;
  this._viewportContext = null;
  this.$palette = null;
  this._paletteSize = 0.25;
  this.$typeButton = [];
  this.$typeArea = [];

  this._size = {x: 0, y: 0};

  this._engine = null;
  this._parent = null;
  this._nodeLibrary = {};

  this._font = {
    title: {size: 15, family: 'Arial', weight: 'bold'},
    titleDesc: {size: 15, family: 'Arial', weight: 'italic'},
    links: {size: 10, family: 'Arial'},
    property: {size: 10, family: 'Arial', weight: 'italic'},
    value: {size: 10, family: 'Arial', weight: 'bold'},
    initialValue: {size: 10, family: 'Arial', weight: 'bold italic'},
  };

  this._drawStyle = {
    palette: {
      spacing: 20,          // Spacing between nodes in the palette view.
    },
    node: {
      radius: 10,           // The radius to draw node corners.
      margin: 15,           // The pixel space between the property text and the edge of the node border.
    },
    title: {
      spacing: 5,           // The pixel space between the title text and the bar that separates the properties.
      wrapL: '  ',          // The left string to wrap around the title text.
      wrapR: '  ',          // The right string to wrap around the title text.
      placeholder: '  ',    // A placeholder label if there is no title name.
      nameWrapL: ' (',      // The left string to wrap around the name portion of the title text.
      nameWrapR: ') ',      // The right string to wrap around the name portion of the title text.
    },
    links: {
      length: 12,           // Length of each link 'nub'
      width: 8,             // Width of each link 'nub'
      spacing: 10,          // The pixel space between the text of adjacent links.
      padding: 5,           // The pixel space between the link and its text.
      margin: 10,           // The pixel space between the link text and the edge of the node border.
    },
    property: {
      spacing: 5,           // The pixel space between adjacent properties.
      strLen: 10,           // The maximum character length a property value can display.
      minLength: 30,        // The minimum length the property value can be.
      valueWrapL: ' ',      // The left string to wrap around a property value.
      valueWrapR: ' ',      // The right string to wrap around a property value.
      initialWrapL: ' [',   // The left string to wrap around a property initial value.
      initialWrapR: '] ',   // The right string to wrap around a property initial value.
    },
  };

  // Update properties.
  this._lastUpdate = 0;

  // Control properties.
  this._viewportCamera = {x: 0, y: 0, z: 1};
  this._viewportMovingNode = false;
  this._viewportMoving = false;
  this._viewportMoved = false;
  this._paletteMoving = false;

  this._mouse = {x: 0, y: 0};
  this._highlightRect = null;
  this._highlightNode = null;
  this._selectedNode = null;
  this._selectedNodes = [];
  this._expandedHighlightNode = null;
  this._expandedSelectedNode = null;

  this._highlightTitle = false;
  // this._highlightCollapser = false;
  this._highlightBreakpoint = false;
  this._highlightEntryLink = false;
  this._highlightExitLink = false;
  this._highlightInputLink = false;
  this._highlightOutputLink = false;
  this._highlightPropertyValue = false;
  this._highlightPropertyInitialValue = false;
  this._highlightViewport = false;

  this._selectedEntryLink = false;
  this._selectedExitLink = false;
  this._selectedInputLink = false;
  this._selectedOutputLink = false;
  this._selectedNodeOrigins = [];

  this._draggingNodeData = null;

  // Undo management is optional.
  this._undoManager = null;

  // Setup our options.
  this._options = {
    readOnly: false,
    category: {
      items: [],
      isBlacklist: true,
    },
  };
  for (var prop in options) {
    this._options[prop] = options[prop];
  }

  this.$top = $('<div class="wcPlayEditorTop">');
  this.$main = $('<div class="wcPlayEditorMain">');
  this.$palette = $('<div class="wcPlayPalette wcPlayNoHighlights">');
  this.$paletteScroller = $('<div class="wcPlayPaletteScroller">');
  this.$paletteInner = $('<div class="wcPlayPaletteInner">');
  this.$viewport = $('<canvas class="wcPlayViewport">');
  this._viewportContext = this.$viewport[0].getContext('2d');

  this.$palette.append(this.$paletteScroller);
  this.$paletteScroller.append(this.$paletteInner);

  this.$main.append(this.$palette);
  this.$main.append(this.$viewport);
  this.$container.append(this.$top);
  this.$container.append(this.$main);

  this.onResized();

  this.__setupMenu();
  this.__setupPalette();
  this.__setupControls();

  window.requestAnimationFrame(this.__update.bind(this));
}

wcPlayEditor.prototype = {
  /**
   * Gets, or Sets the {@link wcPlay} engine that this renderer will render.
   * @function wcPlayEditor#engine
   * @param {wcPlay} [engine] - If supplied, will assign a new {@link wcPlay} engine to render.
   * @returns {wcPlay} - The current {@link wcPlay} engine.
   */
  engine: function(engine) {
    if (engine !== undefined && engine !== this._engine) {
      if (this._engine) {
        var index = this._engine._editors.indexOf(this);
        if (index > -1) {
          this._engine._editors.splice(index, 1);
        }
        this._engine._undoManager = this._undoManager;
        this._undoManager = null;
      }

      this._engine = engine;
      this._parent = engine;

      if (this._engine) {
        this._engine._editors.push(this);
        this._undoManager = this._engine._undoManager;
        if (!this._undoManager && window.wcUndoManager) {
          this._undoManager = new wcUndoManager();
          this._engine._undoManager = this._undoManager;
        }
      }
    }

    return this._engine;
  },

  /**
   * Positions the canvas view to the center of all nodes.
   * @function wcPlayEditor#center
   */
  center: function() {
    if (this._parent) {
      this.focus(this._parent._entryNodes.concat(this._parent._processNodes, this._parent._storageNodes, this._parent._compositeNodes));
    }
  },

  /**
   * Scrolls the canvas view until a given set of nodes are within view.
   * @function wcPlayEditor#focus
   * @param {wcNode} nodes - A list of nodes to focus the view on.
   */
  focus: function(nodes) {
    if (nodes.length) {
      this.__updateNodes(nodes, 0);
      this.__drawNodes(nodes, this._viewportContext);
      var boundList = [];
      for (var i = 0; i < nodes.length; ++i) {
        boundList.push(nodes[i]._meta.bounds.farRect);
      }
      var focusRect = this.__expandRect(boundList)
      // Clamp the focus rect to a minimum size, so we can not zoom in too far.
      if (focusRect.width < 1000) {
        focusRect.left -= (1000 - focusRect.width)/2;
        focusRect.width = 1000;
      }
      this.focusRect(focusRect);
    }
  },

  /**
   * Scrolls the canvas view and centers on a given bounding rectangle.
   * @function wcPlayEditor#focusRect
   * @param {wcPlayEditor~Rect} rect - The rectangle to focus on.
   */
  focusRect: function(rect) {
    var scaleX = (this.$viewport.width() / rect.width);
    var scaleY = (this.$viewport.height() / rect.height);
    this._viewportCamera.z = Math.min(scaleX, scaleY);
    if (scaleX > scaleY) {
      rect.left -= ((this.$viewport.width() / scaleY - rect.width)) / 2;
    } else {
      rect.top -= ((this.$viewport.height() / scaleX - rect.height)) / 2;
    }
    this._viewportCamera.x = -rect.left * this._viewportCamera.z;
    this._viewportCamera.y = -rect.top * this._viewportCamera.z;
  },

  /**
   * Event that is called when the container view is resized.
   * @function wcPlayEditor#onResized
   */
  onResized: function() {
    var width = this.$main.width();
    var height= this.$main.height();

    if (this._size.x !== width || this._size.y !== height) {
      this._size.x = width;
      this._size.y = height;

      var w = width * this._paletteSize;
      this.$palette.css('width', w).attr('width', w).attr('height', height);
      this.$viewport.css('width', width - w).attr('width', width - w).attr('height', height);
    }
  },

  /**
   * Retrieve mouse or touch position.
   * @function wcPlayEditor#__mouse
   * @private
   * @param {Object} event - The mouse event.
   * @param {wcPlayEditor~Offset} [offset] - An optional screen offset to apply to the pos.
   * @param {wcPlay~Coordinates} [translation] - An optional camera translation to apply to the pos.
   * @return {wcPlay~Coordinates} - The mouse position.
   */
  __mouse: function(event, offset, translation) {
    if (event.originalEvent && (event.originalEvent.touches || event.originalEvent.changedTouches)) {
      var touch = event.originalEvent.touches[0] || event.originalEvent.changedTouches[0];
      return {
        x: touch.clientX - (offset? offset.left: 0) - (translation? translation.x: 0),
        y: touch.clientY - (offset? offset.top: 0) - (translation? translation.y: 0),
        gx: touch.clientX,
        gy: touch.clientY,
        which: 1,
      };
    }

    return {
      x: (event.clientX || event.pageX) - (offset? offset.left: 0) - (translation? translation.x: 0),
      y: (event.clientY || event.pageY) - (offset? offset.top: 0) - (translation? translation.y: 0),
      gx: (event.clientX || event.pageX),
      gy: (event.clientY || event.pageY),
      which: event.which || 1,
    };
  },

  /**
   * Assigns font data to the canvas.
   * @function wcPlayEditor#__setCanvasFont
   * @private
   * @param {Object} font - The font data to assign (wcPlayEditor~_font object).
   * @param {external:Canvas~Context} context - The canvas context.
   */
  __setCanvasFont: function(font, context) {
    context.font = (font.weight? font.weight + ' ': '') + (font.size + 'px ') + font.family;
  },

  /**
   * Clamps a given string value to a specific number of characters and appends a '...' if necessary.
   * @function wcPlayEditor#__clampString
   * @private
   * @param {String} str - The string to clamp.
   * @param {Number} len - The number of characters to allow.
   * @returns {String} - A clamped string.
   */
  __clampString: function(str, len) {
    if (str.length > len) {
      return str.substr(0, len) + '...';
    }
    return str;
  },

  /**
   * Blends two colors together. Color strings can be in hex string {'#ffffff'} or rgb string {'rgb(250,250,250)'} formats.
   * @function wcPlayEditor#__blendColors
   * @private
   * @param {String} c0 - The first color string.
   * @param {String} c1 - The second color string.
   * @param {Number} p - a multiplier to blend the colors by.
   */
  __blendColors: function(c0, c1, p) {
      var n=p<0?p*-1:p,u=Math.round,w=parseInt;
      if(c0.length>7){
          var f=c0.split(","),t=(c1?c1:p<0?"rgb(0,0,0)":"rgb(255,255,255)").split(","),R=w(f[0].slice(4)),G=w(f[1]),B=w(f[2]);
          return "rgb("+(u((w(t[0].slice(4))-R)*n)+R)+","+(u((w(t[1])-G)*n)+G)+","+(u((w(t[2])-B)*n)+B)+")"
      }else{
          var f=w(c0.slice(1),16),t=w((c1?c1:p<0?"#000000":"#FFFFFF").slice(1),16),R1=f>>16,G1=f>>8&0x00FF,B1=f&0x0000FF;
          return "#"+(0x1000000+(u(((t>>16)-R1)*n)+R1)*0x10000+(u(((t>>8&0x00FF)-G1)*n)+G1)*0x100+(u(((t&0x0000FF)-B1)*n)+B1)).toString(16).slice(1)
      }
  },

  /**
   * Retrieves a bounding rectangle that encloses all given rectangles.
   * @function wcPlayEditor#__expandRect
   * @private
   * @param {wcPlayEditor~Rect[]} rects - A list of rectangles to expand from.
   * @returns {wcPlayEditor~Rect} - A bounding rectangle that encloses all given rectangles.
   */
  __expandRect: function(rects) {
    var bounds = {
      top: rects[0].top,
      left: rects[0].left,
      width: rects[0].width,
      height: rects[0].height,
    };

    for (var i = 1; i < rects.length; ++i) {
      if (rects[i].top < bounds.top) {
        bounds.top = rects[i].top;
      }
      if (rects[i].left < bounds.left) {
        bounds.left = rects[i].left;
      }
    }
    for (var i = 1; i < rects.length; ++i) {
      if (rects[i].top + rects[i].height > bounds.top + bounds.height) {
        bounds.height = (rects[i].top + rects[i].height) - bounds.top;
      }
      if (rects[i].left + rects[i].width > bounds.left + bounds.width) {
        bounds.width = (rects[i].left + rects[i].width) - bounds.left;
      }
    }

    return bounds;
  },

  /**
   * Tests whether a given point is within a bounding rectangle.
   * @function wcPlayEditor#__inRect
   * @private
   * @param {wcPlay~Coordinates} pos - The position to test.
   * @param {wcPlayEditor~Rect} rect - The bounding rectangle.
   * @param {wcPlay~Coordinates} [trans] - An optional camera translation to apply to the pos.
   * @returns {Boolean} - Whether there is a collision.
   */
  __inRect: function(pos, rect, trans) {
    if (trans === undefined) {
      trans = {
        x: 0,
        y: 0,
        z: 1,
      };
    }

    if ((pos.y - trans.y) / trans.z >= rect.top &&
        (pos.x - trans.x) / trans.z >= rect.left &&
        (pos.y - trans.y) / trans.z <= rect.top + rect.height &&
        (pos.x - trans.x) / trans.z <= rect.left + rect.width) {
      return true;
    }
    return false;
  },

  /**
   * Tests whether a given rectangle is within a bounding rectangle.
   * @function wcPlayEditor#__rectInRect
   * @private
   * @param {wcPlayEditor~Rect} rectA - The first rectangle.
   * @param {wcPlayEditor~Rect} rectB - The second rectangle.
   * @returns {Boolean} - Whether there is a collision.
   */
  __rectInRect: function(rectA, rectB) {
    return !(rectB.left > rectA.left + rectA.width ||
            rectB.left + rectB.width < rectA.left ||
            rectB.top > rectA.top + rectA.height ||
            rectB.top + rectB.height < rectA.top);
  },

  /**
   * Draws a bounding rectangle.
   * @function wcPlayEditor#__drawRect
   * @private
   * @param {wcPlayEditor~Rect} rect - The rectangle bounds to draw.
   * @param {String} color - The color to draw.
   * @param {external:Canvas~Context} context - The canvas context to render on.
   */
  __drawRect: function(rect, color, context) {
    context.strokeStyle = color;
    context.strokeRect(rect.left, rect.top, rect.width, rect.height);
  },

  /**
   * Draws a rounded rectangle.
   * @function wcPlayEditor#__drawRoundedRect
   * @private
   * @param {wcPlayEditor~Rect} rect - The rectangle bounds to draw.
   * @param {String} color - The color of the line.
   * @param {Number} lineWidth - The thickness of the line, -1 will fill the shape.
   * @param {Number} radius - The radius of the rounded corners.
   * @param {external:Canvas~Context} context - The canvas context to render on.
   */
  __drawRoundedRect: function(rect, color, lineWidth, radius, context) {
    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = (lineWidth > 0)? lineWidth: 1;
    context.beginPath();
    context.moveTo(rect.left + radius, rect.top);
    context.arcTo(rect.left + rect.width, rect.top, rect.left + rect.width, rect.top + radius, radius);
    context.arcTo(rect.left + rect.width, rect.top + rect.height, rect.left + rect.width - radius, rect.top + rect.height, radius);
    context.arcTo(rect.left, rect.top + rect.height, rect.left, rect.top + rect.height - radius, radius);
    context.arcTo(rect.left, rect.top, rect.left + radius, rect.top, radius);
    context.closePath();
    lineWidth == -1? context.fill(): context.stroke();
    context.restore();
  },

  /**
   * Renders a new frame.
   * @function wcPlayEditor#__update
   * @private
   */
  __update: function(timestamp) {
    if (!this._lastUpdate) {
      this._lastUpdate = timestamp;
    }
    var elapsed = (timestamp - this._lastUpdate) / 1000;
    this._lastUpdate = timestamp;

    // Update undo/redo menu.
    var self = this;
    $('.wcPlayEditorMenuOptionUndo').each(function() {
      $(this).toggleClass('disabled', !self._undoManager.canUndo()).find('.wcButton').toggleClass('disabled', !self._undoManager.canUndo());
      $(this).attr('title', 'Undo ' + self._undoManager.undoInfo());
    });
    $('.wcPlayEditorMenuOptionRedo').each(function() {
      $(this).toggleClass('disabled', !self._undoManager.canRedo()).find('.wcButton').toggleClass('disabled', !self._undoManager.canRedo());
      $(this).attr('title', 'Redo ' + self._undoManager.redoInfo());
    });
    $('.wcPlayEditorMenuOptionDebugging').children('i:first-child, span:first-child').toggleClass('fa-dot-circle-o', this._engine.debugging()).toggleClass('fa-circle-o', !this._engine.debugging());
    $('.wcPlayEditorMenuOptionSilence').children(':first-child, span:first-child').toggleClass('fa-volume-off', this._engine.silent()).toggleClass('fa-volume-up', !this._engine.silent());
    $('.wcPlayEditorMenuOptionPausePlay').children('i:first-child, span:first-child').toggleClass('fa-play', this._engine.paused()).toggleClass('fa-pause', !this._engine.paused());
    $('.wcPlayEditorMenuOptionDelete').toggleClass('disabled', this._selectedNodes.length === 0);
    $('.wcPlayEditorMenuOptionComposite').toggleClass('disabled', this._selectedNodes.length === 0);
    $('.wcPlayEditorMenuOptionCompositeExit').toggleClass('disabled', this._parent instanceof wcPlay);
    $('.wcPlayEditorMenuOptionCompositeEnter').toggleClass('disabled', this._selectedNodes.length !== 1 || !(this._selectedNodes[0] instanceof wcNodeCompositeScript));


    this.onResized();

    if (this._parent) {

      // Render the palette.
      this.__drawPalette(elapsed);

      // Setup viewport canvas.
      this._viewportContext.clearRect(0, 0, this.$viewport.width(), this.$viewport.height());

      this._viewportContext.save();
      this._viewportContext.translate(this._viewportCamera.x, this._viewportCamera.y);
      this._viewportContext.scale(this._viewportCamera.z, this._viewportCamera.z);

      // Update nodes.
      this.__updateNodes(this._parent._entryNodes, elapsed);
      this.__updateNodes(this._parent._processNodes, elapsed);
      this.__updateNodes(this._parent._storageNodes, elapsed);
      this.__updateNodes(this._parent._compositeNodes, elapsed);

      // Render the nodes in the main script.
      this.__drawNodes(this._parent._entryNodes, this._viewportContext);
      this.__drawNodes(this._parent._processNodes, this._viewportContext);
      this.__drawNodes(this._parent._compositeNodes, this._viewportContext);
      this.__drawNodes(this._parent._storageNodes, this._viewportContext);

      // Render chains between nodes.
      this.__drawChains(this._parent._entryNodes, this._viewportContext);
      this.__drawChains(this._parent._processNodes, this._viewportContext);
      this.__drawChains(this._parent._compositeNodes, this._viewportContext);
      this.__drawChains(this._parent._storageNodes, this._viewportContext);

      if (this._highlightRect) {
        var radius = Math.min(10, this._highlightRect.width/2, this._highlightRect.height/2);
        this.__drawRoundedRect(this._highlightRect, "rgba(0, 255, 255, 0.25)", -1, radius, this._viewportContext);
        this.__drawRoundedRect(this._highlightRect, "darkcyan", 2, radius, this._viewportContext);
      }

      this._viewportContext.restore();
    }

    window.requestAnimationFrame(this.__update.bind(this));
  },

  /**
   * Updates the status of a list of nodes.
   * @function wcPlayEditor#__updateNodes
   * @private
   * @param {wcNode[]} nodes - The nodes to update.
   * @param {Number} elapsed - Elapsed time since last update.
   */
  __updateNodes: function(nodes, elapsed) {
    for (var i = 0; i < nodes.length; ++i) {
      this.__updateNode(nodes[i], elapsed);
    }
  },

  /**
   * Updates the status of a node.
   * @function wcPlayEditor#__updateNode
   * @private
   * @param {wcNode} node - The Node to update.
   * @param {Number} elapsed - Elapsed time since last update.
   */
  __updateNode: function(node, elapsed) {
    node.onDraw();

    // Update flash state.
    var self = this;
    function __updateFlash(meta, darkColor, lightColor, pauseColor, keepPaused, colorMul) {
      if (meta.flash) {
        meta.flashDelta += elapsed * 10.0;
        if (meta.flashDelta >= 1.0) {
          meta.flashDelta = 1.0;

          if (!meta.awake && (!meta.paused || (!keepPaused && !self._engine.paused()))) {
            meta.flash = false;
          }
        }
      } else if (meta.flashDelta > 0.0) {
        meta.flashDelta -= elapsed * 5.0;
        if (meta.flashDelta <= 0.0) {
          meta.flashDelta = 0;
          meta.paused = keepPaused? meta.paused: false;
        }
      }

      meta.color = self.__blendColors(darkColor, meta.paused? pauseColor: lightColor, meta.flashDelta * colorMul);
    }

    var color = node.color;
    if (this._highlightNode === node) {
      color = this.__blendColors(node.color, "#FFFFFF", 0.25);
    }
    __updateFlash(node._meta, color, "#FFFFFF", "#FFFFFF", true, 0.5);

    var blackColor = "#000000";
    var propColor  = "#117711";
    var flashColor = "#FFFF00";
    for (var i = 0; i < node.chain.entry.length; ++i) {
      __updateFlash(node.chain.entry[i].meta, blackColor, flashColor, flashColor, false, 0.9);
    }
    for (var i = 0; i < node.chain.exit.length; ++i) {
      __updateFlash(node.chain.exit[i].meta, blackColor, flashColor, flashColor, false, 0.9);
    }
    for (var i = 0; i < node.properties.length; ++i) {
      __updateFlash(node.properties[i].inputMeta, propColor, flashColor, flashColor, false, 0.9);
      __updateFlash(node.properties[i].outputMeta, propColor, flashColor, flashColor, false, 0.9);
    }
  },

  /**
   * Retrieves the index for a node type.
   * @function wcPlayEditor#__typeIndex
   * @private
   * @param {wcPlay.NODE_TYPE} type - The node type.
   * @returns {Number} - The type index.
   */
  __typeIndex: function(type) {
    switch (type) {
      case wcPlay.NODE_TYPE.ENTRY: return 0;
      case wcPlay.NODE_TYPE.PROCESS: return 1;
      case wcPlay.NODE_TYPE.STORAGE: return 2;
      case wcPlay.NODE_TYPE.COMPOSITE: return 3;
    }
  },

  /**
   * Initializes the file menu and toolbar.
   * @function wcPlayEditor#__setupMenu
   * @private
   */
  __setupMenu: function() {
    var $fileMenu = $('\
      <ul class="wcPlayEditorMenu wcPlayNoHighlights">\
        <span class="wcPlayVersionTag wcPlayNoHighlights"></span>\
        <li><span>File</span>\
          <ul>\
            <li><span class="wcPlayEditorMenuOptionNew wcPlayMenuItem"><i class="wcPlayEditorMenuIcon wcButton fa fa-file-o fa-lg"/>New Script...<span>Ctrl+N</span></span></li>\
            <li><span class="wcPlayEditorMenuOptionOpen wcPlayMenuItem disabled"><i class="wcPlayEditorMenuIcon wcButton fa fa-folder-open-o fa-lg"/>Open Script...<span>Ctrl+O</span></span></li>\
            <li><span class="wcPlayEditorMenuOptionSave wcPlayMenuItem disabled"><i class="wcPlayEditorMenuIcon wcButton fa fa-save fa-lg"/>Save Script<span>Ctrl+S</span></span></li>\
          </ul>\
        </li>\
        <li><span>Edit</span>\
          <ul>\
            <li><span class="wcPlayEditorMenuOptionUndo wcPlayMenuItem disabled"><i class="wcPlayEditorMenuIcon wcButton fa fa-backward fa-lg"/>Undo<span>Ctrl+Z</span></span></li>\
            <li><span class="wcPlayEditorMenuOptionRedo wcPlayMenuItem disabled"><i class="wcPlayEditorMenuIcon wcButton fa fa-forward fa-lg"/>Redo<span>Ctrl+Y</span></span></li>\
            <li><hr class="wcPlayMenuSeparator"></li>\
            <li><span class="wcPlayEditorMenuOptionCut wcPlayMenuItem disabled"><i class="wcPlayEditorMenuIcon wcButton fa fa-cut fa-lg"/>Cut<span>Ctrl+X</span></span></li>\
            <li><span class="wcPlayEditorMenuOptionCopy wcPlayMenuItem disabled"><i class="wcPlayEditorMenuIcon wcButton fa fa-copy fa-lg"/>Copy<span>Ctrl+C</span></span></li>\
            <li><span class="wcPlayEditorMenuOptionPaste wcPlayMenuItem disabled"><i class="wcPlayEditorMenuIcon wcButton fa fa-paste fa-lg"/>Paste<span>Ctrl+P</span></span></li>\
            <li><span class="wcPlayEditorMenuOptionDelete wcPlayMenuItem"><i class="wcPlayEditorMenuIcon wcButton fa fa-trash-o fa-lg"/>Delete<span>Del</span></span></li>\
            <li><hr class="wcPlayMenuSeparator"></li>\
            <li><span class="wcPlayEditorMenuOptionComposite wcPlayMenuItem" title="Combine all selected nodes into a new \'Composite\' Node."><i class="wcPlayEditorMenuIcon wcButton fa fa-share-alt-square fa-lg"/>Create Composite<span>C</span></span></li>\
          </ul>\
        </li>\
        <li><span>View</span>\
          <ul>\
            <li><span class="wcPlayEditorMenuOptionCenter wcPlayMenuItem" title="Fit selected nodes into view."><i class="wcPlayEditorMenuIcon wcButton fa fa-crosshairs fa-lg"/>Fit in View<span>F</span></span></li>\
            <li><span class="wcPlayEditorMenuOptionCompositeExit wcPlayMenuItem" title="Exit out of this Composite node."><i class="wcPlayEditorMenuIcon wcButton fa fa-level-up fa-lg"/>Exit Composite<span>O</span></span></li>\
            <li><span class="wcPlayEditorMenuOptionCompositeEnter wcPlayMenuItem" title="Enter into this Composite node."><i class="wcPlayEditorMenuIcon wcButton fa fa-level-down fa-lg"/>Enter Composite<span>I</span></span></li>\
            <li><hr class="wcPlayMenuSeparator"></li>\
            <li><span class="wcPlayEditorMenuOptionCompositeSearch wcPlayMenuItem disabled" title="Search for nodes in your script."><i class="wcPlayEditorMenuIcon wcButton fa fa-search fa-lg"/>Search Nodes<span>Ctrl+F</span></span></li>\
          </ul>\
        </li>\
        <li><span>Debugging</span>\
          <ul>\
            <li><span class="wcPlayEditorMenuOptionRestart wcPlayMenuItem" title="Reset all property values to their initial state and restart the execution of the script."><i class="wcPlayEditorMenuIcon wcButton fa fa-refresh fa-lg"/>Restart Script<span></span></span></li>\
            <li><hr class="wcPlayMenuSeparator"></li>\
            <li><span class="wcPlayEditorMenuOptionDebugging wcPlayMenuItem" title="Toggle debugging mode for the entire script."><i class="wcPlayEditorMenuIcon wcButton fa fa-dot-circle-o fa-lg"/>Toggle Debug Mode<span></span></span></li>\
            <li><span class="wcPlayEditorMenuOptionSilence wcPlayMenuItem" title="Toggle silent mode for the entire script (Nodes with debug log enabled will not log when this is active)."><i class="wcPlayEditorMenuIcon wcButton fa fa-volume-up fa-lg"/>Toggle Silence Mode<span></span></span></li>\
            <li><hr class="wcPlayMenuSeparator"></li>\
            <li><span class="wcPlayEditorMenuOptionPausePlay wcPlayMenuItem" title="Pause or Continue execution of the script."><i class="wcPlayEditorMenuIcon wcButton fa fa-pause fa-lg"/>Pause/Continue Script<span>Return</span></span></li>\
            <li><span class="wcPlayEditorMenuOptionStep wcPlayMenuItem" title="Steps execution of the script by a single update."><i class="wcPlayEditorMenuIcon wcButton fa fa-forward fa-lg"/>Step Script<span>Spacebar</span></span></li>\
          </ul>\
        </li>\
        <li><span>Help</span>\
          <ul>\
            <li><span class="wcPlayEditorMenuOptionDocs wcPlayMenuItem" title="Open the documentation for wcPlay in another window."><i class="wcPlayEditorMenuIcon wcButton fa fa-file-pdf-o fa-lg"/>Documentation...<span></span></span></li>\
            <li><span class="wcPlayEditorMenuOptionAbout wcPlayMenuItem disabled"><i class="wcPlayEditorMenuIcon wcButton fa fa-question fa-lg"/>About...<span></span></span></li>\
          </ul>\
        </li>\
      </ul>\
    ');

    var $toolbar = $('\
      <div class="wcPlayEditorToolbar wcPlayNoHighlights">\
        <div class="wcPlayEditorMenuOptionNew"><span class="wcPlayEditorMenuIcon wcButton fa fa-file-o fa-lg" title="New Project"/></div>\
        <div class="wcPlayEditorMenuOptionOpen disabled"><span class="wcPlayEditorMenuIcon wcButton fa fa-folder-open-o fa-lg" title="Open Project"></div>\
        <div class="wcPlayEditorMenuOptionSave disabled"><span class="wcPlayEditorMenuIcon wcButton fa fa-save fa-lg" title="Save Project"></div>\
        <div class="ARPG_Separator"></div>\
        <div class="wcPlayEditorMenuOptionUndo"><span class="wcPlayEditorMenuIcon wcButton fa fa-backward fa-lg"/></div>\
        <div class="wcPlayEditorMenuOptionRedo"><span class="wcPlayEditorMenuIcon wcButton fa fa-forward fa-lg"/></div>\
        <div class="ARPG_Separator"></div>\
        <div class="wcPlayEditorMenuOptionCut disabled"><span class="wcPlayEditorMenuIcon wcButton fa fa-cut fa-lg" title="Cut"/></div>\
        <div class="wcPlayEditorMenuOptionCopy disabled"><span class="wcPlayEditorMenuIcon wcButton fa fa-copy fa-lg" title="Copy"/></div>\
        <div class="wcPlayEditorMenuOptionPaste disabled"><span class="wcPlayEditorMenuIcon wcButton fa fa-paste fa-lg" title="Paste"/></div>\
        <div class="wcPlayEditorMenuOptionDelete"><span class="wcPlayEditorMenuIcon wcButton fa fa-trash-o fa-lg" title="Delete"/></div>\
        <div class="ARPG_Separator"></div>\
        <div class="wcPlayEditorMenuOptionComposite"><span class="wcPlayEditorMenuIcon wcButton fa fa-share-alt-square fa-lg" title="Combine all selected nodes into a new \'Composite\' Node."/></div>\
        <div class="ARPG_Separator"></div>\
        <div class="wcPlayEditorMenuOptionRestart"><span class="wcPlayEditorMenuIcon wcButton fa fa-refresh fa-lg" title="Reset all property values to their initial state and restart the execution of the script."/></div>\
        <div class="ARPG_Separator"></div>\
        <div class="wcPlayEditorMenuOptionDebugging"><span class="wcPlayEditorMenuIcon wcButton fa fa-dot-circle-o fa-lg" title="Toggle debugging mode for the entire script."/></div>\
        <div class="wcPlayEditorMenuOptionSilence"><span class="wcPlayEditorMenuIcon wcButton fa fa-volume-up fa-lg" title="Toggle silent mode for the entire script (Nodes with debug log enabled will not log when this is active)."/></div>\
        <div class="ARPG_Separator"></div>\
        <div class="wcPlayEditorMenuOptionPausePlay"><span class="wcPlayEditorMenuIcon wcButton fa fa-pause fa-lg" title="Pause or Continue execution of the script."/></div>\
        <div class="wcPlayEditorMenuOptionStep"><span class="wcPlayEditorMenuIcon wcButton fa fa-forward fa-lg" title="Steps execution of the script by a single update."/></div>\
        <div class="ARPG_Separator"></div>\
        <div class="wcPlayEditorMenuOptionCenter"><span class="wcPlayEditorMenuIcon wcButton fa fa-crosshairs fa-lg" title="Fit selected nodes into view."/></div>\
        <div class="wcPlayEditorMenuOptionCompositeExit"><span class="wcPlayEditorMenuIcon wcButton fa fa-level-up fa-lg" title="Exit out of this Composite node."/></div>\
        <div class="wcPlayEditorMenuOptionCompositeEnter"><span class="wcPlayEditorMenuIcon wcButton fa fa-level-down fa-lg" title="Enter into this Composite node."/></div>\
        <div class="ARPG_Separator"></div>\
        <div class="wcPlayEditorMenuOptionCompositeSearch disabled"><span class="wcPlayEditorMenuIcon wcButton fa fa-search fa-lg" title="Search for nodes in your script."/></div>\
      </div>\
    ');

    this.$top.append($fileMenu);
    this.$top.append($toolbar);
  },

  /**
   * Initializes the palette view.
   * @function wcPlayEditor#__setupPalette
   * @private
   */
  __setupPalette: function() {
    if (this.$typeButton.length == 0) {
      // Create our top bar with buttons for each node type.
      this.$typeButton.push($('<button class="wcPlayEditorButton" title="Show Entry Nodes.">Entry</button>'));
      this.$typeButton.push($('<button class="wcPlayEditorButton wcToggled" title="Show Process Nodes.">Process</button>'));
      this.$typeButton.push($('<button class="wcPlayEditorButton" title="Show Storage Nodes.">Storage</button>'));
      this.$typeButton.push($('<button class="wcPlayEditorButton" title="Show Composite Nodes.">Composite</button>'));
      this.$palette.append(this.$typeButton[0]);
      this.$palette.append(this.$typeButton[1]);
      this.$palette.append(this.$typeButton[2]);
      this.$palette.append(this.$typeButton[3]);

      this.$typeArea.push($('<div class="wcPlayTypeArea wcPlayHidden">'));
      this.$typeArea.push($('<div class="wcPlayTypeArea">'));
      this.$typeArea.push($('<div class="wcPlayTypeArea wcPlayHidden">'));
      this.$typeArea.push($('<div class="wcPlayTypeArea wcPlayHidden">'));
      this.$paletteInner.append(this.$typeArea[0]);
      this.$paletteInner.append(this.$typeArea[1]);
      this.$paletteInner.append(this.$typeArea[2]);
      this.$paletteInner.append(this.$typeArea[3]);
    }

    // Empty out our current node library.
    if (this._nodeLibrary) {
      for (var cat in this._nodeLibrary) {
        for (var type in this._nodeLibrary[cat]) {
          var typeData = this._nodeLibrary[cat][type];
          typeData.$button.remove();
          typeData.$canvas.remove();
          typeData.$category.remove();
          for (var i = 0; i < typeData.nodes.length; ++i) {
            typeData.nodes[i].destroy();
          }
        }
      }

      this._nodeLibrary = {};
    }

    // Initialize our node library.
    for (var i = 0; i < wcPlay.NODE_LIBRARY.length; ++i) {
      var data = wcPlay.NODE_LIBRARY[i];

      // Skip categories we are not showing.
      if (data.type !== wcPlay.NODE_TYPE.COMPOSITE) {
        var catIndex = this._options.category.items.indexOf(data.category);
        if ((!this._options.category.isBlacklist && catIndex === -1) ||
            (this._options.category.isBlacklist && catIndex > -1)) {
          continue;
        }
      } else {
        // Skip composite node special 'link' nodes if we are not inside a composite.
        if (this._engine === this._parent) {
          if (data.category === '__Custom__') {
            continue;
          }
        }
      }

      // Initialize the node category if it is new.
      if (!this._nodeLibrary.hasOwnProperty(data.category)) {
        this._nodeLibrary[data.category] = {};
      }

      // Further categorize the node by its type.
      if (!this._nodeLibrary[data.category].hasOwnProperty(data.type)) {
        var typeData = {
          $category: $('<div class="wcPlayTypeCategory">'),
          $button: $('<button class="wcPlayCategoryButton" title="Toggle visibility of this category.">' + data.category + '</button>'),
          $canvas: $('<canvas class="wcPlayTypeCategoryArea">'),
          context: null,
          nodes: [],
        };
        typeData.context = typeData.$canvas[0].getContext('2d');
        typeData.$category.append(typeData.$button);
        typeData.$category.append(typeData.$canvas);
        this.$typeArea[this.__typeIndex(data.type)].append(typeData.$category);

        (function __setupCollapseHandler(d) {
          d.$button.click(function() {
            if (!d.$button.hasClass('wcToggled')) {
              d.$button.addClass('wcToggled');
              d.$canvas.addClass('wcPlayHidden');
            } else {
              d.$button.removeClass('wcToggled');
              d.$canvas.removeClass('wcPlayHidden');
            }
          });
        })(typeData);

        this._nodeLibrary[data.category][data.type] = typeData;
      }

      // Now create an instance of the node.
      var node = new window[data.name](null);
      node.collapsed(false);
      if (node.decompile) {
        node.decompile();
      }
      this._nodeLibrary[data.category][data.type].nodes.push(node);
      this.__updateNode(node, 0);
    }

    // Now draw each of our palette nodes once so we can configure the size of the canvases.
    for (var cat in this._nodeLibrary) {
      for (var type in this._nodeLibrary[cat]) {
        var typeData = this._nodeLibrary[cat][type];
        typeData.$canvas.attr('width', this.$paletteInner.width());
        var yPos = this._drawStyle.palette.spacing;
        var xPos = this.$paletteInner.width() / 2;
        for (var i = 0; i < typeData.nodes.length; ++i) {
          var drawData = this.__drawNode(typeData.nodes[i], {x: xPos, y: yPos}, typeData.context, true);
          yPos += drawData.rect.height + this._drawStyle.palette.spacing;
        }
        typeData.$canvas.attr('height', yPos);
      }
    }

    var self = this;
    this.$typeButton[0].click(function() {
      self.$typeButton[0].addClass('wcToggled');
      self.$typeButton[1].removeClass('wcToggled');
      self.$typeButton[2].removeClass('wcToggled');
      self.$typeButton[3].removeClass('wcToggled');

      self.$typeArea[0].removeClass('wcPlayHidden');
      self.$typeArea[1].addClass('wcPlayHidden');
      self.$typeArea[2].addClass('wcPlayHidden');
      self.$typeArea[3].addClass('wcPlayHidden');
    });
    this.$typeButton[1].click(function() {
      self.$typeButton[0].removeClass('wcToggled');
      self.$typeButton[1].addClass('wcToggled');
      self.$typeButton[2].removeClass('wcToggled');
      self.$typeButton[3].removeClass('wcToggled');

      self.$typeArea[0].addClass('wcPlayHidden');
      self.$typeArea[1].removeClass('wcPlayHidden');
      self.$typeArea[2].addClass('wcPlayHidden');
      self.$typeArea[3].addClass('wcPlayHidden');
    });
    this.$typeButton[2].click(function() {
      self.$typeButton[0].removeClass('wcToggled');
      self.$typeButton[1].removeClass('wcToggled');
      self.$typeButton[2].addClass('wcToggled');
      self.$typeButton[3].removeClass('wcToggled');

      self.$typeArea[0].addClass('wcPlayHidden');
      self.$typeArea[1].addClass('wcPlayHidden');
      self.$typeArea[2].removeClass('wcPlayHidden');
      self.$typeArea[3].addClass('wcPlayHidden');
    });
    this.$typeButton[3].click(function() {
      self.$typeButton[0].removeClass('wcToggled');
      self.$typeButton[1].removeClass('wcToggled');
      self.$typeButton[2].removeClass('wcToggled');
      self.$typeButton[3].addClass('wcToggled');

      self.$typeArea[0].addClass('wcPlayHidden');
      self.$typeArea[1].addClass('wcPlayHidden');
      self.$typeArea[2].addClass('wcPlayHidden');
      self.$typeArea[3].removeClass('wcPlayHidden');
    });
  },

  /**
   * Draws each node in the palette view.
   * @function wcPlayEditor#__drawPalette
   * @private
   * @param {Number} elapsed - Elapsed time since last update.
   */
  __drawPalette: function(elapsed) {
    for (var cat in this._nodeLibrary) {
      for (var type in this._nodeLibrary[cat]) {

        // Ignore types that are not visible.
        if (!this.$typeButton[this.__typeIndex(type)].hasClass('wcToggled')) continue;

        var typeData = this._nodeLibrary[cat][type];

        // Ignore categories that are not visible.
        if (typeData.$button.hasClass('wcToggled')) continue;

        var yPos = this._drawStyle.palette.spacing;
        var xPos = this.$paletteInner.width() / 2;
        typeData.$canvas.attr('width', this.$paletteInner.width());
        typeData.context.clearRect(0, 0, typeData.$canvas.width(), typeData.$canvas.height());
        typeData.context.save();
        this.__updateNodes(typeData.nodes, elapsed);

        for (var i = 0; i < typeData.nodes.length; ++i) {
          var drawData = this.__drawNode(typeData.nodes[i], {x: xPos, y: yPos}, typeData.context, true);
          yPos += drawData.rect.height + this._drawStyle.palette.spacing;
        }

        typeData.context.restore();
      }
    }
  },

  /**
   * Draws a list of nodes on the canvas.
   * @function wcPlayEditor#__drawNodes
   * @private
   * @param {wcNode[]} nodes - The node to render.
   * @param {external:Canvas~Context} context - The canvas context to render on.
   * @param {Boolean} [hideCollapsible] - If true, all collapsible properties will be hidden, even if the node is not collapsed.
   */
  __drawNodes: function(nodes, context, hideCollapsible) {
    for (var i = 0; i < nodes.length; ++i) {
      this.__drawNode(nodes[i], nodes[i].pos, context, hideCollapsible);
    }
  },

  /**
   * Draws a single node on the canvas at a given position.
   * @function wcPlayEditor#__drawNode
   * @private
   * @param {wcNode} node - The node to render.
   * @param {wcPlay~Coordinates} pos - The position to render the node in the canvas, relative to the top-middle of the node.
   * @param {external:Canvas~Context} context - The canvas context to render on.
   * @param {Boolean} [hideCollapsible] - If true, all collapsible properties will be hidden, even if the node is not collapsed.
   * @returns {wcPlayEditor~DrawNodeData} - Data associated with the newly drawn node.
   */
  __drawNode: function(node, pos, context, hideCollapsible) {
    var data = {
      node: node,
      rect: {
        top: pos.y,
        left: pos.x,
        width: 0,
        height: 0,
      },
    };

    // TODO: Ignore drawing if the node is outside of view.

    // Take some measurements so we know where everything on the node should be drawn.
    var entryBounds  = this.__measureEntryLinks(node, context, pos);
    var centerBounds = this.__measureCenter(node, context, {x: pos.x, y: pos.y + entryBounds.height}, hideCollapsible);
    var exitBounds   = this.__measureExitLinks(node, context, {x: pos.x, y: pos.y + entryBounds.height + centerBounds.height});

    var bounds = this.__expandRect([entryBounds, centerBounds, exitBounds]);
    bounds.top = centerBounds.top;
    bounds.height = centerBounds.height;
    bounds.propWidth = centerBounds.propWidth;
    bounds.valueWidth = centerBounds.valueWidth;
    bounds.initialWidth = centerBounds.initialWidth;

    data.rect = this.__expandRect([entryBounds, centerBounds, exitBounds]);
    data.inner = this.__expandRect([centerBounds]);
    data.inner.left = data.rect.left;
    data.inner.width = data.rect.width;
    data.rect.top -= 3;
    data.rect.left -= this._drawStyle.links.length + 3;
    data.rect.width += this._drawStyle.links.length * 2 + 6;
    data.rect.height += 6;

    if (node.chain.entry.length) {
      data.inner.top -= this._drawStyle.links.padding + this._font.links.size;
      data.inner.height += this._drawStyle.links.padding + this._font.links.size;
    } else {
      data.rect.top -= this._drawStyle.links.length;
      data.rect.height += this._drawStyle.links.length;
    }
    if (node.chain.exit.length) {
      data.inner.height += this._drawStyle.links.padding + this._font.links.size;
    } else {
      data.rect.height += this._drawStyle.links.length;
    }

    // Show an additional bounding rect around selected nodes.
    if (this._selectedNodes.indexOf(node) > -1) {
      this.__drawRoundedRect(data.rect, "rgba(0, 255, 255, 0.25)", -1, 10, context);
      this.__drawRoundedRect(data.rect, "darkcyan", 2, 10, context);
    }

    var maxValueWidth = (data.inner.width - this._drawStyle.node.margin*2 - bounds.propWidth);
    if (maxValueWidth > bounds.valueWidth + bounds.initialWidth) {
      var extra = (maxValueWidth - (bounds.valueWidth + bounds.initialWidth)) / 2;
      bounds.valueWidth += extra;
      bounds.initialWidth += extra;
    }

    // Now use our measurements to draw our node.
    var propBounds  = this.__drawCenter(node, context, bounds, hideCollapsible);
    var entryLinkBounds = this.__drawEntryLinks(node, context, pos, entryBounds.width);
    var exitLinkBounds = this.__drawExitLinks(node, context, {x: pos.x, y: pos.y + entryBounds.height + centerBounds.height}, exitBounds.width);

    data.entryBounds = entryLinkBounds;
    data.exitBounds = exitLinkBounds;
    data.titleBounds = propBounds.titleBounds;
    data.viewportBounds = propBounds.viewportBounds;
    data.inputBounds = propBounds.inputBounds;
    data.outputBounds = propBounds.outputBounds;
    data.propertyBounds = propBounds.propertyBounds;
    data.valueBounds = propBounds.valueBounds;
    data.initialBounds = propBounds.initialBounds;

    data.farRect = {
      top: data.inner.top - 30,
      left: data.inner.left - 30,
      width: data.inner.width + 60,
      height: data.inner.height + 60,
    };

    // // Add a collapse button to the node in the left margin of the title.
    // data.collapser = {
    //   left: data.inner.left + 4,
    //   top: data.inner.top + 4 + (node.chain.entry.length? this._font.links.size + this._drawStyle.links.padding: 0),
    //   width: this._drawStyle.node.margin - 5,
    //   height: this._font.title.size - 4,
    // };

    // context.save();
    // context.fillStyle = (this._highlightCollapser && this._highlightNode === node? "black": "white");
    // context.strokeStyle = "black";
    // context.lineWidth = 1;
    // context.fillRect(data.collapser.left, data.collapser.top, data.collapser.width, data.collapser.height);
    // context.strokeRect(data.collapser.left, data.collapser.top, data.collapser.width, data.collapser.height);

    // context.strokeStyle = (this._highlightCollapser && this._highlightNode === node? "white": "black");
    // context.lineWidth = 2;
    // context.beginPath();
    // context.moveTo(data.collapser.left + 1, data.collapser.top + data.collapser.height/2);
    // context.lineTo(data.collapser.left + data.collapser.width - 1, data.collapser.top + data.collapser.height/2);
    // if (node.collapsed()) {
    //   context.moveTo(data.collapser.left + data.collapser.width/2, data.collapser.top + 1);
    //   context.lineTo(data.collapser.left + data.collapser.width/2, data.collapser.top + data.collapser.height - 1);
    // }
    // context.stroke();
    // context.restore();

    // Add breakpoint button to the node in the right margin of the title.
    data.breakpoint = {
      left: data.inner.left + 4,
      top: data.inner.top + 4 + (node.chain.entry.length? this._font.links.size + this._drawStyle.links.padding: 0),
      width: this._drawStyle.node.margin - 5,
      height: this._font.title.size - 4,
    };

    context.save();
    context.fillStyle = (this._highlightBreakpoint && this._highlightNode === node? "black": "white");
    context.fillRect(data.breakpoint.left, data.breakpoint.top, data.breakpoint.width, data.breakpoint.height);

    context.strokeStyle = (node._break? "darkred": (this._highlightBreakpoint && this._highlightNode === node? "white": "black"));
    context.fillStyle = "darkred";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(data.breakpoint.left + data.breakpoint.width/2, data.breakpoint.top + data.breakpoint.height/2, Math.min(data.breakpoint.width/2-2, data.breakpoint.height/2-2), 0, 2 * Math.PI);
    node._break && context.fill();
    context.stroke();

    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.strokeRect(data.breakpoint.left, data.breakpoint.top, data.breakpoint.width, data.breakpoint.height);
    context.restore();

    // DEBUG: Render bounding box geometry.
    // context.strokeStyle = "red";
    // function __drawBoundList(list) {
    //   for (var i = 0; i < list.length; ++i) {
    //     context.strokeRect(list[i].rect.left, list[i].rect.top, list[i].rect.width, list[i].rect.height);
    //   };
    // }
    // __drawBoundList(data.entryBounds);
    // __drawBoundList(data.exitBounds);
    // __drawBoundList(data.inputBounds);
    // __drawBoundList(data.outputBounds);
    // __drawBoundList(data.valueBounds);
    // context.strokeRect(entryBounds.left, entryBounds.top, entryBounds.width, entryBounds.height);
    // context.strokeRect(exitBounds.left, exitBounds.top, exitBounds.width, exitBounds.height);
    // context.strokeRect(data.inner.left, data.inner.top, data.inner.width, data.inner.height);
    // context.strokeRect(data.rect.left, data.rect.top, data.rect.width, data.rect.height);

    // Increase the nodes border thickness when flashing.
    if (node._meta.flashDelta) {
      if (node._meta.paused) {
        this.__drawRoundedRect(data.inner, "#CC0000", 5, 10, context);
      } else {
        this.__drawRoundedRect(data.inner, "yellow", 2, 10, context);
      }
    }

    // this.__drawRoundedRect(data.farRect, "#000", 2, 10, context);

    node._meta.bounds = data;
    return data;
  },

  /**
   * Measures the space to render entry links for a node.
   * @function wcPlayEditor#__measureEntryLinks
   * @private
   * @param {wcNode} node - The node to measure.
   * @param {external:Canvas~Context} context - The canvas context.
   * @param {wcPlay~Coordinates} pos - The (top, center) position to measure the links.
   * @returns {wcPlayEditor~Rect} - A bounding rectangle.
   */
  __measureEntryLinks: function(node, context, pos) {
    var bounds = {
      top: pos.y,
      left: pos.x,
      width: 0,
      height: 0,
    };

    this.__setCanvasFont(this._font.links, context);

    var collapsed = node.collapsed();
    var links = node.chain.entry;
    for (var i = 0; i < links.length; ++i) {
      if (!collapsed || links[i].links.length) {
        bounds.width += context.measureText(links[i].name).width + this._drawStyle.links.spacing;
      }
    }

    bounds.left -= bounds.width/2 + this._drawStyle.links.margin;
    bounds.width += this._drawStyle.links.margin * 2;
    if (node.chain.entry.length) {
      bounds.height = this._font.links.size + this._drawStyle.links.padding + this._drawStyle.links.length;
    }
    return bounds;
  },

  /**
   * Measures the space to render exit links for a node.
   * @function wcPlayEditor#__measureExitLinks
   * @private
   * @param {wcNode} node - The node to measure.
   * @param {external:Canvas~Context} context - The canvas context.
   * @param {wcPlay~Coordinates} pos - The (top, center) position to measure the links.
   * @returns {wcPlayEditor~Rect} - A bounding rectangle.
   */
  __measureExitLinks: function(node, context, pos) {
    var bounds = {
      top: pos.y,
      left: pos.x,
      width: 0,
      height: 0,
    };

    this.__setCanvasFont(this._font.links, context);

    var collapsed = node.collapsed();
    var links = node.chain.exit;
    for (var i = 0; i < links.length; ++i) {
      if (!collapsed || links[i].links.length) {
        bounds.width += context.measureText(links[i].name).width + this._drawStyle.links.spacing;
      }
    }

    bounds.left -= bounds.width/2 + this._drawStyle.links.margin;
    bounds.width += this._drawStyle.links.margin * 2;
    if (node.chain.exit.length) {
      bounds.height = this._font.links.size + this._drawStyle.links.padding + this._drawStyle.links.length;
    }
    return bounds;
  },

  /**
   * Measures the space to render the center area for a node.
   * @function wcPlayEditor#__measureCenter
   * @private
   * @param {wcNode} node - The node to measure.
   * @param {external:Canvas~Context} context - The canvas context.
   * @param {wcPlay~Coordinates} pos - The (top, center) position to measure.
   * @param {Boolean} [hideCollapsible] - If true, all collapsible properties will be hidden, even if the node is not collapsed.
   * @returns {wcPlayEditor~Rect} - A bounding rectangle. The height is only the amount of space rendered within the node bounds (links stick out).
   */
  __measureCenter: function(node, context, pos, hideCollapsible) {
    var bounds = {
      top: pos.y,
      left: pos.x,
      width: 0,
      height: this._font.title.size + this._drawStyle.title.spacing + this._drawStyle.links.padding,
    };

    // Measure the title bar area.
    this.__setCanvasFont(this._font.title, context);
    bounds.width = context.measureText(this._drawStyle.title.wrapL + node.type + ': ' + this._drawStyle.title.wrapR).width;
    this.__setCanvasFont(this._font.titleDesc, context);
    bounds.width += context.measureText(this._drawStyle.title.nameWrapL + (node.name || this._drawStyle.title.placeholder) + this._drawStyle.title.nameWrapR).width;

    // Measure the node's viewport.
    if (node._viewportSize) {
      bounds.width = Math.max(bounds.width, node._viewportSize.x);
      bounds.height += node._viewportSize.y + this._drawStyle.property.spacing;
    }

    // Measure properties.
    var propWidth = 0;
    var valueWidth = 0;
    var initialWidth = 0;
    var collapsed = node.collapsed();
    var props = node.properties;
    for (var i = 0; i < props.length; ++i) {
      // Skip properties that are collapsible if it is not chained.
      if ((!collapsed && !hideCollapsible) || !props[i].options.collapsible || props[i].inputs.length || props[i].outputs.length) {
        bounds.height += this._font.property.size + this._drawStyle.property.spacing;

        // Property name.
        this.__setCanvasFont(this._font.property, context);
        propWidth = Math.max(context.measureText(props[i].name + ': ').width, propWidth);

        // Property value.
        this.__setCanvasFont(this._font.value, context);
        valueWidth = Math.max(context.measureText(this._drawStyle.property.valueWrapL + this.__drawPropertyValue(node, props[i]) + this._drawStyle.property.valueWrapR).width, this._drawStyle.property.minLength, valueWidth);

        // Property initial value.
        this.__setCanvasFont(this._font.initialValue, context);
        initialWidth = Math.max(context.measureText(this._drawStyle.property.initialWrapL + this.__drawPropertyValue(node, props[i], true) + this._drawStyle.property.initialWrapR).width, this._drawStyle.property.minLength, initialWidth);
      }
    }

    bounds.width = Math.max(propWidth + valueWidth + initialWidth, bounds.width) + this._drawStyle.node.margin * 2;
    bounds.left -= bounds.width/2;
    bounds.propWidth = propWidth;
    bounds.valueWidth = valueWidth;
    bounds.initialWidth = initialWidth;
    return bounds;
  },

  /**
   * Draws the entry links of a node.
   * @function wcPlayEditor#__drawEntryLinks
   * @private
   * @param {wcNode} node - The node to draw.
   * @param {external:Canvas~Context} context - The canvas context.
   * @param {wcPlay~Coordinates} pos - The (top, center) position to draw the links on the canvas.
   * @param {Number} width - The width of the area to draw in.
   * @returns {wcPlayEditor~BoundingData[]} - An array of bounding rectangles, one for each link 'nub'.
   */
  __drawEntryLinks: function(node, context, pos, width) {
    var xPos = pos.x - width/2 + this._drawStyle.links.margin;
    var yPos = pos.y + this._drawStyle.links.length + this._font.links.size;

    this.__setCanvasFont(this._font.links, context);

    var result = [];

    var collapsed = node.collapsed();
    var links = node.chain.entry;
    for (var i = 0; i < links.length; ++i) {
      if (!collapsed || links[i].links.length) {
        // Link label
        context.fillStyle = "black";
        var w = context.measureText(links[i].name).width + this._drawStyle.links.spacing;
        context.fillText(links[i].name, xPos + this._drawStyle.links.spacing/2, yPos);

        // Link nub
        var rect = {
          top: yPos - this._drawStyle.links.length - this._font.links.size,
          left: xPos + w/2 - this._drawStyle.links.width/2,
          width: this._drawStyle.links.width,
          height: this._drawStyle.links.length,
        };

        context.fillStyle = (this._highlightEntryLink && this._highlightEntryLink.name === links[i].name && this._highlightNode === node? "cyan": links[i].meta.color);
        context.strokeStyle = "black";
        context.beginPath();
        context.moveTo(rect.left, rect.top);
        context.lineTo(rect.left + rect.width/2, rect.top + rect.height/3);
        context.lineTo(rect.left + rect.width, rect.top);
        context.lineTo(rect.left + rect.width, rect.top + rect.height);
        context.lineTo(rect.left, rect.top + rect.height);
        context.closePath();
        context.stroke();
        context.fill();

        // Expand the bounding rect just a little so it is easier to click.
        rect.left -= 5;
        rect.width += 10;

        result.push({
          rect: rect,
          point: {
            x: rect.left + rect.width/2,
            y: rect.top + rect.height/3 - 2,
          },
          name: links[i].name,
        });

        xPos += w;
      }
    }

    return result;
  },

  /**
   * Draws the exit links of a node.
   * @function wcPlayEditor#__drawExitLinks
   * @private
   * @param {wcNode} node - The node to draw.
   * @param {external:Canvas~Context} context - The canvas context.
   * @param {wcPlay~Coordinates} pos - The (top, center) position to draw the links on the canvas.
   * @param {Number} width - The width of the area to draw in.
   * @returns {wcPlayEditor~BoundingData[]} - An array of bounding rectangles, one for each link 'nub'.
   */
  __drawExitLinks: function(node, context, pos, width) {
    var xPos = pos.x - width/2 + this._drawStyle.links.margin;
    var yPos = pos.y + this._font.links.size;

    this.__setCanvasFont(this._font.links, context);

    var result = [];

    var collapsed = node.collapsed();
    var links = node.chain.exit;
    for (var i = 0; i < links.length; ++i) {
      if (!collapsed || links[i].links.length) {
        // Link label
        context.fillStyle = "black";
        var w = context.measureText(links[i].name).width + this._drawStyle.links.spacing;
        context.fillText(links[i].name, xPos + this._drawStyle.links.spacing/2, yPos);

        // Link nub
        var rect = {
          top: yPos + this._drawStyle.links.padding,
          left: xPos + w/2 - this._drawStyle.links.width/2,
          width: this._drawStyle.links.width,
          height: this._drawStyle.links.length,
        };

        context.fillStyle = (this._highlightExitLink && this._highlightExitLink.name === links[i].name && this._highlightNode === node? "cyan": links[i].meta.color);
        context.strokeStyle = "black";
        context.beginPath();
        context.moveTo(rect.left, rect.top);
        context.lineTo(rect.left + rect.width, rect.top);
        context.lineTo(rect.left + rect.width, rect.top + rect.height/2);
        context.lineTo(rect.left + rect.width/2, rect.top + rect.height);
        context.lineTo(rect.left, rect.top + rect.height/2);
        context.closePath();
        context.stroke();
        context.fill();

        // Expand the bounding rect just a little so it is easier to click.
        rect.left -= 5;
        rect.width += 10;

        result.push({
          rect: rect,
          point: {
            x: rect.left + rect.width/2,
            y: rect.top + rect.height + 1,
          },
          name: links[i].name,
        });

        xPos += w;
      }
    }

    return result;
  },

  /**
   * Measures the space to render the center area for a node.
   * @function wcPlayEditor#__drawCenter
   * @private
   * @param {wcNode} node - The node to draw.
   * @param {external:Canvas~Context} context - The canvas context.
   * @param {wcPlayEditor~Rect} rect - The bounding area to draw in.
   * @param {Boolean} [hideCollapsible] - If true, all collapsible properties will be hidden, even if the node is not collapsed.
   * @returns {wcPlayEditor~DrawPropertyData} - Contains bounding rectangles for various drawings.
   */
  __drawCenter: function(node, context, rect, hideCollapsible) {
    var upper = node.chain.entry.length? this._font.links.size + this._drawStyle.links.padding: 0;
    var lower = node.chain.exit.length? this._font.links.size + this._drawStyle.links.padding: 0;

    // Properties
    var result = {
      titleBounds:    null,
      viewportBounds: null,
      propertyBounds: [],
      valueBounds:    [],
      initialBounds:  [],
      inputBounds:    [],
      outputBounds:   [],
    };
    var linkRect;

    // Node background
    context.save();
      var left = rect.left + rect.width/2;
      var top = rect.top + (rect.height)/2;
      var gradient = context.createRadialGradient(left, top, 10, left, top, Math.max(rect.width, rect.height));
      gradient.addColorStop(0, (node.enabled()? node._meta.color: '#555'));
      gradient.addColorStop(1, "white");
      context.fillStyle = context.strokeStyle = gradient;
      context.lineJoin = "round";
      var diameter = this._drawStyle.node.radius*2;
      context.lineWidth = diameter;
      context.fillRect(rect.left + diameter/2, rect.top - upper + diameter/2, rect.width - diameter, rect.height + upper + lower - diameter);
      context.strokeRect(rect.left + diameter/2, rect.top - upper + diameter/2, rect.width - diameter, rect.height + upper + lower - diameter);
    context.restore();
    this.__drawRoundedRect({
      left: rect.left,
      top: rect.top - upper,
      width: rect.width,
      height: rect.height + upper + lower
    }, node._meta.color, 3, this._drawStyle.node.radius, context);

    // Title Upper Bar
    upper = 0;
    if (node.chain.entry.length) {
      context.strokeStyle = node._meta.color;
      context.beginPath();
      context.moveTo(rect.left, rect.top + upper);
      context.lineTo(rect.left + rect.width, rect.top + upper);
      context.stroke();
    }

    // Measure the title bar area.
    this.__setCanvasFont(this._font.title, context);
    var titleTypeWidth = context.measureText(this._drawStyle.title.wrapL + node.type + ': ').width;
    var titleWrapRWidth = context.measureText(this._drawStyle.title.wrapR).width;
    var titleTextWidth = 0;
    this.__setCanvasFont(this._font.titleDesc, context);
    titleTextWidth = context.measureText(this._drawStyle.title.nameWrapL + (node.name || this._drawStyle.title.placeholder) + this._drawStyle.title.nameWrapR).width;

    result.titleBounds = {
      top: rect.top + upper,
      left: rect.left + titleTypeWidth + (rect.width - (titleTypeWidth + titleWrapRWidth + titleTextWidth))/2,
      width: titleTextWidth,
      height: this._font.title.size + this._drawStyle.title.spacing - 1,
    };

    // Highlight title text.
    if (this._highlightTitle && this._highlightNode === node) {
      this.__drawRoundedRect(result.titleBounds, 'rgba(255, 255, 255, 0.5)', -1, this._font.title.size/2, context);
    }

    // Title Text
    context.save();
    upper += this._font.title.size;
    context.fillStyle = "black";
    context.strokeStyle = "black";
    context.textAlign = "left";
    this.__setCanvasFont(this._font.title, context);
    context.fillText(this._drawStyle.title.wrapL + node.type + ': ', rect.left + (rect.width - (titleTypeWidth + titleWrapRWidth + titleTextWidth)) / 2, rect.top + upper);

    this.__setCanvasFont(this._font.titleDesc, context);
    context.fillText(this._drawStyle.title.nameWrapL + (node.name || this._drawStyle.title.placeholder) + this._drawStyle.title.nameWrapR, rect.left + titleTypeWidth + (rect.width - (titleTypeWidth + titleWrapRWidth + titleTextWidth))/2, rect.top + upper);

    context.textAlign = "right";
    this.__setCanvasFont(this._font.title, context);
    context.fillText(this._drawStyle.title.wrapR, rect.left + rect.width - (rect.width - (titleTypeWidth + titleWrapRWidth + titleTextWidth)) / 2, rect.top + upper);
    context.restore();

    // Title Lower Bar
    upper += this._drawStyle.title.spacing;
    // context.strokeStyle = node._meta.color;
    // context.beginPath();
    // context.moveTo(rect.left, rect.top + upper);
    // context.lineTo(rect.left + rect.width, rect.top + upper);
    // context.stroke();

    // Draw the node's viewport.
    if (node._viewportSize) {
      // Calculate the translation to make the viewport 0,0.
      result.viewportBounds = {
        top: rect.top + upper,
        left: rect.left + (rect.width/2 - node._viewportSize.x/2),
        width: node._viewportSize.x,
        height: node._viewportSize.y,
      };

      context.save();
      // Translate the canvas so 0,0 is the beginning of the viewport.
      context.translate(result.viewportBounds.left, result.viewportBounds.top);

      // Draw the viewport.
      node.onViewportDraw(context);

      // Now revert the translation.
      context.translate(-result.viewportBounds.left, -result.viewportBounds.top);
      context.restore();

      upper += node._viewportSize.y + this._drawStyle.property.spacing;
    }

    context.save();
    var collapsed = node.collapsed();
    var props = node.properties;
    for (var i = 0; i < props.length; ++i) {

      // Skip properties that are collapsible if it is not chained.
      if ((!collapsed && !hideCollapsible) || !props[i].options.collapsible || props[i].inputs.length || props[i].outputs.length) {
        upper += this._font.property.size;

        // Property name.
        var propertyBound = {
          rect: {
            top: rect.top + upper - this._font.property.size,
            left: rect.left + this._drawStyle.node.margin,
            width: rect.width - this._drawStyle.node.margin * 2,
            height: this._font.property.size + this._drawStyle.property.spacing,
          },
          name: props[i].name,
        };
        result.propertyBounds.push(propertyBound);

        // Initial property value.
        var initialBound = {
          rect: {
            top: rect.top + upper - this._font.property.size,
            left: rect.left + rect.width - this._drawStyle.node.margin - rect.initialWidth,
            width: rect.initialWidth,
            height: this._font.property.size + this._drawStyle.property.spacing,
          },
          name: props[i].name,
        };
        result.initialBounds.push(initialBound);

        // Property value.
        var valueBound = {
          rect: {
            top: rect.top + upper - this._font.property.size,
            left: rect.left + rect.width - this._drawStyle.node.margin - rect.valueWidth - rect.initialWidth,
            width: rect.valueWidth,
            height: this._font.property.size + this._drawStyle.property.spacing,
          },
          name: props[i].name,
        };
        result.valueBounds.push(valueBound);

        // Highlight hovered values.
        if (this._highlightNode === node && this._highlightPropertyValue && this._highlightPropertyValue.name === props[i].name) {
          this.__drawRoundedRect(valueBound.rect, 'rgba(255, 255, 255, 0.5)', -1, this._font.property.size/2, context);
        }
        if (this._highlightNode === node && this._highlightPropertyInitialValue && this._highlightPropertyInitialValue.name === props[i].name) {
          this.__drawRoundedRect(initialBound.rect, 'rgba(255, 255, 255, 0.5)', -1, this._font.property.size/2, context);
        }

        context.fillStyle = "black";
        context.textAlign = "left";
        this.__setCanvasFont(this._font.property, context);
        context.fillText(props[i].name + ': ', rect.left + this._drawStyle.node.margin, rect.top + upper);

        context.textAlign = "right";
        this.__setCanvasFont(this._font.initialValue, context);
        context.fillStyle = "#444444";
        context.fillText(this._drawStyle.property.initialWrapL + this.__drawPropertyValue(node, props[i], true) + this._drawStyle.property.initialWrapR, rect.left + rect.width - this._drawStyle.node.margin, rect.top + upper);

        this.__setCanvasFont(this._font.value, context);
        context.fillStyle = "black";
        context.fillText(this._drawStyle.property.valueWrapL + this.__drawPropertyValue(node, props[i]) + this._drawStyle.property.valueWrapR, rect.left + rect.width - this._drawStyle.node.margin - rect.initialWidth, rect.top + upper);

        // Property input.
        if (!collapsed || props[i].inputs.length) {
          linkRect = {
            top: rect.top + upper - this._font.property.size/3 - this._drawStyle.links.width/2,
            left: rect.left - this._drawStyle.links.length,
            width: this._drawStyle.links.length,
            height: this._drawStyle.links.width,
          };

          context.fillStyle = (this._highlightInputLink && this._highlightInputLink.name === props[i].name && this._highlightNode === node? "cyan": props[i].inputMeta.color);
          context.strokeStyle = "black";
          context.beginPath();
          context.moveTo(linkRect.left, linkRect.top);
          context.lineTo(linkRect.left + linkRect.width, linkRect.top);
          context.lineTo(linkRect.left + linkRect.width, linkRect.top + linkRect.height);
          context.lineTo(linkRect.left, linkRect.top + linkRect.height);
          context.lineTo(linkRect.left + linkRect.width/3, linkRect.top + linkRect.height/2);
          context.closePath();
          context.stroke();
          context.fill();

          // Expand the bounding rect just a little so it is easier to click.
          linkRect.top -= 5;
          linkRect.height += 10;

          result.inputBounds.push({
            rect: linkRect,
            point: {
              x: linkRect.left + linkRect.width/3 - 2,
              y: linkRect.top + linkRect.height/2,
            },
            name: props[i].name,
          });
        }

        // Property output.
        if (!collapsed || props[i].outputs.length) {
          linkRect = {
            top: rect.top + upper - this._font.property.size/3 - this._drawStyle.links.width/2,
            left: rect.left + rect.width,
            width: this._drawStyle.links.length,
            height: this._drawStyle.links.width,
          }

          context.fillStyle = (this._highlightOutputLink && this._highlightOutputLink.name === props[i].name && this._highlightNode === node? "cyan": props[i].outputMeta.color);
          context.strokeStyle = "black";
          context.beginPath();
          context.moveTo(linkRect.left, linkRect.top);
          context.lineTo(linkRect.left + linkRect.width/2, linkRect.top);
          context.lineTo(linkRect.left + linkRect.width, linkRect.top + linkRect.height/2);
          context.lineTo(linkRect.left + linkRect.width/2, linkRect.top + linkRect.height);
          context.lineTo(linkRect.left, linkRect.top + linkRect.height);
          context.closePath();
          context.stroke();
          context.fill();

          // Expand the bounding rect just a little so it is easier to click.
          linkRect.top -= 5;
          linkRect.height += 10;

          result.outputBounds.push({
            rect: linkRect,
            point: {
              x: linkRect.left + linkRect.width + 1,
              y: linkRect.top + linkRect.height/2,
            },
            name: props[i].name,
          });
        }

        upper += this._drawStyle.property.spacing;
      }
    }
    context.restore();

    // Lower Bar
    if (node.chain.exit.length) {
      context.strokeStyle = node._meta.color;
      context.beginPath();
      context.moveTo(rect.left, rect.top + rect.height);
      context.lineTo(rect.left + rect.width, rect.top + rect.height);
      context.stroke();
    }
    return result;
  },

  /**
   * Draws connection chains for a list of nodes.
   * @function wcPlayEditor#__drawChains
   * @private
   * @param {wcNode[]} nodes - A list of nodes to render chains for.
   * @param {external:Canvas~Context} context - The canvas context.
   */
  __drawChains: function(nodes, context) {
    for (var i = 0; i < nodes.length; ++i) {
      this.__drawNodeChains(nodes[i], context);
    }
  },

  /**
   * Draws connection chains for a single node.
   * @function wcPlayEditor#__drawNodeChains
   * @private
   * @param {wcNode} node - A node to render chains for.
   * @param {external:Canvas~Context} context - The canvas context.
   */
  __drawNodeChains: function(node, context) {
    for (var i = 0; i < node.chain.exit.length; ++i) {
      var exitLink = node.chain.exit[i];

      // Skip links that are not chained with anything.
      if (!exitLink.links.length) {
        continue;
      }

      var exitPoint;
      // Find the corresponding meta data for this link.
      for (var a = 0; a < node._meta.bounds.exitBounds.length; ++a) {
        if (node._meta.bounds.exitBounds[a].name === exitLink.name) {
          exitPoint = node._meta.bounds.exitBounds[a].point;
          break;
        }
      }

      // Skip links that do not contain meta data (should not happen).
      if (!exitPoint) {
        console.log('ERROR: Attempted to draw chains for an exit link that has no meta data.');
        continue;
      }

      // Follow each chain to their entry links.
      for (var a = 0; a < exitLink.links.length; ++a) {
        var targetNode = exitLink.links[a].node;
        var targetName = exitLink.links[a].name;
        var entryLink;

        for (var b = 0; b < targetNode.chain.entry.length; ++b) {
          if (targetNode.chain.entry[b].name === targetName) {
            entryLink = targetNode.chain.entry[b];
            break;
          }
        }

        // The link for this chain was not found.
        if (!entryLink) {
          console.log('ERROR: Attempted to chain an exit link to an entry link that was not found.');
          continue;
        }

        // Find the corresponding meta data for this link.
        var entryPoint;
        for (var b = 0; b < targetNode._meta.bounds.entryBounds.length; ++b) {
          if (targetNode._meta.bounds.entryBounds[b].name === entryLink.name) {
            entryPoint = targetNode._meta.bounds.entryBounds[b].point;
            break;
          }
        }

        // Could not find meta data for this link.
        if (!entryPoint) {
          console.log('ERROR: Attempted to draw chains to an entry link that has no meta data.');
          continue;
        }

        var flash = (exitLink.meta.flashDelta > 0 && entryLink.meta.flashDelta > 0);

        var highlight = 
          (this._highlightNode === targetNode && this._highlightEntryLink && this._highlightEntryLink.name === entryLink.name) ||
          (this._highlightNode === node && this._highlightExitLink && this._highlightExitLink.name === exitLink.name);

        // Now we have both our links, lets chain them together!
        this.__drawFlowChain(exitPoint, entryPoint, node._meta.bounds.rect, targetNode._meta.bounds.rect, context, flash, highlight);
      }
    }

    for (var i = 0; i < node.properties.length; ++i) {
      var outputProp = node.properties[i];

      // Skip properties with no output links.
      if (!outputProp.outputs.length) {
        continue;
      }

      // Find the corresponding meta data for this link.
      var outputPoint;
      for (var a = 0; a < node._meta.bounds.outputBounds.length; ++a) {
        if (node._meta.bounds.outputBounds[a].name === outputProp.name) {
          outputPoint = node._meta.bounds.outputBounds[a].point;
          break;
        }
      }

      // Failed to find bounds for the output link.
      if (!outputPoint) {
        console.log('ERROR: Attempted to draw chains for an output link that has no meta data.');
        continue;
      }

      // Follow each chain to their input links.
      for (var a = 0; a < outputProp.outputs.length; ++a) {
        var targetNode = outputProp.outputs[a].node;
        var targetName = outputProp.outputs[a].name;
        var inputProp;

        for (var b = 0; b < targetNode.properties.length; ++b) {
          if (targetNode.properties[b].name === targetName) {
            inputProp = targetNode.properties[b];
          }
        }

        // Failed to find the input property to link with.
        if (!inputProp) {
          console.log('ERROR: Attempted to chain a property link to a property that was not found.');
          continue;
        }

        // Find the corresponding meta data for this link.
        var inputPoint;
        for (var b = 0; b < targetNode._meta.bounds.inputBounds.length; ++b) {
          if (targetNode._meta.bounds.inputBounds[b].name === inputProp.name) {
            inputPoint = targetNode._meta.bounds.inputBounds[b].point;
            break;
          }
        }

        // Failed to find the meta data for a property input link.
        if (!inputPoint) {
          console.log('ERROR: Attempted to draw chains to a property input link that has no meta data.');
          continue;
        }

        var flash = (outputProp.outputMeta.flashDelta > 0 && inputProp.inputMeta.flashDelta > 0);
        var highlight =
          (this._highlightNode === targetNode && this._highlightInputLink && this._highlightInputLink.name === inputProp.name) ||
          (this._highlightNode === node && this._highlightOutputLink && this._highlightOutputLink.name === outputProp.name);

        // Now we have both our links, lets chain them together!
        this.__drawPropertyChain(outputPoint, inputPoint, node._meta.bounds.rect, targetNode._meta.bounds.rect, context, flash, highlight);
      }
    }

    // Draw a link to the mouse cursor if we are making a connection.
    if (this._selectedNode === node && this._selectedEntryLink) {
      var targetPos;
      var targetRect = null;
      var highlight = false;
      if (this._highlightNode && this._highlightExitLink) {
        targetPos = this._highlightExitLink.point;
        targetRect = this._highlightExitLink.rect;
        highlight = true;
      } else {
        targetPos = {
          x: (this._mouse.x - this._viewportCamera.x) / this._viewportCamera.z,
          y: (this._mouse.y - this._viewportCamera.y) / this._viewportCamera.z,
        };
        targetRect = {
          left: targetPos.x,
          top: targetPos.y,
          width: 1,
          height: 1,
        };
      }

      // In case our selected node gets uncollapsed, get the current position of the link.
      var point;
      for (var i = 0; i < node._meta.bounds.entryBounds.length; ++i) {
        if (node._meta.bounds.entryBounds[i].name === this._selectedEntryLink.name) {
          point = node._meta.bounds.entryBounds[i].point;
        }
      }

      this.__drawFlowChain(targetPos, point, targetRect, node._meta.bounds.rect, context, highlight);
    }

    if (this._selectedNode === node && this._selectedExitLink) {
      var targetPos;
      var targetRect = null;
      var highlight = false;
      if (this._highlightNode && this._highlightEntryLink) {
        targetPos = this._highlightEntryLink.point;
        targetRect = this._highlightEntryLink.rect;
        highlight = true;
      } else {
        targetPos = {
          x: (this._mouse.x - this._viewportCamera.x) / this._viewportCamera.z,
          y: (this._mouse.y - this._viewportCamera.y) / this._viewportCamera.z,
        };
        targetRect = {
          left: targetPos.x,
          top: targetPos.y,
          width: 1,
          height: 1,
        };
      }

      // In case our selected node gets uncollapsed, get the current position of the link.
      var point;
      for (var i = 0; i < node._meta.bounds.exitBounds.length; ++i) {
        if (node._meta.bounds.exitBounds[i].name === this._selectedExitLink.name) {
          point = node._meta.bounds.exitBounds[i].point;
        }
      }

      this.__drawFlowChain(point, targetPos, node._meta.bounds.rect, targetRect, context, highlight);
    }

    if (this._selectedNode === node && this._selectedInputLink) {
      var targetPos;
      var targetRect = null;
      var highlight = false;
      if (this._highlightNode && this._highlightOutputLink) {
        targetPos = this._highlightOutputLink.point;
        targetRect = this._highlightOutputLink.rect;
        highlight = true;
      } else {
        targetPos = {
          x: (this._mouse.x - this._viewportCamera.x) / this._viewportCamera.z,
          y: (this._mouse.y - this._viewportCamera.y) / this._viewportCamera.z,
        };
        targetRect = {
          left: targetPos.x,
          top: targetPos.y,
          width: 1,
          height: 1,
        };
      }

      // In case our selected node gets uncollapsed, get the current position of the link.
      var point;
      for (var i = 0; i < node._meta.bounds.inputBounds.length; ++i) {
        if (node._meta.bounds.inputBounds[i].name === this._selectedInputLink.name) {
          point = node._meta.bounds.inputBounds[i].point;
        }
      }

      this.__drawPropertyChain(targetPos, point, targetRect, node._meta.bounds.rect, context, highlight);
    }

    if (this._selectedNode === node && this._selectedOutputLink) {
      var targetPos;
      var targetRect = null;
      var highlight = false;
      if (this._highlightNode && this._highlightInputLink) {
        targetPos = this._highlightInputLink.point;
        targetRect = this._highlightInputLink.rect;
        highlight = true;
      } else {
        targetPos = {
          x: (this._mouse.x - this._viewportCamera.x) / this._viewportCamera.z,
          y: (this._mouse.y - this._viewportCamera.y) / this._viewportCamera.z,
        };
        targetRect = {
          left: targetPos.x,
          top: targetPos.y,
          width: 1,
          height: 1,
        };
      }

      // In case our selected node gets uncollapsed, get the current position of the link.
      var point;
      for (var i = 0; i < node._meta.bounds.outputBounds.length; ++i) {
        if (node._meta.bounds.outputBounds[i].name === this._selectedOutputLink.name) {
          point = node._meta.bounds.outputBounds[i].point;
        }
      }

      this.__drawPropertyChain(point, targetPos, node._meta.bounds.rect, targetRect, context, highlight);
    }
  },

  /**
   * Draws a connection chain between an exit link and an entry link.
   * @function wcPlayEditor#__drawFlowChain
   * @private
   * @param {wcPlay~Coordinates} startPos - The start position (the exit link).
   * @param {wcPlay~Coordinates} endPos - The end position (the entry link).
   * @param {wcPlayEditor~Rect} startRect - The start node's bounding rect to avoid.
   * @param {wcPlayEditor~Rect} endPos - The end node's bounding rect to avoid.
   * @param {Boolean} [flash] - If true, will flash the link.
   * @param {external:Canvas~Context} context - The canvas context.
   */
  __drawFlowChain: function(startPos, endPos, startRect, endRect, context, flash, highlight) {
    context.save();
    context.strokeStyle = (highlight? 'cyan': (flash? '#CCCC00': '#000000'));
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(startPos.x, startPos.y);

    var coreRadius = 15;

    // If the exit link is above the entry link
    if (startPos.y < endPos.y) {
      var midx = (endPos.x + startPos.x) / 2;
      var midy = (endPos.y + startPos.y) / 2;
      var radius = Math.min(coreRadius, Math.abs(endPos.x - startPos.x)/2, Math.abs(endPos.y - startPos.y)/2);
      context.arcTo(startPos.x, midy, midx, midy, radius);
      context.arcTo(endPos.x, midy, endPos.x, endPos.y, radius);
    }
    // If the start rect is to the left side of the end rect.
    else if (startRect.left + startRect.width < endRect.left) {
      var midx = (endRect.left + startRect.left + startRect.width) / 2 - 2;
      var midy = (endPos.y + startPos.y) / 2;
      var leftx = (midx + startPos.x) / 2;
      var rightx = (endPos.x + midx) / 2;
      var radius = Math.min(coreRadius, Math.abs(endPos.y - startPos.y)/4, Math.abs(midx - leftx), Math.abs(midx - rightx));
      context.arcTo(startPos.x, startPos.y + radius, leftx, startPos.y + radius, radius);
      context.arcTo(midx, startPos.y + radius, midx, midy, radius);
      context.arcTo(midx, endPos.y - radius, rightx, endPos.y - radius, radius);
      context.arcTo(endPos.x, endPos.y - radius, endPos.x, endPos.y, radius);
    }
    // If the start rect is to the right side of the end rect.
    else if (startRect.left > endRect.left + endRect.width) {
      var midx = (startRect.left + endRect.left + endRect.width) / 2 + 2;
      var midy = (endPos.y + startPos.y) / 2;
      var leftx = (midx + endPos.x) / 2;
      var rightx = (startPos.x + midx) / 2;
      var radius = Math.min(coreRadius, Math.abs(endPos.y - startPos.y)/4, Math.abs(midx - leftx), Math.abs(midx - rightx));
      context.arcTo(startPos.x, startPos.y + radius, rightx, startPos.y + radius, radius);
      context.arcTo(midx, startPos.y + radius, midx, midy, radius);
      context.arcTo(midx, endPos.y - radius, leftx, endPos.y - radius, radius);
      context.arcTo(endPos.x, endPos.y - radius, endPos.x, endPos.y, radius);
    }
    // If the start link is below the end link. Makes a loop around the nodes.
    else if (startPos.y > endPos.y && Math.abs(startPos.y - endPos.y) > this._drawStyle.links.length) {
      var x = startPos.x;
      var top = Math.min(startRect.top - coreRadius, endRect.top - coreRadius);
      var bottom = Math.max(startRect.top + startRect.height + coreRadius, endRect.top + endRect.height + coreRadius);
      var midy = (startPos.y + endPos.y) / 2;
      // Choose left or right.
      if (Math.abs(Math.min(startRect.left, endRect.left) - startPos.x) <= Math.abs(Math.max(startRect.left + startRect.width, endRect.left + endRect.width) - endPos.x)) {
        // Left
        x = Math.min(startRect.left - coreRadius, endRect.left - coreRadius);
        bottom -= 2;
      } else {
        // Right
        x = Math.max(startRect.left + startRect.width + coreRadius, endRect.left + endRect.width + coreRadius);
        bottom += 2;
      }
      var midx = (startPos.x + x) / 2;
      var radius = Math.min(coreRadius, Math.abs(x - startPos.x)/2, Math.abs(x - endPos.x)/2);

      context.arcTo(startPos.x, bottom, midx, bottom, radius);
      context.arcTo(x, bottom, x, midy, radius);
      context.arcTo(x, top, midx, top, radius);
      context.arcTo(endPos.x, top, endPos.x, endPos.y, radius);
    }

    // Finish our line to the end position.
    context.lineTo(endPos.x, endPos.y);
    context.stroke();
    context.restore();
  },

  /**
   * Draws a connection chain between an input link and an output link of properties.
   * @function wcPlayEditor#__drawPropertyChain
   * @private
   * @param {wcPlay~Coordinates} startPos - The start position (the exit link).
   * @param {wcPlay~Coordinates} endPos - The end position (the entry link).
   * @param {wcPlayEditor~Rect} startRect - The start node's bounding rect to avoid.
   * @param {wcPlayEditor~Rect} endPos - The end node's bounding rect to avoid.
   * @param {Boolean} [flash] - If true, will flash the link.
   * @param {external:Canvas~Context} context - The canvas context.
   */
  __drawPropertyChain: function(startPos, endPos, startRect, endRect, context, flash, highlight) {
    context.save();
    context.strokeStyle = (highlight? 'cyan': (flash? '#AAFF33': '#33CC33'));
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(startPos.x, startPos.y);

    var coreRadius = 15;

    // If the output link is to the right the input link
    if (startPos.x < endPos.x) {
      var midx = (endPos.x + startPos.x) / 2;
      var midy = (endPos.y + startPos.y) / 2;
      var radius = Math.min(coreRadius, Math.abs(endPos.x - startPos.x)/2, Math.abs(endPos.y - startPos.y)/2);
      context.arcTo(midx, startPos.y, midx, midy, radius);
      context.arcTo(midx, endPos.y, endPos.x, endPos.y, radius);
    }
    // If the start rect is below the end rect.
    else if (startRect.top + startRect.height < endRect.top) {
      var midx = (endPos.x + startPos.x) / 2;
      var midy = (endRect.top + startRect.top + startRect.height) / 2 - 2;
      var topy = (midy + startPos.y) / 2;
      var bottomy = (endPos.y + midy) / 2;
      var radius = Math.min(coreRadius, Math.abs(endPos.x - startPos.x)/4, Math.abs(midy - topy), Math.abs(midy - bottomy));
      context.arcTo(startPos.x + radius, startPos.y, startPos.x + radius, topy, radius);
      context.arcTo(startPos.x + radius, midy, midx, midy, radius);
      context.arcTo(endPos.x - radius, midy, endPos.x - radius, bottomy, radius);
      context.arcTo(endPos.x - radius, endPos.y, endPos.x, endPos.y, radius);
    }
    // If the start rect above the end rect.
    else if (startRect.top > endRect.top + endRect.height) {
      var midx = (endPos.x + startPos.x) / 2;
      var midy = (startRect.top + endRect.top + endRect.height) / 2 + 2;
      var topy = (midy + endPos.y) / 2;
      var bottomy = (startPos.y + midy) / 2;
      var radius = Math.min(coreRadius, Math.abs(endPos.x - startPos.x)/4, Math.abs(midy - topy), Math.abs(midy - bottomy));
      context.arcTo(startPos.x + radius, startPos.y, startPos.x + radius, bottomy, radius);
      context.arcTo(startPos.x + radius, midy, midx, midy, radius);
      context.arcTo(endPos.x - radius, midy, endPos.x - radius, topy, radius);
      context.arcTo(endPos.x - radius, endPos.y, endPos.x, endPos.y, radius);
    }
    // If the start link is to the right of the end link.
    else if (startPos.x > endPos.x && Math.abs(startPos.x - endPos.x) > this._drawStyle.links.length) {
      var y = startPos.y;
      var right = Math.max(startRect.left + startRect.width + coreRadius, endRect.left + endRect.width + coreRadius);
      var left = Math.min(startRect.left - coreRadius, endRect.left - coreRadius);
      var midx = (startPos.x + endPos.x) / 2;
      // Choose top or bottom.
      if (Math.abs(Math.min(startRect.top, endRect.top) - startPos.y) <= Math.abs(Math.max(startRect.top + startRect.height, endRect.top + endRect.height) - endPos.y)) {
        // Top
        y = Math.min(startRect.top - coreRadius, endRect.top - coreRadius);
        right -= 2;
      } else {
        // Bottom
        y = Math.max(startRect.top + startRect.height + coreRadius, endRect.top + endRect.height + coreRadius);
        right += 2;
      }
      var midy = (startPos.y + y) / 2;
      var radius = Math.min(coreRadius, Math.abs(y - startPos.y)/2, Math.abs(y - endPos.y)/2);

      context.arcTo(right, startPos.y, right, midy, radius);
      context.arcTo(right, y, midx, y, radius);
      context.arcTo(left, y, left, midy, radius);
      context.arcTo(left, endPos.y, endPos.x, endPos.y, radius);
    }

    context.lineTo(endPos.x, endPos.y);
    context.stroke();
    context.restore();
  },

  /**
   * Draws the value of a property embedded on the node.
   * @function wcPlayEditor#__drawPropertyValue
   * @private
   * @param {wcNode} node - The node that owns this property.
   * @param {Object} property - The property data.
   * @param {Boolean} [initial] - Set true if the property being viewed is the initial value.
   * @returns {String} - A string value to print as the value.
   *
   * @see {wcNode~wcNode~PropertyOptions}
   * @see {wcNode~PropertyDisplay}
   */
  __drawPropertyValue: function(node, property, initial) {
    var value;
    if (initial) {
      value = node.initialProperty(property.name);
    } else {
      value = node.property(property.name);
    }

    if (typeof property.options.display === 'function') {
      value = property.options.display(value);
    } else {
      // Handle custom display of certain property types.
      switch (property.type) {
        case wcPlay.PROPERTY_TYPE.TOGGLE:
          // Display toggle buttons as 'yes', 'no'
          return (value? 'yes': 'no');
        case wcPlay.PROPERTY_TYPE.SELECT:
          if (value == '') {
            return '<none>';
          }
          var items = property.options.items;
          if ($.isFunction(items)) {
            items = items.call(node);
          }

          if ($.isArray(items)) {
            var found = false;
            for (var i = 0; i < items.length; ++i) {
              if (typeof items[i] === 'object') {
                if (items[i].value == value) {
                  value = items[i].name;
                  found = true;
                  break;
                }
              } else if (typeof items[i] === 'string') {
                if (items[i] == value) {
                  found = true;
                  break;
                }
              }
            }

            if (!found) {
              value = 'Unknown';
            }
          }
          break;
      }
    }

    return this.__clampString(value.toString(), this._drawStyle.property.strLen)
  },

  /**
   * Draws the editor control for the title of the node.
   * @function wcPlayEditor#__drawTitleEditor
   * @private
   * @param {wcNode} node - The node to draw for.
   * @param {wcPlayEditor~BoundingData} bounds - The bounding data for the title.
   */
  __drawTitleEditor: function(node, bounds) {
    var self = this;
    var cancelled = false;

    var $control = $('<input type="text">');
    $control.val(node.name);
    $control.change(function() {
      if (!cancelled) {
        self._undoManager && self._undoManager.addEvent('Title changed for Node "' + node.category + '.' + node.type + '"',
        {
          id: node.id,
          oldValue: node.name,
          newValue: $control.val(),
          editor: self,
        },
        // Undo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var oldName = myNode.name;
          var newName = myNode.onNameChanging(oldName, this.oldValue);
          if (newName === undefined) {
            newName = this.oldValue;
          }
          myNode.name = newName;
          myNode.onNameChanged(oldName, newName);
        },
        // Redo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var oldName = myNode.name;
          var newName = myNode.onNameChanging(oldName, this.newValue);
          if (newName === undefined) {
            newName = this.newValue;
          }
          myNode.name = newName;
          myNode.onNameChanged(oldName, newName);
        });

        var oldName = node.name;
        var newName = node.onNameChanging(oldName, $control.val());
        if (newName === undefined) {
          newName = $control.val();
        }
        node.name = newName;
        node.onNameChanged(oldName, newName);
      }
    });

    var offset = {
      top: 0,
      left: this.$palette.width(),
    };

    this.$main.append($control);

    $control.addClass('wcPlayEditorControl');
    $control.focus();
    $control.select();

    // Clicking away will close the editor control.
    $control.blur(function() {
      $(this).remove();
    });

    $control.keyup(function(event) {
      switch (event.keyCode) {
        case 13: // Enter to confirm.
          $control.blur();
          break;
        case 27: // Escape to cancel.
          cancelled = true;
          $control.blur();
          break;
      }
      return false;
    });

    $control.css('top', offset.top + bounds.top * this._viewportCamera.z + this._viewportCamera.y)
      .css('left', offset.left + bounds.left * this._viewportCamera.z + this._viewportCamera.x)
      .css('width', Math.max(bounds.width * this._viewportCamera.z, 200))
      .css('height', Math.max(bounds.height * this._viewportCamera.z, 15));
  },

  /**
   * Draws the editor control for a property.
   * @function wcPlayEditor#__drawPropertyEditor
   * @private
   * @param {wcNode} node - The node to draw for.
   * @param {Object} property - The property data.
   * @param {wcPlayEditor~BoundingData} bounds - The bounding data for this property.
   * @param {Boolean} [initial] - Set true if the property being changed is the initial value.
   */
  __drawPropertyEditor: function(node, property, bounds, initial) {
    var $control = null;
    var cancelled = false;
    var enterConfirms = true;
    var propFn = (initial? 'initialProperty': 'property');

    var type = property.type;
    // if (type === wcPlay.PROPERTY_TYPE.DYNAMIC) {
    //   var value = node.property(property.name);
    //   if (typeof value === 'string') {
    //     type = wcPlay.PROPERTY_TYPE.STRING;
    //   } else if (typeof value === 'bool') {
    //     type = wcPlay.PROPERTY_TYPE.TOGGLE;
    //   } else if (typeof value === 'number') {
    //     type = wcPlay.PROPERTY_TYPE.NUMBER;
    //   }
    // }

    var self = this;
    function undoChange(node, name, oldValue, newValue) {
      self._undoManager && self._undoManager.addEvent('Property "' + name + '" changed for Node "' + node.category + '.' + node.type + '"',
      {
        id: node.id,
        name: name,
        propFn: propFn,
        oldValue: oldValue,
        newValue: newValue,
        editor: self,
      },
      // Undo
      function() {
        var myNode = this.editor._engine.nodeById(this.id);
        myNode[this.propFn](this.name, this.oldValue);
      },
      // Redo
      function() {
        var myNode = this.editor._engine.nodeById(this.id);
        myNode[this.propFn](this.name, this.newValue);
      });
    };

    // Determine what editor to use for the property.
    switch (type) {
      case wcPlay.PROPERTY_TYPE.TOGGLE:
        // Toggles do not show an editor, instead, they just toggle their state.
        var state = node[propFn](property.name);
        undoChange(node, property.name, state, !state);
        node[propFn](property.name, !state);
        break;
      case wcPlay.PROPERTY_TYPE.NUMBER:
        $control = $('<input type="number"' + (property.options.min? ' min="' + property.options.min + '"': '') + (property.options.max? ' max="' + property.options.max + '"': '') + (property.options.step? ' step="' + property.options.step + '"': '') + '>');
        $control.val(parseFloat(node[propFn](property.name)));
        $control.change(function() {
          if (!cancelled) {
            var min = $(this).attr('min') !== undefined? parseInt($(this).attr('min')): -Infinity;
            var max = $(this).attr('max') !== undefined? parseInt($(this).attr('max')):  Infinity;
            value = Math.min(max, Math.max(min, parseInt($control.val())));
            undoChange(node, property.name, node[propFn](property.name), value);
            node[propFn](property.name, value);
          }
        });
        break;
      case wcPlay.PROPERTY_TYPE.STRING:
      case wcPlay.PROPERTY_TYPE.DYNAMIC:
        if (property.options.multiline) {
          $control = $('<textarea' + (property.options.maxlength? ' maxlength="' + property.options.maxlength + '"': '') + '>');
          enterConfirms = false;
        } else {
          $control = $('<input type="text" maxlength="' + (property.options.maxlength || 524288) + '">');
        }
        $control.val(node[propFn](property.name).toString());
        $control.change(function() {
          if (!cancelled) {
            undoChange(node, property.name, node[propFn](property.name), $control.val());
            node[propFn](property.name, $control.val());
          }
        });
        break;
      case wcPlay.PROPERTY_TYPE.SELECT:
        var value = node[propFn](property.name);
        $control = $('<select>');

        var items = property.options.items;
        if ($.isFunction(items)) {
          items = items.call(node);
        }

        if ($.isArray(items)) {
          $control.append($('<option value=""' + ('' == value? ' selected': '') + '>&lt;none&gt;</option>'));
          for (var i = 0; i < items.length; ++i) {
            if (typeof items[i] === 'object') {
              $control.append($('<option value="' + items[i].value + '"' + (items[i].value == value? ' selected': '') + '>' + items[i].name + '</option>'));
            } else {
              $control.append($('<option value="' + items[i] + '"' + (items[i] == value? ' selected': '') + '>' + items[i] + '</option>'));
            }
          }
        } else {
          console.log("ERROR: Tried to display a Select type property when no selection list was provided.");
          return;
        }

        $control.change(function() {
          if (!cancelled) {
            undoChange(node, property.name, node[propFn](property.name), $control.val());
            node[propFn](property.name, $control.val());
            $(this).blur();
          }
        });
        break;
    }

    if ($control) {
      var offset = {
        top: 0,
        left: this.$palette.width(),
      };

      this.$main.append($control);

      $control.addClass('wcPlayEditorControl');
      $control.focus();
      $control.select();

      // Clicking away will close the editor control.
      $control.blur(function() {
        $(this).remove();
      });

      $control.keyup(function(event) {
        switch (event.keyCode) {
          case 13: // Enter to confirm.
            if (enterConfirms || event.ctrlKey) {
              $control.blur();
            }
            break;
          case 27: // Escape to cancel.
            cancelled = true;
            $control.blur();
            break;
        }
        return false;
      });

      $control.css('top', offset.top + bounds.rect.top * this._viewportCamera.z + this._viewportCamera.y)
        .css('left', offset.left + bounds.rect.left * this._viewportCamera.z + this._viewportCamera.x)
        .css('width', Math.max(bounds.rect.width * this._viewportCamera.z, 200))
        .css('height', Math.max(bounds.rect.height * this._viewportCamera.z, 15));
    }
  },

  /**
   * Generates an undo event for a node that was created.
   * @function wcPlayEditor#__onCreateNode
   * @param {wcNode} node - The node that was created.
   * @param {Boolean} [decompile] - If true, will also decompile the node if able.
   */
  __onCreateNode: function(node, decompile) {
    this._undoManager && this._undoManager.addEvent('Created Node "' + node.category + '.' + node.type + '"',
    {
      id: node.id,
      className: node.className,
      pos: {
        x: node.pos.x,
        y: node.pos.y,
      },
      decompile: decompile,
      data: node.export(),
      editor: this,
      parent: this._parent,
    },
    // Undo
    function() {
      var myNode = this.editor._engine.nodeById(this.id);

      // If we are viewing a script inside the node that is being removed, re-direct our view to its parents.
      var parent = this.editor._parent;
      while (!(parent instanceof wcPlay)) {
        if (parent == myNode) {
          this.editor._parent = myNode._parent;
          this.editor.center();
          break;
        }

        parent = parent._parent;
      }

      // Now destroy this node.
      myNode.destroy();
    },
    // Redo
    function() {
      var myNode = new window[this.className](this.parent, this.pos);
      myNode.id = this.id;
      if (this.decompile && myNode.decompile) {
        myNode.decompile();
      }
      myNode.import(this.data);
    });
  },

  /**
   * Generates an undo event for a node that is destroyed.
   * @function wcPlayEditor#__onDestroyNode
   * @param {wcNode} node - the node to destroy.
   */
  __onDestroyNode: function(node) {
    this._undoManager && this._undoManager.addEvent('',
    {
      data: node.export(),
      parent: this._parent,
      editor: this,
    },
    // Undo
    function() {
      var myNode = new window[this.data.className](this.parent, this.data.pos);
      myNode.import(this.data);
    },
    // Redo
    function() {
      var myNode = this.editor._engine.nodeById(this.data.id);

      // If we are viewing a script inside the node that is being removed, re-direct our view to its parents.
      var parent = this.editor._parent;
      while (!(parent instanceof wcPlay)) {
        if (parent == myNode) {
          this.editor._parent = myNode._parent;
          this.editor.center();
          break;
        }

        parent = parent._parent;
      }

      // Now destroy this node.
      myNode.destroy();
    });
  },

  /**
   * Initializes user control.
   * @funciton wcPlayEditor#__setupControls
   * @private
   */
  __setupControls: function() {
    var self = this;

    // Menu
    // Setup events.
    $('ul.wcPlayEditorMenu > li').on('mouseenter', this.__onMenuMouseEnter);
    $('ul.wcPlayEditorMenu > li > ul').on('click', this.__onMenuClicked);
    $('ul.wcPlayEditorMenu > li').on('mouseleave', this.__onMenuMouseLeave);
    $('ul.wcPlayEditorMenu > li > ul').on('mouseleave', this.__onSubMenuMouseLeave);
    this.__bindMenuHandlers();

    // Palette
    this.$palette.on('mousemove',  function(event){self.__onPaletteMouseMove(event, this);});
    this.$palette.on('mousedown',  function(event){self.__onPaletteMouseDown(event, this);});
    this.$palette.on('mouseup',  function(event){self.__onPaletteMouseUp(event, this);});

    // Viewport
    this.$viewport.on('mousemove',  function(event){self.__onViewportMouseMove(event, this);});
    this.$viewport.on('mousedown',  function(event){self.__onViewportMouseDown(event, this);});
    this.$viewport.on('click',      function(event){self.__onViewportMouseClick(event, this);});
    this.$viewport.on('dblclick',   function(event){self.__onViewportMouseDoubleClick(event, this);});
    this.$viewport.on('mouseup',    function(event){self.__onViewportMouseUp(event, this);});
    // this.$viewport.on('mouseleave', function(event){self.__onViewportMouseUp(event, this);});
    this.$viewport.on('mousewheel DOMMouseScroll', function(event) {self.__onViewportMouseWheel(event, this);});

    $('body').keyup(function(event) {self.__onKey(event, this);});
  },

  /**
   * Handle key press events.
   * @function wcPlayEditor#__onKey
   * @private
   * @param {Object} event - The mouse event.
   * @param {Object} elem - The target element.
   */
  __onKey: function(event, elem) {
    switch (event.keyCode) {
      case 46: // Delete key to delete selected nodes.
        $('.wcPlayEditorMenuOptionDelete').first().click();
        break;
      case 'Z'.charCodeAt(0): // Ctrl+Z to undo last action.
        if (event.ctrlKey && !event.shiftKey) {
          $('.wcPlayEditorMenuOptionUndo').first().click();
        }
        if (!event.shiftKey) {
          break;
        }
      case 'Y'.charCodeAt(0): // Ctrl+Shift+Z or Ctrl+Y to redo action.
        if (event.ctrlKey) {
          $('.wcPlayEditorMenuOptionRedo').first().click();
        }
        break;
      case 32: // Space to step
        $('.wcPlayEditorMenuOptionStep').first().click();
        break;
      case 13: // Enter to continue;
        $('.wcPlayEditorMenuOptionPausePlay').first().click();
        break;
      case 'F'.charCodeAt(0): // F to focus on selected nodes, or entire view.
        if (this._selectedNodes.length) {
          this.focus(this._selectedNodes);
        } else {
          this.center();
        }
        break;
      case 'O'.charCodeAt(0): // O to step outside of a Composite Node.
        $('.wcPlayEditorMenuOptionCompositeExit').first().click();
        break;
      case 'I'.charCodeAt(0): // O to step outside of a Composite Node.
        $('.wcPlayEditorMenuOptionCompositeEnter').first().click();
        break;
      case 'C'.charCodeAt(0): // C to create a Composite node from the selected nodes.
        $('.wcPlayEditorMenuOptionComposite').first().click();
        break;
    }
  },

  /**
   * Mouse over an menu option on the top bar to open it.
   * @function wcPlayEditor#__onMenuMouseEnter
   * @private
   * @param {Object} event - The mouse event.
   */
  __onMenuMouseEnter: function(event) {
    var $self = $(this);
    setTimeout(function() {
      if ($self.is(':hover')) {
        $self.addClass('wcPlayEditorMenuOpen').addClass('wcMenuItemHover');
      }
    }, 100);
  },

  /**
   * Clicking a menu item will also hide that menu.
   * @function wcPlayEditor#__onMenuClicked
   * @private
   * @param {Object} event - The mouse event.
   */
  __onMenuClicked: function() {
    // Clicking a menu item will also hide that menu.
    $('ul.wcPlayEditorMenu li ul').css('display', 'none');
    setTimeout(function() {
      $('ul.wcPlayEditorMenu li ul').css('display', '');
    }, 200);
  },

  /**
   * Leaving the popup menu will hide it.
   * @function wcPlayEditor#__onMenuMouseLeave
   * @private
   * @param {Object} event - The mouse event.
   */
  __onMenuMouseLeave: function(event) {
    if ($(this).find(event.toElement).length === 0) {
      $(this).removeClass('wcPlayEditorMenuOpen').removeClass('wcMenuItemHover');
    }
  },

  /**
   * Moving your mouse cursor away from the drop down menu will also hide it.
   * @function wcPlayEditor#__onSubMenuMouseLeave
   * @private
   * @param {Object} event - The mouse event.
   */
  __onSubMenuMouseLeave: function(event) {
    // Make sure that we are actually leaving the menu
    // and not just jumping to another item in the menu
    $parent = $(this).parent();
    if ($parent.find(event.toElement).length === 0) {
      $parent.removeClass('wcPlayEditorMenuOpen').removeClass('wcMenuItemHover');
    }
  },

  /**
   * Binds click event handlers to each of the options in the menu and toolbar.
   * @function wcPlayEditor#__bindMenuHandlers
   * @private
   */
  __bindMenuHandlers: function() {
    var self = this;

    var $body = $('body');

    // Catch any disabled menu clicks and stop them from executing.
    $body.on('click', '.wcPlayMenuItem.disabled', function(event) {
      event.stopPropagation();
      event.preventDefault();
      return false;
    });

    // File menu
    $body.on('click', '.wcPlayEditorMenuOptionNew', function() {
      if (self._engine) {
        self._engine.clear();
        self._parent = self._engine;
      }
    });
    $body.on('click', '.wcPlayEditorMenuOptionOpen', function() {
      // TODO:
    });
    $body.on('click', '.wcPlayEditorMenuOptionSave', function() {
      // TODO:
    });

    // Edit menu
    $body.on('click', '.wcPlayEditorMenuOptionUndo', function() {
      self._undoManager && self._undoManager.undo();
    });
    $body.on('click', '.wcPlayEditorMenuOptionRedo', function() {
      self._undoManager && self._undoManager.redo();
    });

    $body.on('click', '.wcPlayEditorMenuOptionDelete', function() {
      if (self._selectedNodes.length) {
        self._undoManager && self._undoManager.beginGroup('Removed Nodes');
        for (var i = 0; i < self._selectedNodes.length; ++i) {
          self.__onDestroyNode(self._selectedNodes[i]);
          self._selectedNodes[i].destroy();
        }
        self._selectedNode = null;
        self._selectedNodes = [];
        self._undoManager && self._undoManager.endGroup();
      }
    });

    $body.on('click', '.wcPlayEditorMenuOptionComposite', function() {
      if (self._selectedNodes.length && self._parent) {
        // Find a unique class name to use for this new composite node.
        var index = 0;
        var number = '';
        var className = '';
        do {
          index++
          number = '0000'.substr(0, 4-('' + index).length) + index;
          className = 'wcNodeCompositeScript' + number;
        } while (window[className]);

        // Dynamically extend a new composite node class.
        wcNodeCompositeScript.extend(className, 'Composite', '__Custom__', {
          name: number,
        });

        self._undoManager && self._undoManager.beginGroup("Combined Nodes into Composite: " + number);
        // Create undo events for removing the selected nodes.
        for (var i = 0; i < self._selectedNodes.length; ++i) {
          self.__onDestroyNode(self._selectedNodes[i]);

          // Now give this node a new ID so it is treated like a different node.
          self._selectedNodes[i].id = ++wcNodeNextID;
        }

        var compNode = new window[className](self._parent, {x: 0, y: 0}, self._selectedNodes);

        // Calculate the bounding box of all moved nodes.
        var boundList = [];
        for (var i = 0; i < self._selectedNodes.length; ++i) {
          var node = self._selectedNodes[i];

          boundList.push(node._meta.bounds.farRect);
        }
        var bounds = self.__expandRect(boundList);

        var exportedNodes = [];
        for (var i = 0; i < self._selectedNodes.length; ++i) {
          var node = self._selectedNodes[i];

          // The node was already moved to the composite node, now remove it from the parent object.
          self._parent.__removeNode(node);

          // Find all chains that connect to an external node.
          var entryChains = node.listEntryChains(undefined, self._selectedNodes);
          var exitChains = node.listExitChains(undefined, self._selectedNodes);
          var inputChains = node.listInputChains(undefined, self._selectedNodes);
          var outputChains = node.listOutputChains(undefined, self._selectedNodes);

          // External entry chains.
          var createdLinks = [];
          for (var a = 0; a < entryChains.length; ++a) {
            var targetNode = self._engine.nodeById(entryChains[a].outNodeId);
            var targetName = entryChains[a].outName;
            var node = self._engine.nodeById(entryChains[a].inNodeId);
            var linkName = entryChains[a].inName;

            // Make sure we only create one Composite Entry per link.
            var linkNode = null;
            for (var b = 0; b < createdLinks.length; ++b) {
              if (createdLinks[b].name === linkName) {
                linkNode = createdLinks[b].node;
                break;
              }
            }
            if (!linkNode) {
              // Create a Composite Entry Node, this acts as a surrogate entry link for the Composite node.
              linkNode = new wcNodeCompositeEntry(compNode, {x: node.pos.x, y: bounds.top - 100}, linkName);
              linkNode.collapsed(true);
              createdLinks.push({
                name: linkName,
                node: linkNode,
              });
            }

            linkNode.connectExit('out', node, linkName);
            compNode.connectEntry(linkNode.name, targetNode, targetName);
            targetNode.disconnectExit(targetName, node, linkName);
          }

          // External exit chains.
          createdLinks = [];
          for (var a = 0; a < exitChains.length; ++a) {
            var targetNode = self._engine.nodeById(exitChains[a].inNodeId);
            var targetName = exitChains[a].inName;
            var node = self._engine.nodeById(exitChains[a].outNodeId);
            var linkName = exitChains[a].outName;

            // Make sure we only create one Composite Entry per link.
            var linkNode = null;
            for (var b = 0; b < createdLinks.length; ++b) {
              if (createdLinks[b].name === linkName) {
                linkNode = createdLinks[b].node;
                break;
              }
            }
            if (!linkNode) {
              // Create a Composite Exit Node, this acts as a surrogate exit link for the Composite node.
              linkNode = new wcNodeCompositeExit(compNode, {x: node.pos.x, y: bounds.top + bounds.height + 50}, linkName);
              linkNode.collapsed(true);
              createdLinks.push({
                name: linkName,
                node: linkNode,
              });
            }

            linkNode.connectEntry('in', node, linkName);
            compNode.connectExit(linkNode.name, targetNode, targetName);
            targetNode.disconnectEntry(targetName, node, linkName);
          }

          // External property input chains.
          createdLinks = [];
          for (var a = 0; a < inputChains.length; ++a) {
            var targetNode = self._engine.nodeById(inputChains[a].outNodeId);
            var targetName = inputChains[a].outName;
            var node = self._engine.nodeById(inputChains[a].inNodeId);
            var linkName = inputChains[a].inName;

            // Make sure we only create one Composite Entry per link.
            var linkNode = null;
            for (var b = 0; b < createdLinks.length; ++b) {
              if (createdLinks[b].name === linkName) {
                linkNode = createdLinks[b].node;
                break;
              }
            }
            if (!linkNode) {
              // Create a Composite Property Node, this acts as a surrogate property link for the Composite node.
              linkNode = new wcNodeCompositeProperty(compNode, {x: bounds.left - 200, y: node.pos.y}, linkName);
              linkNode.collapsed(true);
              createdLinks.push({
                name: linkName,
                node: linkNode,
              });
            }

            linkNode.connectOutput('value', node, linkName);
            compNode.connectInput(linkNode.name, targetNode, targetName);
            targetNode.disconnectOutput(targetName, node, linkName);
          }

          // External property output chains.
          createdLinks = [];
          for (var a = 0; a < outputChains.length; ++a) {
            var targetNode = self._engine.nodeById(outputChains[a].inNodeId);
            var targetName = outputChains[a].inName;
            var node = self._engine.nodeById(outputChains[a].outNodeId);
            var linkName = outputChains[a].outName;

            // Make sure we only create one Composite Entry per link.
            var linkNode = null;
            for (var b = 0; b < createdLinks.length; ++b) {
              if (createdLinks[b].name === linkName) {
                linkNode = createdLinks[b].node;
                break;
              }
            }
            if (!linkNode) {
              // Create a Composite Property Node, this acts as a surrogate property link for the Composite node.
              linkNode = new wcNodeCompositeProperty(compNode, {x: bounds.left + bounds.width + 200, y: node.pos.y}, linkName);
              linkNode.collapsed(true);
              createdLinks.push({
                name: linkName,
                node: linkNode,
              });
            }

            linkNode.connectInput('value', node, linkName);
            compNode.connectOutput(linkNode.name, targetNode, targetName);
            targetNode.disconnectInput(targetName, node, linkName);
          }
        }

        compNode.pos.x = bounds.left + bounds.width/2;
        compNode.pos.y = bounds.top + bounds.height/2;

        // Compile the meta data for this node based on the nodes inside.
        compNode.compile();
        window[className].prototype.compiledNodes = compNode.compiledNodes;

        // Create undo event for creating the composite node.
        self.__onCreateNode(compNode);

        self._undoManager && self._undoManager.endGroup();

        self.__setupPalette();
      }
    });


    // View
    $body.on('click', '.wcPlayEditorMenuOptionCenter', function() {
      if (self._selectedNodes.length) {
        self.focus(self._selectedNodes);
      } else {
        self.center();
      }
    });
    $body.on('click', '.wcPlayEditorMenuOptionCompositeExit', function() {
      if (self._parent instanceof wcNodeCompositeScript) {
        var focusNode = self._parent;
        self._parent = self._parent._parent;

        self._selectedNode = focusNode;
        self._selectedNodes = [focusNode];
        self.focus(self._selectedNodes);
      }
    });
    $body.on('click', '.wcPlayEditorMenuOptionCompositeEnter', function() {
      if (self._selectedNodes.length && self._selectedNodes[0] instanceof wcNodeCompositeScript) {
        self._parent = self._selectedNodes[0];
        self._selectedNode = null;
        self._selectedNodes = [];

        self.center();
      }
    });

    // Debugger
    $body.on('click', '.wcPlayEditorMenuOptionDebugging', function() {
      if (self._engine) {
        self._engine.debugging(!self._engine.debugging());
        self._engine.paused(false);
      }
    });
    $body.on('click', '.wcPlayEditorMenuOptionSilence', function() {
      if (self._engine) {
        self._engine.silent(!self._engine.silent());
      }
    });
    $body.on('click', '.wcPlayEditorMenuOptionRestart', function() {
      if (self._engine) {
        self._engine.start();
      }
    });
    $body.on('click', '.wcPlayEditorMenuOptionPausePlay', function() {
      if (self._engine) {
        if (self._engine.paused() || self._engine.stepping()) {
          self._engine.paused(false);
          self._engine.stepping(false);
        } else {
          self._engine.stepping(true);
        }
      }
    });
    $body.on('click', '.wcPlayEditorMenuOptionStep', function() {
      if (self._engine) {
        self._engine.paused(false);
        self._engine.stepping(true);
      }
    });

    // Help menu
    $body.on('click', '.wcPlayEditorMenuOptionDocs', function() {
      window.open('https://play.api.webcabin.org/', '_blank');
    });
    $body.on('click', '.wcPlayEditorMenuOptionAbout', function() {
      // TODO:
    });
  },

  /**
   * Handle mouse move events over the palette view.
   * @function wcPlayEditor#__onPaletteMouseMove
   * @private
   * @param {Object} event - The mouse event.
   * @param {Object} elem - The target element.
   */
  __onPaletteMouseMove: function(event, elem) {
    var mouse = this.__mouse(event);

    this._highlightTitle = false;
    // this._highlightCollapser = false;
    this._highlightBreakpoint = false;
    this._highlightEntryLink = false;
    this._highlightExitLink = false;
    this._highlightInputLink = false;
    this._highlightOutputLink = false;
    this._highlightPropertyValue = false;
    this._highlightPropertyInitialValue = false;
    this._highlightViewport = false;

    // Dragging a node from the palette view.
    if (this._draggingNodeData) {
      var pos = {
        x: mouse.gx + this._draggingNodeData.offset.x,
        y: mouse.gy + this._draggingNodeData.offset.y,
      };

      this._draggingNodeData.$canvas.css('left', pos.x).css('top', pos.y);
      return;
    }

    var categoryData = this.__findCategoryAreaAtPos(mouse);
    if (categoryData) {
      var offset = categoryData.$canvas.offset();
      mouse = this.__mouse(event, offset);
      var node = this.__findNodeAtPos(mouse, undefined, categoryData.nodes);
      if (node) {
        this._highlightNode = node;
        this.$palette.addClass('wcClickable');
        this.$palette.attr('title', 'Create a new instance of this node by dragging this into your script.');
      } else {
        this._highlightNode = null;
        this.$palette.removeClass('wcClickable');
        this.$palette.attr('title', '');
      }
    }
  },

  /**
   * Handle mouse down events over the palette view.
   * @function wcPlayEditor#__onPaletteMouseDown
   * @private
   * @param {Object} event - The mouse event.
   * @param {Object} elem - The target element.
   */
  __onPaletteMouseDown: function(event, elem) {
    if (this._highlightNode) {
      this.__onPaletteMouseUp(event, elem);
      var mouse = this.__mouse(event);
      var rect = this._highlightNode._meta.bounds.rect;
      var categoryData = this.__findCategoryAreaAtPos(mouse);
      if (categoryData) {
        var offset = categoryData.$canvas.offset();

        this._draggingNodeData = {
          node: this._highlightNode,
          $canvas: $('<canvas class="wcPlayHoverCanvas">'),
          offset: {x: 0, y: 0}
        };
        this.$main.append(this._draggingNodeData.$canvas);

        this.$palette.addClass('wcMoving');
        this.$viewport.addClass('wcMoving');

        this._draggingNodeData.$canvas.css('left', rect.left + offset.left).css('top', rect.top + offset.top);
        this._draggingNodeData.$canvas.attr('width', rect.width).css('width', rect.width);
        this._draggingNodeData.$canvas.attr('height', rect.height).css('height', rect.height);

        this._draggingNodeData.offset.x = (rect.left + offset.left) - mouse.x;
        this._draggingNodeData.offset.y = (rect.top + offset.top) - mouse.y;

        var yPos = 0;
        if (!this._highlightNode.chain.entry.length) {
          yPos += this._drawStyle.links.length;
        }

        this.__drawNode(this._highlightNode, {x: rect.width/2, y: yPos+3}, this._draggingNodeData.$canvas[0].getContext('2d'), true);
      }
    }
  },

  /**
   * Handle mouse up events over the palette view.
   * @function wcPlayEditor#__onPaletteMouseDown
   * @private
   * @param {Object} event - The mouse event.
   * @param {Object} elem - The target element.
   */
  __onPaletteMouseUp: function(event, elem) {
    if (this._draggingNodeData) {
      this._draggingNodeData.$canvas.remove();
      this._draggingNodeData.$canvas = null;
      this._draggingNodeData = null;
      this.$palette.removeClass('wcMoving');
      this.$viewport.removeClass('wcMoving');
    }
  },

  /**
   * Handle mouse move events over the viewport canvas.
   * @function wcPlayEditor#__onViewportMouseMove
   * @private
   * @param {Object} event - The mouse event.
   * @param {Object} elem - The target element.
   */
  __onViewportMouseMove: function(event, elem) {
    var mouse = this.__mouse(event, this.$viewport.offset());
    if (mouse.x !== this._mouse.x || mouse.y !== this._mouse.y) {
      this._mouseMoved = true;
    }

    // Dragging a node from the palette view.
    if (this._draggingNodeData) {
      var pos = {
        x: mouse.gx + this._draggingNodeData.offset.x,
        y: mouse.gy + this._draggingNodeData.offset.y,
      };

      this._draggingNodeData.$canvas.css('left', pos.x).css('top', pos.y);
      this._mouse = mouse;
      return;
    }

    // Box selection.
    if (this._highlightRect && this._parent) {
      this._highlightRect.x = ((mouse.x - this._viewportCamera.x) / this._viewportCamera.z) - this._highlightRect.ox;
      this._highlightRect.y = ((mouse.y - this._viewportCamera.y) / this._viewportCamera.z) - this._highlightRect.oy;

      this._highlightRect.width = this._highlightRect.x;
      this._highlightRect.height = this._highlightRect.y;
      if (this._highlightRect.width < 0) {
        this._highlightRect.left = this._highlightRect.ox + this._highlightRect.width;
        this._highlightRect.width *= -1;
      }
      if (this._highlightRect.height < 0) {
        this._highlightRect.top = this._highlightRect.oy + this._highlightRect.height;
        this._highlightRect.height *= -1;
      }


      this._selectedNodes = [];
      var self = this;
      function __nodesInRect(nodes) {
        for (var i = 0; i < nodes.length; ++i) {
          if (self.__rectInRect(nodes[i]._meta.bounds.inner, self._highlightRect)) {
            self._selectedNodes.push(nodes[i]);
          }
        }
      };
      __nodesInRect(this._parent._storageNodes);
      __nodesInRect(this._parent._compositeNodes);
      __nodesInRect(this._parent._processNodes);
      __nodesInRect(this._parent._entryNodes);
      this._mouse = mouse;
      return;
    }

    // Viewport panning.
    if (this._viewportMoving) {
      var moveX = mouse.x - this._mouse.x;
      var moveY = mouse.y - this._mouse.y;
      this._viewportCamera.x += moveX;
      this._viewportCamera.y += moveY;
      this._mouse = mouse;
      if (!this._viewportMoved && this._mouseMoved) {
        this._viewportMoved = true;
        this.$viewport.addClass('wcMoving');
      }
      return;
    }

    if (this._viewportMovingNode) {
      var moveX = mouse.x - this._mouse.x;
      var moveY = mouse.y - this._mouse.y;
      for (var i = 0; i < this._selectedNodes.length; ++i) {
        var node = this._selectedNodes[i];
        var oldPos = {
          x: node.pos.x,
          y: node.pos.y,
        };
        var newPos = {
          x: node.pos.x + (moveX / this._viewportCamera.z),
          y: node.pos.y + (moveY / this._viewportCamera.z),
        };

        var newPos = node.onMoving(oldPos, newPos) || newPos;

        if (oldPos.x !== newPos.x || oldPos.y !== newPos.y) {
          node.pos.x = newPos.x;
          node.pos.y = newPos.y;
          node.onMoved(oldPos, newPos);
        }
      }
      this._mouse = mouse;
      return;
    }

    this._mouse = mouse;
    this._highlightTitle = false;
    // this._highlightCollapser = false;
    this._highlightBreakpoint = false;
    this._highlightEntryLink = false;
    this._highlightExitLink = false;
    this._highlightInputLink = false;
    this._highlightOutputLink = false;
    this._highlightPropertyValue = false;
    this._highlightPropertyInitialValue = false;

    var wasOverViewport = this._highlightViewport;
    this._highlightViewport = false;

    var node = this.__findNodeAtPos(mouse, this._viewportCamera);
    if (node) {
      // Check for main node collision.
      this.$viewport.removeClass('wcClickable wcMoving wcGrab');
      if (this.__inRect(mouse, node._meta.bounds.inner, this._viewportCamera)) {
        this._highlightNode = node;
        this.$viewport.attr('title', (node._meta.description? node._meta.description + '\n': '') + 'Click and drag to move this node. Double click to collapse/expand this node.');
        this.$viewport.addClass('wcMoving');
      }

      if (!this._selectedEntryLink && !this._selectedExitLink && !this._selectedInputLink && !this._selectedOutputLink) {
        // // Collapser button.
        // if (this.__inRect(mouse, node._meta.bounds.collapser, this._viewportCamera)) {
        //   this._highlightCollapser = true;
        //   this.$viewport.addClass('wcClickable');
        //   if (node.collapsed()) {
        //     this.$viewport.attr('title', 'Expand this node.');
        //   } else {
        //     this.$viewport.attr('title', 'Collapse this node.');
        //   }
        // }

        // Breakpoint button.
        if (this.__inRect(mouse, node._meta.bounds.breakpoint, this._viewportCamera)) {
          this._highlightBreakpoint = true;
          this.$viewport.addClass('wcClickable');
          this.$viewport.attr('title', 'Toggle debug breakpoint on this node.');
        }
      }

      // Entry links.
      if (!this._selectedEntryLink && !this._selectedInputLink && !this._selectedOutputLink) {
        for (var i = 0; i < node._meta.bounds.entryBounds.length; ++i) {
          if (this.__inRect(mouse, node._meta.bounds.entryBounds[i].rect, this._viewportCamera)) {
            this._highlightNode = node;
            this._highlightEntryLink = node._meta.bounds.entryBounds[i];

            var link;
            for (var a = 0; a < node.chain.entry.length; ++a) {
              if (node.chain.entry[a].name == this._highlightEntryLink.name) {
                link = node.chain.entry[a];
                break;
              }
            }

            this.$viewport.attr('title', (link.meta.description? link.meta.description + '\n': '') + 'Click and drag to create a new flow chain from another node. Double click to manually fire this entry link.');
            this.$viewport.addClass('wcGrab');
            break;
          }
        }
      }

      // Exit links.
      if (!this._selectedExitLink && !this._selectedInputLink && !this._selectedOutputLink) {
        for (var i = 0; i < node._meta.bounds.exitBounds.length; ++i) {
          if (this.__inRect(mouse, node._meta.bounds.exitBounds[i].rect, this._viewportCamera)) {
            this._highlightNode = node;
            this._highlightExitLink = node._meta.bounds.exitBounds[i];

            var link;
            for (var a = 0; a < node.chain.exit.length; ++a) {
              if (node.chain.exit[a].name == this._highlightExitLink.name) {
                link = node.chain.exit[a];
                break;
              }
            }

            this.$viewport.attr('title', (link.meta.description? link.meta.description + '\n': '') + 'Click and drag to create a new flow chain to another node. Double click to manually fire this exit link.');
            this.$viewport.addClass('wcGrab');
            break;
          }
        }
      }

      // Input links.
      if (!this._selectedEntryLink && !this._selectedExitLink && !this._selectedInputLink) {
        for (var i = 0; i < node._meta.bounds.inputBounds.length; ++i) {
          if (this.__inRect(mouse, node._meta.bounds.inputBounds[i].rect, this._viewportCamera)) {
            this._highlightNode = node;
            this._highlightInputLink = node._meta.bounds.inputBounds[i];
            this.$viewport.attr('title', 'Click and drag to chain this property to the output of another.');
            this.$viewport.addClass('wcGrab');
            break;
          }
        }
      }

        // Output links.
      if (!this._selectedEntryLink && !this._selectedExitLink && !this._selectedOutputLink) {
        for (var i = 0; i < node._meta.bounds.outputBounds.length; ++i) {
          if (this.__inRect(mouse, node._meta.bounds.outputBounds[i].rect, this._viewportCamera)) {
            this._highlightNode = node;
            this._highlightOutputLink = node._meta.bounds.outputBounds[i];
            this.$viewport.attr('title', 'Click and drag to chain this property to the input of another. Double click to manually propagate this property through the chain.');
            this.$viewport.addClass('wcGrab');
            break;
          }
        }
      }

      if (!this._selectedEntryLink && !this._selectedExitLink && !this._selectedInputLink && !this._selectedOutputLink) {
        // Title label.
        if (this.__inRect(this._mouse, node._meta.bounds.titleBounds, this._viewportCamera)) {
          this._highlightNode = node;
          this._highlightTitle = true;
          this.$viewport.attr('title', 'Click to add or modify an additional label for this title.');
          this.$viewport.addClass('wcClickable');
        }

        // Property labels.
        var propBounds;
        for (var i = 0; i < node._meta.bounds.propertyBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.propertyBounds[i].rect, this._viewportCamera)) {
            propBounds = node._meta.bounds.propertyBounds[i];
            break;
          }
        }

        if (propBounds) {
          for (var i = 0; i < node.properties.length; ++i) {
            if (node.properties[i].name === propBounds.name) {
              this.$viewport.attr('title', (node.properties[i].options.description? node.properties[i].options.description + '\n': ''));
              this.$viewport.addClass('wcClickable');
              break;
            }
          }
        }

        // Property values.
        var valueBounds;
        for (var i = 0; i < node._meta.bounds.valueBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.valueBounds[i].rect, this._viewportCamera)) {
            valueBounds = node._meta.bounds.valueBounds[i];
            break;
          }
        }

        if (valueBounds) {
          for (var i = 0; i < node.properties.length; ++i) {
            if (node.properties[i].name === valueBounds.name) {
              this._highlightNode = node;
              this._highlightPropertyValue = valueBounds;
              this.$viewport.attr('title', (node.properties[i].options.description? node.properties[i].options.description + '\n': '') + 'Click to change the current value of this property.');
              this.$viewport.addClass('wcClickable');
              break;
            }
          }
        }

        // Property initial values.
        var initialBounds;
        for (var i = 0; i < node._meta.bounds.initialBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.initialBounds[i].rect, this._viewportCamera)) {
            initialBounds = node._meta.bounds.initialBounds[i];
            break;
          }
        }

        if (initialBounds) {
          for (var i = 0; i < node.properties.length; ++i) {
            if (node.properties[i].name === initialBounds.name) {
              this._highlightNode = node;
              this._highlightPropertyInitialValue = initialBounds;
              this.$viewport.attr('title', (node.properties[i].options.description? node.properties[i].options.description + '\n': '') + 'Click to change the initial value of this property.');
              this.$viewport.addClass('wcClickable');
              break;
            }
          }
        }

        // Custom viewport area.
        if (node._meta.bounds.viewportBounds) {
          var pos = {
            x: (mouse.x - this._viewportCamera.x) / this._viewportCamera.z - node._meta.bounds.viewportBounds.left,
            y: (mouse.y - this._viewportCamera.y) / this._viewportCamera.z - node._meta.bounds.viewportBounds.top,
          };

          if (this.__inRect(this._mouse, node._meta.bounds.viewportBounds, this._viewportCamera)) {
            this._highlightNode = node;
            this._highlightViewport = true;

            if (!wasOverViewport) {
              node.onViewportMouseEnter(event, pos);
            }

            node.onViewportMouseMove(event, pos);
          } else if (wasOverViewport) {
            node.onViewportMouseLeave(event, pos);
          }
        }
      }
    } else {
      this._highlightNode = null;
      this.$viewport.attr('title', '');
      this.$viewport.removeClass('wcClickable');
    }

    // If you hover over a node that is not currently expanded by hovering, force the expanded node to collapse again.
    if (this._expandedHighlightNode && this._expandedHighlightNode !== this._highlightNode) {
      // If we are not highlighting a new node, only uncollapse the previously hovered node if we are far from it.
      if (this._highlightNode || !this.__inRect(mouse, this._expandedHighlightNode._meta.bounds.farRect, this._viewportCamera)) {
        // Recollapse our previous node, if necessary.
        if (this._expandedSelectedNode !== this._expandedHighlightNode) {
          this._expandedHighlightNode.collapsed(true);
        }

        this._expandedHighlightNode = null;
      }
    }

    // If the user is creating a new connection and hovering over another node, uncollapse it temporarily to expose links.
    if (!this._expandedHighlightNode && this._highlightNode && 
        this.__inRect(mouse, node._meta.bounds.inner, this._viewportCamera)) {

      this._expandedHighlightNode = this._highlightNode;
      this._expandedHighlightNode.collapsed(false);
    }
  },

  /**
   * Handle mouse press events over the viewport canvas.
   * @function wcPlayEditor#__onViewportMouseDown
   * @private
   * @param {Object} event - The mouse event.
   * @param {Object} elem - The target element.
   */
  __onViewportMouseDown: function(event, elem) {
    this._mouse = this.__mouse(event, this.$viewport.offset());
    if (this._mouse.which === 3) {
      return;
    }
    this._mouseMoved = false;

    // Control+drag or middle+drag to box select.
    if (event.ctrlKey || this._mouse.which === 2) {
      this._highlightRect = {
        top: (this._mouse.y - this._viewportCamera.y) / this._viewportCamera.z,
        left: (this._mouse.x - this._viewportCamera.x) / this._viewportCamera.z,
        oy: (this._mouse.y - this._viewportCamera.y) / this._viewportCamera.z,
        ox: (this._mouse.x - this._viewportCamera.x) / this._viewportCamera.z,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };
      return;
    }

    var hasTarget = false;
    var node = this.__findNodeAtPos(this._mouse, this._viewportCamera);
    if (node) {
      // Entry links.
      if (!hasTarget) {
        for (var i = 0; i < node._meta.bounds.entryBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.entryBounds[i].rect, this._viewportCamera)) {
            hasTarget = true;
            // Alt click to disconnect all chains from this link.
            if (event.altKey) {
              var chains = node.listEntryChains(node._meta.bounds.entryBounds[i].name);
              if (chains.length) {
                this._undoManager && this._undoManager.addEvent('Disconnected Entry Links for "' + node.category + '.' + node.type + '.' + node._meta.bounds.entryBounds[i].name + '"',
                  {
                    id: node.id,
                    name: node._meta.bounds.entryBounds[i].name,
                    chains: chains,
                    editor: this,
                  },
                  // Undo
                  function() {
                    var myNode = this.editor._engine.nodeById(this.id);
                    for (var i = 0; i < this.chains.length; ++i) {
                      var targetNode = this.editor._engine.nodeById(this.chains[i].outNodeId);
                      var targetName = this.chains[i].outName;
                      myNode.connectEntry(this.name, targetNode, targetName);
                    }
                  },
                  // Redo
                  function() {
                    var myNode = this.editor._engine.nodeById(this.id);
                    myNode.disconnectEntry(this.name);
                  });
              }
              node.disconnectEntry(node._meta.bounds.entryBounds[i].name);
              break;
            }
            this._selectedNode = node;
            this._selectedNodes = [node];
            this._selectedEntryLink = node._meta.bounds.entryBounds[i];
            this.$viewport.addClass('wcGrabbing');

            this._expandedSelectedNode = this._expandedHighlightNode;
            break;
          }
        }
      }

      // Exit links.
      if (!hasTarget) {
        for (var i = 0; i < node._meta.bounds.exitBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.exitBounds[i].rect, this._viewportCamera)) {
            hasTarget = true;
            // Alt click to disconnect all chains from this link.
            if (event.altKey) {
              var chains = node.listExitChains(node._meta.bounds.exitBounds[i].name);
              if (chains.length) {
                this._undoManager && this._undoManager.addEvent('Disconnected Exit Links for "' + node.category + '.' + node.type + '.' + node._meta.bounds.exitBounds[i].name + '"',
                  {
                    id: node.id,
                    name: node._meta.bounds.exitBounds[i].name,
                    chains: chains,
                    editor: this,
                  },
                  // Undo
                  function() {
                    var myNode = this.editor._engine.nodeById(this.id);
                    for (var i = 0; i < this.chains.length; ++i) {
                      var targetNode = this.editor._engine.nodeById(this.chains[i].inNodeId);
                      var targetName = this.chains[i].inName;
                      myNode.connectExit(this.name, targetNode, targetName);
                    }
                  },
                  // Redo
                  function() {
                    var myNode = this.editor._engine.nodeById(this.id);
                    myNode.disconnectExit(this.name);
                  });
              }
              node.disconnectExit(node._meta.bounds.exitBounds[i].name);
              break;
            } 
            // Shift click to manually fire this exit chain.
            else if (event.shiftKey) {
              node.triggerExit(node._meta.bounds.exitBounds[i].name);
              break;
            }
            this._selectedNode = node;
            this._selectedNodes = [node];
            this._selectedExitLink = node._meta.bounds.exitBounds[i];
            this.$viewport.addClass('wcGrabbing');

            this._expandedSelectedNode = this._expandedHighlightNode;
            break;
          }
        }
      }

      // Input links.
      if (!hasTarget) {
        for (var i = 0; i < node._meta.bounds.inputBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.inputBounds[i].rect, this._viewportCamera)) {
            hasTarget = true;
            // Alt click to disconnect all chains from this link.
            if (event.altKey) {
              var chains = node.listInputChains(node._meta.bounds.inputBounds[i].name);
              if (chains.length) {
                this._undoManager && this._undoManager.addEvent('Disconnected Property Input Links for "' + node.category + '.' + node.type + '.' + node._meta.bounds.inputBounds[i].name + '"',
                  {
                    id: node.id,
                    name: node._meta.bounds.inputBounds[i].name,
                    chains: chains,
                    editor: this,
                  },
                  // Undo
                  function() {
                    var myNode = this.editor._engine.nodeById(this.id);
                    for (var i = 0; i < this.chains.length; ++i) {
                      var targetNode = this.editor._engine.nodeById(this.chains[i].outNodeId);
                      var targetName = this.chains[i].outName;
                      myNode.connectInput(this.name, targetNode, targetName);
                    }
                  },
                  // Redo
                  function() {
                    var myNode = this.editor._engine.nodeById(this.id);
                    myNode.disconnectInput(this.name);
                  });
              }
              node.disconnectInput(node._meta.bounds.inputBounds[i].name);
              break;
            }
            this._selectedNode = node;
            this._selectedNodes = [node];
            this._selectedInputLink = node._meta.bounds.inputBounds[i];
            this.$viewport.addClass('wcGrabbing');

            this._expandedSelectedNode = this._expandedHighlightNode;
            break;
          }
        }
      }

      // Output links.
      if (!hasTarget) {
        for (var i = 0; i < node._meta.bounds.outputBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.outputBounds[i].rect, this._viewportCamera)) {
            hasTarget = true;
            // Alt click to disconnect all chains from this link.
            if (event.altKey) {
              var chains = node.listOutputChains(node._meta.bounds.outputBounds[i].name);
              if (chains.length) {
                this._undoManager && this._undoManager.addEvent('Disconnected Property Output Links for "' + node.category + '.' + node.type + '.' + node._meta.bounds.outputBounds[i].name + '"',
                  {
                    id: node.id,
                    name: node._meta.bounds.outputBounds[i].name,
                    chains: chains,
                    editor: this,
                  },
                  // Undo
                  function() {
                    var myNode = this.editor._engine.nodeById(this.id);
                    for (var i = 0; i < this.chains.length; ++i) {
                      var targetNode = this.editor._engine.nodeById(this.chains[i].inNodeId);
                      var targetName = this.chains[i].inName;
                      myNode.connectOutput(this.name, targetNode, targetName);
                    }
                  },
                  // Redo
                  function() {
                    var myNode = this.editor._engine.nodeById(this.id);
                    myNode.disconnectOutput(this.name);
                  });
              }
              node.disconnectOutput(node._meta.bounds.outputBounds[i].name);
              break;
            }
            this._selectedNode = node;
            this._selectedNodes = [node];
            this._selectedOutputLink = node._meta.bounds.outputBounds[i];
            this.$viewport.addClass('wcGrabbing');

            this._expandedSelectedNode = this._expandedHighlightNode;
            break;
          }
        }
      }

      // Custom viewport area.
      if (!hasTarget && node._meta.bounds.viewportBounds) {
        var pos = {
          x: (this._mouse.x - this._viewportCamera.x) / this._viewportCamera.z - node._meta.bounds.viewportBounds.left,
          y: (this._mouse.y - this._viewportCamera.y) / this._viewportCamera.z - node._meta.bounds.viewportBounds.top,
        };

        if (this.__inRect(this._mouse, node._meta.bounds.viewportBounds, this._viewportCamera)) {
          this._selectedNode = node;
          this._selectedNodes = [node];

          if (node.onViewportMouseDown(event, pos)) {
            hasTarget = true;
          }
        }
      }

      // Center area.
      if (!hasTarget && this.__inRect(this._mouse, node._meta.bounds.inner, this._viewportCamera)) {
        hasTarget = true;
        if (!this._selectedNodes.length || this._selectedNodes.indexOf(node) === -1) {
          this._selectedNode = node;
          this._selectedNodes = [node];
        }
        this._viewportMovingNode = true;
        this._selectedNodeOrigins = [];
        for (var i = 0; i < this._selectedNodes.length; ++i) {
          var myNode = this._selectedNodes[i];
          this._selectedNodeOrigins.push({
            x: myNode.pos.x,
            y: myNode.pos.y,
          });
        }
      }
    }

    // Click outside of a node begins the canvas drag process.
    if (!hasTarget) {
      this._viewportMoving = true;
      this._viewportMoved = false;
    }
  },

  /**
   * Handle mouse release events over the viewport canvas.
   * @function wcPlayEditor#__onViewportMouseDown
   * @private
   * @param {Object} event - The mouse event.
   * @param {Object} elem - The target element.
   */
  __onViewportMouseUp: function(event, elem) {
    this.$viewport.removeClass('wcGrabbing');

    if (this._draggingNodeData) {
      // Create an instance of the node and add it to the script.
      var mouse = this.__mouse(event, this.$viewport.offset(), this._viewportCamera);
      var newNode = new window[this._draggingNodeData.node.className](this._parent, {
        x: (mouse.x + (this._draggingNodeData.$canvas.width()/2 + this._draggingNodeData.offset.x)) / this._viewportCamera.z,
        y: (mouse.y + this._draggingNodeData.offset.y) / this._viewportCamera.z,
      });
      if (newNode.decompile) {
        newNode.decompile();
      }
      this.__onCreateNode(newNode, true);

      this._selectedNode = newNode;
      this._selectedNodes = [newNode];
      this._expandedHighlightNode = newNode;

      this.__updateNode(newNode, 0);
      this.__drawNode(newNode, newNode.pos, this._viewportContext);

      this._draggingNodeData.$canvas.remove();
      this._draggingNodeData.$canvas = null;
      this._draggingNodeData = null;
      this.$palette.removeClass('wcMoving');
      this.$viewport.removeClass('wcMoving');
    }

    if (this._highlightRect && this._parent) {
      this._highlightRect = null;
      return;
    }

    // Finished moving a node.
    if (this._selectedNodes.length && this._selectedNodeOrigins.length) {
      for (var i = 0; i < this._selectedNodes.length; ++i) {
        var node = this._selectedNodes[i];
        if (node.pos.x !== this._selectedNodeOrigins[i].x || node.pos.y !== this._selectedNodeOrigins[i].y) {
          this._undoManager && this._undoManager.addEvent('Moved Node "' + node.category + '.' + node.type + '"',
          {
            id: node.id,
            start: {
              x: this._selectedNodeOrigins[i].x,
              y: this._selectedNodeOrigins[i].y,
            },
            end: {
              x: node.pos.x,
              y: node.pos.y,
            },
            editor: this,
          },
          // Undo
          function() {
            var myNode = this.editor._engine.nodeById(this.id);
            var pos = myNode.onMoving({x: this.end.x, y: this.end.y}, {x: this.start.x, y: this.start.y}) || this.start;
            myNode.pos.x = this.start.x;
            myNode.pos.y = this.start.y;
            myNode.onMoving({x: this.end.x, y: this.end.y}, {x: pos.x, y: pos.y});
          },
          // Redo
          function() {
            var myNode = this.editor._engine.nodeById(this.id);
            var pos = myNode.onMoving({x: this.start.x, y: this.start.y}, {x: this.end.x, y: this.end.y}) || this.end;
            myNode.pos.x = this.end.x;
            myNode.pos.y = this.end.y;
            myNode.onMoving({x: this.start.x, y: this.start.y}, {x: pos.x, y: pos.y});
          });
        }
      }
      this._selectedNodeOrigins = [];
    }

    // Check for link connections.
    if (this._selectedNode && this._selectedEntryLink && this._highlightNode && this._highlightExitLink) {
      if (this._selectedNode.connectEntry(this._selectedEntryLink.name, this._highlightNode, this._highlightExitLink.name) === wcNode.CONNECT_RESULT.ALREADY_CONNECTED) {
        this._selectedNode.disconnectEntry(this._selectedEntryLink.name, this._highlightNode, this._highlightExitLink.name);
        this._undoManager && this._undoManager.addEvent('Disconnected Entry Link "' + this._selectedNode.category + '.' + this._selectedNode.type + '.' + this._selectedEntryLink.name + '" to Exit Link "' + this._highlightNode.category + '.' + this._highlightNode.type + '.' + this._highlightExitLink.name + '"',
        {
          id: this._selectedNode.id,
          name: this._selectedEntryLink.name,
          targetId: this._highlightNode.id,
          targetName: this._highlightExitLink.name,
          editor: this,
        },
        // Undo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.connectEntry(this.name, targetNode, this.targetName);
        },
        // Redo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.disconnectEntry(this.name, targetNode, this.targetName);
        });
      } else {
        this._undoManager && this._undoManager.addEvent('Connected Entry Link "' + this._selectedNode.category + '.' + this._selectedNode.type + '.' + this._selectedEntryLink.name + '" to Exit Link "' + this._highlightNode.category + '.' + this._highlightNode.type + '.' + this._highlightExitLink.name + '"',
        {
          id: this._selectedNode.id,
          name: this._selectedEntryLink.name,
          targetId: this._highlightNode.id,
          targetName: this._highlightExitLink.name,
          editor: this,
        },
        // Undo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.disconnectEntry(this.name, targetNode, this.targetName);
        },
        // Redo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.connectEntry(this.name, targetNode, this.targetName);
        });
      }
    }
    if (this._selectedNode && this._selectedExitLink && this._highlightNode && this._highlightEntryLink) {
      if (this._selectedNode.connectExit(this._selectedExitLink.name, this._highlightNode, this._highlightEntryLink.name) === wcNode.CONNECT_RESULT.ALREADY_CONNECTED) {
        this._selectedNode.disconnectExit(this._selectedExitLink.name, this._highlightNode, this._highlightEntryLink.name);
        this._undoManager && this._undoManager.addEvent('Disconnected Exit Link "' + this._selectedNode.category + '.' + this._selectedNode.type + '.' + this._selectedExitLink.name + '" to Entry Link "' + this._highlightNode.category + '.' + this._highlightNode.type + '.' + this._highlightEntryLink.name + '"',
        {
          id: this._selectedNode.id,
          name: this._selectedExitLink.name,
          targetId: this._highlightNode.id,
          targetName: this._highlightEntryLink.name,
          editor: this,
        },
        // Undo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.connectExit(this.name, targetNode, this.targetName);
        },
        // Redo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.disconnectExit(this.name, targetNode, this.targetName);
        });
      } else {
        this._undoManager && this._undoManager.addEvent('Connected Exit Link "' + this._selectedNode.category + '.' + this._selectedNode.type + '.' + this._selectedExitLink.name + '" to Entry Link "' + this._highlightNode.category + '.' + this._highlightNode.type + '.' + this._highlightEntryLink.name + '"',
        {
          id: this._selectedNode.id,
          name: this._selectedExitLink.name,
          targetId: this._highlightNode.id,
          targetName: this._highlightEntryLink.name,
          editor: this,
        },
        // Undo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.disconnectExit(this.name, targetNode, this.targetName);
        },
        // Redo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.connectExit(this.name, targetNode, this.targetName);
        });
      }
    }
    if (this._selectedNode && this._selectedInputLink && this._highlightNode && this._highlightOutputLink) {
      if (this._selectedNode.connectInput(this._selectedInputLink.name, this._highlightNode, this._highlightOutputLink.name) === wcNode.CONNECT_RESULT.ALREADY_CONNECTED) {
        this._selectedNode.disconnectInput(this._selectedInputLink.name, this._highlightNode, this._highlightOutputLink.name);
        this._undoManager && this._undoManager.addEvent('Disconnected Property Input Link "' + this._selectedNode.category + '.' + this._selectedNode.type + '.' + this._selectedInputLink.name + '" to Property Output Link "' + this._highlightNode.category + '.' + this._highlightNode.type + '.' + this._highlightOutputLink.name + '"',
        {
          id: this._selectedNode.id,
          name: this._selectedInputLink.name,
          targetId: this._highlightNode.id,
          targetName: this._highlightOutputLink.name,
          editor: this,
        },
        // Undo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.connectInput(this.name, targetNode, this.targetName);
        },
        // Redo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.disconnectInput(this.name, targetNode, this.targetName);
        });
      } else {
        this._undoManager && this._undoManager.addEvent('Connected Property Input Link "' + this._selectedNode.category + '.' + this._selectedNode.type + '.' + this._selectedInputLink.name + '" to Property Output Link "' + this._highlightNode.category + '.' + this._highlightNode.type + '.' + this._highlightOutputLink.name + '"',
        {
          id: this._selectedNode.id,
          name: this._selectedInputLink.name,
          targetId: this._highlightNode.id,
          targetName: this._highlightOutputLink.name,
          editor: this,
        },
        // Undo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.disconnectInput(this.name, targetNode, this.targetName);
        },
        // Redo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.connectInput(this.name, targetNode, this.targetName);
        });
      }
    }
    if (this._selectedNode && this._selectedOutputLink && this._highlightNode && this._highlightInputLink) {
      if (this._selectedNode.connectOutput(this._selectedOutputLink.name, this._highlightNode, this._highlightInputLink.name) === wcNode.CONNECT_RESULT.ALREADY_CONNECTED) {
        this._selectedNode.disconnectOutput(this._selectedOutputLink.name, this._highlightNode, this._highlightInputLink.name);
        this._undoManager && this._undoManager.addEvent('Disconnected Property Output Link "' + this._selectedNode.category + '.' + this._selectedNode.type + '.' + this._selectedOutputLink.name + '" to Property Input Link "' + this._highlightNode.category + '.' + this._highlightNode.type + '.' + this._highlightInputLink.name + '"',
        {
          id: this._selectedNode.id,
          name: this._selectedOutputLink.name,
          targetId: this._highlightNode.id,
          targetName: this._highlightInputLink.name,
          editor: this,
        },
        // Undo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.connectOutput(this.name, targetNode, this.targetName);
        },
        // Redo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.disconnectOutput(this.name, targetNode, this.targetName);
        });
      } else {
        this._undoManager && this._undoManager.addEvent('Connected Property Output Link "' + this._selectedNode.category + '.' + this._selectedNode.type + '.' + this._selectedOutputLink.name + '" to Property Input Link "' + this._highlightNode.category + '.' + this._highlightNode.type + '.' + this._highlightInputLink.name + '"',
        {
          id: this._selectedNode.id,
          name: this._selectedOutputLink.name,
          targetId: this._highlightNode.id,
          targetName: this._highlightInputLink.name,
          editor: this,
        },
        // Undo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.disconnectOutput(this.name, targetNode, this.targetName);
        },
        // Redo
        function() {
          var myNode = this.editor._engine.nodeById(this.id);
          var targetNode = this.editor._engine.nodeById(this.targetId);
          myNode.connectOutput(this.name, targetNode, this.targetName);
        });
      }
    }

    // Custom viewport area.
    if (this._selectedNode && this._highlightViewport) {
      var mouse = this.__mouse(event, this.$viewport.offset());
      var pos = {
        x: (mouse.x - this._viewportCamera.x) / this._viewportCamera.z - this._selectedNode._meta.bounds.viewportBounds.left,
        y: (mouse.y - this._viewportCamera.y) / this._viewportCamera.z - this._selectedNode._meta.bounds.viewportBounds.top,
      };

      this._selectedNode.onViewportMouseUp(event, pos);
    }

    // Re-collapse the node, if necessary.
    if (this._expandedHighlightNode && this._expandedSelectedNode !== this._expandedHighlightNode) {
      this._expandedHighlightNode.collapsed(true);
    }
    if (this._expandedSelectedNode) {
      this._expandedSelectedNode.collapsed(true);
    }

    this._expandedSelectedNode = null;
    this._expandedHighlightNode = null;
    this._selectedEntryLink = false;
    this._selectedExitLink = false;
    this._selectedInputLink = false;
    this._selectedOutputLink = false;
    this._viewportMovingNode = false;

    if (this._viewportMoving) {
      this._viewportMoving = false;

      if (!this._viewportMoved) {
        this._selectedNode = null;
        this._selectedNodes = [];
      } else {
        this._viewportMoved = false;
        this.$viewport.removeClass('wcMoving');
      }
    }
  },

  /**
   * Handle mouse click events over the viewport canvas.
   * @function wcPlayEditor#__onViewportMouseDown
   * @private
   * @param {Object} event - The mouse event.
   * @param {Object} elem - The target element.
   */
  __onViewportMouseClick: function(event, elem) {
    if (!this._mouseMoved) {
      this._mouse = this.__mouse(event, this.$viewport.offset());

      var hasTarget = false;
      var node = this.__findNodeAtPos(this._mouse, this._viewportCamera);
      if (node) {
        // // Collapser button.
        // if (this.__inRect(this._mouse, node._meta.bounds.collapser, this._viewportCamera)) {
        //   var state = !node.collapsed();
        //   node.collapsed(state);
        //   this._undoManager && this._undoManager.addEvent((state? 'Collapsed': 'Expanded') + ' Node "' + node.category + '.' + node.type + '"',
        //   {
        //     id: node.id,
        //     state: state,
        //     editor: this,
        //   },
        //   // Undo
        //   function() {
        //     var myNode = this.editor._engine.nodeById(this.id);
        //     myNode.collapsed(!this.state);
        //   },
        //   // Redo
        //   function() {
        //     var myNode = this.editor._engine.nodeById(this.id);
        //     myNode.collapsed(this.state);
        //   });
        // }

        // Breakpoint button.
        if (this.__inRect(this._mouse, node._meta.bounds.breakpoint, this._viewportCamera)) {
          var state = !node._break;
          node.debugBreak(state);
          this._undoManager && this._undoManager.addEvent((state? 'Enabled': 'Disabled') + ' Breakpoint on Node "' + node.category + '.' + node.type + '"',
          {
            id: node.id,
            state: state,
            editor: this,
          },
          // Undo
          function() {
            var myNode = this.editor._engine.nodeById(this.id);
            myNode.debugBreak(!this.state);
          },
          // Redo
          function() {
            var myNode = this.editor._engine.nodeById(this.id);
            myNode.debugBreak(this.state);
          });
        }

        // Title label.
        if (this.__inRect(this._mouse, node._meta.bounds.titleBounds, this._viewportCamera)) {
          this.__drawTitleEditor(node, node._meta.bounds.titleBounds);
        }

        // Property values.
        var propBounds;
        for (var i = 0; i < node._meta.bounds.valueBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.valueBounds[i].rect, this._viewportCamera)) {
            propBounds = node._meta.bounds.valueBounds[i];
            break;
          }
        }

        if (propBounds) {
          for (var i = 0; i < node.properties.length; ++i) {
            if (node.properties[i].name === propBounds.name) {
              this.__drawPropertyEditor(node, node.properties[i], propBounds);
              break;
            }
          }
        }

        var propInitialBounds;
        for (var i = 0; i < node._meta.bounds.initialBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.initialBounds[i].rect, this._viewportCamera)) {
            propInitialBounds = node._meta.bounds.initialBounds[i];
            break;
          }
        }

        if (propInitialBounds) {
          for (var i = 0; i < node.properties.length; ++i) {
            if (node.properties[i].name === propInitialBounds.name) {
              this.__drawPropertyEditor(node, node.properties[i], propInitialBounds, true);
              break;
            }
          }
        }

        // Custom viewport area.
        if (node._meta.bounds.viewportBounds) {
          var pos = {
            x: (this._mouse.x - this._viewportCamera.x) / this._viewportCamera.z - node._meta.bounds.viewportBounds.left,
            y: (this._mouse.y - this._viewportCamera.y) / this._viewportCamera.z - node._meta.bounds.viewportBounds.top,
          };

          if (this.__inRect(this._mouse, node._meta.bounds.viewportBounds, this._viewportCamera)) {
            node.onViewportMouseClick(event, pos);
          }
        }
      }
    }
  },

  /**
   * Handle mouse double click events over the viewport canvas.
   * @function wcPlayEditor#__onViewportMouseDoubleClick
   * @private
   * @param {Object} event - The mouse event.
   * @param {Object} elem - The target element.
   */
  __onViewportMouseDoubleClick: function(event, elem) {
    this._mouse = this.__mouse(event, this.$viewport.offset());

    var hasTarget = false;
    var node = this.__findNodeAtPos(this._mouse, this._viewportCamera);
    if (node) {
      // // Collapser button.
      // if (this.__inRect(this._mouse, node._meta.bounds.collapser, this._viewportCamera)) {
      //   hasTarget = true;
      // }

      // Breakpoint button.
      if (this.__inRect(this._mouse, node._meta.bounds.breakpoint, this._viewportCamera)) {
        hasTarget = true;
      }

      // Property values.
      for (var i = 0; i < node._meta.bounds.valueBounds.length; ++i) {
        if (this.__inRect(this._mouse, node._meta.bounds.valueBounds[i].rect, this._viewportCamera)) {
          hasTarget = true;
          break;
        }
      }

      // Entry links.
      if (!hasTarget) {
        for (var i = 0; i < node._meta.bounds.entryBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.entryBounds[i].rect, this._viewportCamera)) {
            hasTarget = true;
            // Double click to manually fire this entry chain.
            node.triggerEntry(node._meta.bounds.entryBounds[i].name);
            break;
          }
        }
      }

      // Exit links.
      if (!hasTarget) {
        for (var i = 0; i < node._meta.bounds.exitBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.exitBounds[i].rect, this._viewportCamera)) {
            hasTarget = true;
            // Double click to manually fire this exit chain.
            node.triggerExit(node._meta.bounds.exitBounds[i].name);
            break;
          }
        }
      }

      // Output links.
      if (!hasTarget) {
        for (var i = 0; i < node._meta.bounds.outputBounds.length; ++i) {
          if (this.__inRect(this._mouse, node._meta.bounds.outputBounds[i].rect, this._viewportCamera)) {
            hasTarget = true;
            // Double click to manually fire this output chain.
            node.property(node._meta.bounds.outputBounds[i].name, node.property(node._meta.bounds.outputBounds[i].name), true);
            break;
          }
        }
      }

      // Custom viewport area.
      if (!hasTarget && node._meta.bounds.viewportBounds) {
        var pos = {
          x: (this._mouse.x - this._viewportCamera.x) / this._viewportCamera.z - node._meta.bounds.viewportBounds.left,
          y: (this._mouse.y - this._viewportCamera.y) / this._viewportCamera.z - node._meta.bounds.viewportBounds.top,
        };

        if (this.__inRect(this._mouse, node._meta.bounds.viewportBounds, this._viewportCamera)) {
          hasTarget = node.onViewportMouseDoubleClick(event, pos);
        }
      }

      // Center area.
      if (!hasTarget && this.__inRect(this._mouse, node._meta.bounds.inner, this._viewportCamera)) {
        hasTarget = true;
        if (node instanceof wcNodeCompositeScript) {
          // Step into composite script nodes.
          this._parent = node;
          this._selectedNode = null;
          this._selectedNodes = [];
          this.center();
        } else if (node instanceof wcNodeComposite && this._parent instanceof wcNodeCompositeScript) {
          // Step out if double clicking on an external link node.
          var focusNode = this._parent;
          this._parent = this._parent._parent;

          this._selectedNode = focusNode;
          this._selectedNodes = [focusNode];
          this.focus(this._selectedNodes);
        } else {
          node.collapsed(!node.collapsed());
        }
      }
    }
  },

  __onViewportMouseWheel: function(event, elem) {
    var oldZoom = this._viewportCamera.z;
    var mouse = this.__mouse(event, this.$viewport.offset());

    // Custom viewport area.
    if (this._highlightNode && this._highlightNode._meta.bounds.viewportBounds) {
      var pos = {
        x: (mouse.x - this._viewportCamera.x) / this._viewportCamera.z - this._highlightNode._meta.bounds.viewportBounds.left,
        y: (mouse.y - this._viewportCamera.y) / this._viewportCamera.z - this._highlightNode._meta.bounds.viewportBounds.top,
      };

      if (this.__inRect(mouse, this._highlightNode._meta.bounds.viewportBounds, this._viewportCamera) &&
          this._highlightNode.onViewportMouseWheel(event, pos, (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0))) {
        return;
      }
    }

    if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
      // scroll up to zoom in.
      this._viewportCamera.z = Math.min(this._viewportCamera.z * 1.25, 5);
    } else {
      // scroll down to zoom out.
      this._viewportCamera.z = Math.max(this._viewportCamera.z * 0.75, 0.1);
    }

    this._viewportCamera.x = (this._viewportCamera.x - mouse.x) / (oldZoom / this._viewportCamera.z) + mouse.x;
    this._viewportCamera.y = (this._viewportCamera.y - mouse.y) / (oldZoom / this._viewportCamera.z) + mouse.y;
  },

  /**
   * Does a bounding collision test to find any nodes at a given position.
   * @function wcPlayEditor#__findNodeAtPos
   * @private
   * @param {wcPlay~Coordinates} pos - The position.
   * @param {wcPlay~Coordinates} camera - The position of the camera.
   * @param {wcNode[]} [nodes] - If supplied, will only search this list of nodes, otherwise will search all nodes in the viewport.
   * @returns {wcNode|null} - A node at the given position, or null if none was found.
   */
  __findNodeAtPos: function(pos, camera, nodes) {
    if (this._parent) {
      var self = this;
      function __test(nodes) {
        // Iterate backwards so we always test the nodes that are drawn on top first.
        for (var i = nodes.length-1; i >= 0; --i) {
          if (nodes[i]._meta.bounds && self.__inRect(pos, nodes[i]._meta.bounds.rect, camera)) {
            return nodes[i];
          }
        }
        return null;
      };

      if (nodes === undefined) {
        return __test(this._parent._storageNodes) ||
               __test(this._parent._compositeNodes) ||
               __test(this._parent._processNodes) ||
               __test(this._parent._entryNodes);
      } else {
        return __test(nodes);
      }
    }
    return null;
  },

  /**
   * Finds the category area of the palette at a given position.
   * @function wcPlayEditor#__findCategoryAreaAtPos
   * @private
   * @param {wcPlay~Coordinates} pos - The position.
   * @returns {Object|null} - The category data found, or null if not found.
   */
  __findCategoryAreaAtPos: function(pos) {
    for (var cat in this._nodeLibrary) {
      for (var type in this._nodeLibrary[cat]) {

        // Ignore types that are not visible.
        if (!this.$typeButton[this.__typeIndex(type)].hasClass('wcToggled')) continue;

        var typeData = this._nodeLibrary[cat][type];

        // Ignore categories that are not visible.
        if (typeData.$button.hasClass('wcToggled')) continue;

        var rect = typeData.$canvas.offset();
        rect.width = typeData.$canvas.width();
        rect.height = typeData.$canvas.height();
        if (this.__inRect(pos, rect)) {
          return typeData;
        }
      }
    }

  },
};