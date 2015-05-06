$(document).ready(function() {
  // Create an instance of our Play engine.
  var myPlay = new wcPlay({
    silent: false,
    updateRate: 10,
    updateLimit: 100,
    debugging: true,
  });

  // Load a pre-developed script (Serial string was previously generated by wcPlay.save).
  myPlay.load('{"version":"1.0.0","properties":[{"name":"Run Custom","value":false,"initialValue":"true","type":"string","options":{}}],"nodes":[{"className":"wcNodeCompositeScript","id":281,"name":"Solution","color":"#990099","pos":{"x":-1165.3715247502928,"y":163.9337037835818},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":false}],"exitChains":[],"outputChains":[],"entryChains":[],"inputChains":[],"nodes":[{"className":"wcNodeCompositeProperty","id":352,"name":"enabled","color":"#990099","pos":{"x":-742.9749000056651,"y":-83.80862042427128},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"value","initialValue":false}],"exitChains":[],"outputChains":[{"inName":"enabled","inNodeId":351,"outName":"value","outNodeId":352}],"entryChains":[],"inputChains":[]},{"className":"wcNodeEntryUpdate","id":351,"name":"","color":"#CCCC00","pos":{"x":-468.1957748114141,"y":-70.6643316826066},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":false},{"name":"milliseconds","initialValue":250}],"exitChains":[{"inName":"in","inNodeId":275,"outName":"out","outNodeId":351}],"outputChains":[{"inName":"not","inNodeId":353,"outName":"enabled","outNodeId":351}],"entryChains":[],"inputChains":[]},{"className":"wcNodeStorageToggle","id":353,"name":"","color":"#009900","pos":{"x":-223.5172843251466,"y":-84.06145595669729},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"not","initialValue":false},{"name":"value","initialValue":true}],"exitChains":[],"outputChains":[{"inName":"value","inNodeId":354,"outName":"value","outNodeId":353}],"entryChains":[],"inputChains":[]},{"className":"wcNodeStorageGlobal","id":354,"name":"Run Custom","color":"#77CC77","pos":{"x":62.06892257140535,"y":-68.93830324733777},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"value","initialValue":"true"}],"exitChains":[],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessGameCanMove","id":275,"name":"","color":"#007ACC","pos":{"x":-458.3447837595367,"y":100.19893644729949},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"direction","initialValue":"left"}],"exitChains":[{"inName":"in","inNodeId":276,"outName":"yes","outNodeId":275},{"inName":"in","inNodeId":277,"outName":"no","outNodeId":275}],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessGameMove","id":276,"name":"","color":"#007ACC","pos":{"x":-514.6059325808912,"y":261.8104246608423},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"direction","initialValue":"left"}],"exitChains":[],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessGameCanMove","id":277,"name":"","color":"#007ACC","pos":{"x":-329.6975967407238,"y":262.8040950174327},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"direction","initialValue":"forward"}],"exitChains":[{"inName":"in","inNodeId":278,"outName":"yes","outNodeId":277},{"inName":"in","inNodeId":378,"outName":"no","outNodeId":277}],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessGameMove","id":278,"name":"","color":"#007ACC","pos":{"x":-421.9370517036386,"y":417.8765893214156},"collapsed":false,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"direction","initialValue":"forward"}],"exitChains":[],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessGameMove","id":279,"name":"","color":"#007ACC","pos":{"x":-293.5656895840746,"y":580.6475398918002},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"direction","initialValue":"right"}],"exitChains":[],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessGameCanMove","id":378,"name":"","color":"#007ACC","pos":{"x":-202.5499451322656,"y":420.24108278644434},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"direction","initialValue":"right"}],"exitChains":[{"inName":"in","inNodeId":279,"outName":"yes","outNodeId":378},{"inName":"in","inNodeId":379,"outName":"no","outNodeId":378}],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessGameMove","id":379,"name":"","color":"#007ACC","pos":{"x":-100.59856882589881,"y":582.3839091991881},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"direction","initialValue":"backward"}],"exitChains":[],"outputChains":[],"entryChains":[],"inputChains":[]}]},{"className":"wcNodeEntryRemote","id":160,"name":"Goal","color":"#CCCC00","pos":{"x":-1161.6480366011892,"y":236.86051411867555},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true}],"exitChains":[{"inName":"in","inNodeId":161,"outName":"out","outNodeId":160}],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeEntryUpdate","id":224,"name":"Help me reach the stairs!","color":"#CCCC00","pos":{"x":-814.2540023807522,"y":11.178063326909067},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":"true"},{"name":"milliseconds","initialValue":250}],"exitChains":[{"inName":"in","inNodeId":215,"outName":"out","outNodeId":224}],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessAlert","id":161,"name":"","color":"#007ACC","pos":{"x":-1161.6987636179529,"y":318.8228405723202},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"message","initialValue":"You won!"}],"exitChains":[],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessGameMove","id":214,"name":"","color":"#007ACC","pos":{"x":-821.2697999443642,"y":338.4242610246492},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"direction","initialValue":"south"}],"exitChains":[],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessGameCanMove","id":215,"name":"","color":"#007ACC","pos":{"x":-793.5117027601457,"y":188.61552525269198},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"direction","initialValue":"south"}],"exitChains":[{"inName":"in","inNodeId":214,"outName":"yes","outNodeId":215}],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeStorageGlobal","id":355,"name":"Run Custom","color":"#77CC77","pos":{"x":-1187.6116725335444,"y":7.349959941217289},"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"value","initialValue":"true"}],"exitChains":[],"outputChains":[{"inName":"enabled","inNodeId":224,"outName":"value","outNodeId":355}],"entryChains":[],"inputChains":[]}]}');

  // Start execution of the script.
  myPlay.start();

  // Create an instance of our script editor.
  var myPlayEditor = new wcPlayEditor('.playContainer', {
    readOnly: false,
  });

  // Assign the current Play script to be rendered.
  myPlayEditor.engine(myPlay);





  // Now initialize our little demo game view, using CraftyJS
  var $game = $('.game');

  // Crafty.c("PlayerControls", {
  //   _keys: {
  //     UP_ARROW: 'north',
  //     DOWN_ARROW: 'south',
  //     RIGHT_ARROW: 'east',
  //     LEFT_ARROW: 'west',
  //     W: 'north',
  //     S: 'south',
  //     D: 'east',
  //     A: 'west',
  //   }, 

  //   init: function() {
  //     for(var k in this._keys) {
  //       var keyCode = Crafty.keys[k] || k;
  //       this._keys[keyCode] = this._keys[k];
  //     }

  //     this.bind("KeyDown",function(e) {
  //       if(this._keys[e.key]) {
         
  //         var direction = this._keys[e.key];

  //         this.trigger('Slide', direction);
  //       }
  //     })
  //   }
    
  // });


  // Our slide component - listens for slide events
  // and smoothly slides to another tile location
  Crafty.c("Slide", {
    init: function() {
      this._stepFrames = 5;
      this._tileSize = 32;
      this._moving = false;
      this._vx = 0; this._destX = 0; this._sourceX = 0;
      this._vy = 0; this._destY = 0; this._sourceY = 0;
      this._frames = 0;
      this._hasWon = false;
      this._direction = 'south';

      function __getBackward(dir) {
        switch (dir) {
          case 'north': return 'south';
          case 'south': return 'north';
          case 'west':  return 'east';
          case 'east':  return 'west';
        }
      }

      function __getLeft(dir) {
        switch (dir) {
          case 'north': return 'west';
          case 'south': return 'east';
          case 'west':  return 'south';
          case 'east':  return 'north';
        }
      }

      function __getRight(dir) {
        switch (dir) {
          case 'north': return 'east';
          case 'south': return 'west';
          case 'west':  return 'north';
          case 'east':  return 'south';
        }
      }

      this.bind("Slide", function(dir) {
        // Don't continue to slide if we're already moving
        if(this._moving) return false;
        this._moving = true;

        var direction = [0,0];
        switch (dir) {
          case 'forward':  dir = this._direction;                break;
          case 'backward': dir = __getBackward(this._direction); break;
          case 'left':     dir = __getLeft(this._direction);     break;
          case 'right':    dir = __getRight(this._direction);    break;
          default:
        }

        switch (dir) {
          case 'north': direction = [0,-1]; break;
          case 'south': direction = [0,1];  break;
          case 'west':  direction = [-1,0]; break;
          case 'east':  direction = [1,0];  break;
        }

        // Let's keep our pre-movement location
        // Hey, Maybe we'll need it later :)
        this._sourceX = this.x;
        this._sourceY = this.y;

        // Figure out our destination
        this._destX = this.x + direction[0] * 32;
        this._destY = this.y + direction[1] * 32;

        // Get our x and y velocity
        this._vx = direction[0] * this._tileSize / this._stepFrames;
        this._vy = direction[1] * this._tileSize / this._stepFrames;

        if (this._direction !== dir) {
          this.removeComponent('hero' + this._direction);
          this._direction = dir;
          this.addComponent('hero' + this._direction);
        }

        this._frames = this._stepFrames;
      }).bind("EnterFrame", function(e) {
        if(!this._moving) return false;

        // If we're moving, update our position by our per-frame velocity
        this.x += this._vx;
        this.y += this._vy;
        this._frames--;

        if(this._frames == 0) {
          // If we've run out of frames,
          // move us to our destination to avoid rounding errors.
          this._moving = false;
          this.x = this._destX;
          this.y = this._destY;
        }
        this.trigger('Moved', {x: this.x, y: this.y});
      }).bind("CanSlide", function(obj) {
        obj.result = !this._moving;
      }).bind("OpenDirections", function(directions) {
        function c(v) {
          return Math.floor(Math.max(0, v));
        }
        directions.north = level[c(this.y/this._tileSize-1)][c(this.x/this._tileSize)];
        directions.south = level[c(this.y/this._tileSize+1)][c(this.x/this._tileSize)];
        directions.west  = level[c(this.y/this._tileSize)][c(this.x/this._tileSize-1)];
        directions.east  = level[c(this.y/this._tileSize)][c(this.x/this._tileSize+1)];

        directions.forward = directions[this._direction];
        directions.backward= directions[__getBackward(this._direction)];
        directions.left    = directions[__getLeft(this._direction)];
        directions.right   = directions[__getRight(this._direction)];
      });

    },

    slideFrames: function(frames) { 
       this._stepFrames = frames;
    },

    // A function we'll use later to 
    // cancel our movement and send us back to where we started
    cancelSlide: function() {
      this.x = this._sourceX;
      this.y = this._sourceY;
      this._moving = false;
    }
  });

  Crafty.c("Camera", {
    init: function() {},
    camera: function(obj) {
      this.set(obj);
      var self = this;
      obj.bind("Moved", function(location) {
        self.set(location);
      });
    },
    set: function(obj) {
      Crafty.viewport.x = -obj.x + Crafty.viewport.width / 2;
      Crafty.viewport.y = -obj.y + Crafty.viewport.height / 2;
    }
  });

  var mapData =
"																						\n\
	F	F	F	F	F		F	F	F	F	F	F	F	F	F	F	F	F	F	F	F	\n\
	F						F														F	\n\
	F		F	F	F	F	F				F	F	F	F	F						F	\n\
	F				F	F	F				F	F	F	F	F						F	\n\
	F				F	F	F		F	F	F	F	F	F	F						F	\n\
	F				F				F		F	F	F	F	F						F	\n\
	F	F	F	F	F	F	F	F	F		F	F	F	F	F						F	\n\
	F		F	F	F				F						F						F	\n\
	F		F	F	F		F	F	F	F	F	F	F		F	F	F	F	F		F	\n\
					F								F		F	F	F	F	F		F	\n\
	F	F	F	F	F		F	F	F	F	F		F		F	F	F	F	F		F	\n\
	F	F	F	F	F		F	F	F	F	F		F		F	F	F	F	F			\n\
	F	F	F	F	F		F	F	F	F	F		F		F	F	F	F	F		F	\n\
	F	F	F	F	F		F				F										F	\n\
	F	F	F	F	F	F	F	F	F		F	F	F	F	F	F	F	F	G		F	\n\
	F										F	F	F	F	F						F	\n\
	F	F	F		F	F	F	F	F		F	F	F	F	F	F	F	F	F		F	\n\
	F		F		F	F	F	F	F		F	F	F	F	F		F	F	F		F	\n\
	F		F		F	F	F	F	F		F	F	F	F	F		F	F	F		F	\n\
			F		F		F						F								F	\n\
	F	F	F	F	F		F	F	F	F	F		F	F	F	F	F	F	F		F	\n\
	F	F	F	F	F		F	F	F	F	F								F		F	\n\
	F	F	F	F	F		F	F	F	F	F		F	F	F	F	F	F	F		F	\n\
	F	F	F	F	F						F		F	F	F	F	F				F	\n\
	F	F	F	F	F	F	F				F		F	F	F	F	F				F	\n\
							F				F										F	\n\
	F	F	F	F	F	F	F				F	F	F	F	F	F	F	F	F	F	F	\n\
																						";
  var level = [];
  var assets = {
    sprites: {
      "dungeon.png": {
        tile: 32,
        tileh: 32,
        map: {
          floor: [0, 1],
          wall: [17, 0],
          goal: [3, 1]
        }
      },
      "characters.png": {
        tile: 32,
        tileh: 32,
        map: {
          heronorth: [0, 3],
          herosouth: [0, 0],
          heroeast:  [0, 2],
          herowest:  [0, 1]
        }
      }
    }
  };

  Crafty.paths({images: "Demo/"});

  //the loading screen that will display while our assets load
  Crafty.scene("loading", function() {
    Crafty.load(assets, function() {
      Crafty.scene("main"); //when everything is loaded, run the main scene
    });
  });
 
  Crafty.scene("main", function() {
    Crafty.background("#FFF");

    // Split out each row
    $.each(mapData.split("\n"), function(y, row) {
      var columns = row.split("\t");
      level.push(columns);
      // Then split out each column
      $.each(columns, function(x, column) {
        if(column === 'F') {
          Crafty.e("2D, Canvas, floor, Floor").attr({x:x*32, y:y*32});
        } else if (column === 'G') {
          Crafty.e("2D, Canvas, goal, Goal").attr({x:x*32, y:y*32});
        } else {
          Crafty.e("2D, Canvas, wall, Wall").attr({x:x*32, y:y*32});
        }
      });
    });

    var player = Crafty.e("2D, Canvas, PlayerControls, Slide, herosouth").attr({x:21*32, y:13*32});
    var camera = Crafty.e("Camera").camera(player);

    player.addComponent("Collision").onHit("Wall", function(obj) {
      this.cancelSlide();
    }).onHit("Goal", function(obj) {
      // Win condition.
      if (!this._hasWon) {
        this._hasWon = true;
        myPlay.triggerEvent('Remote Event', 'Goal');
      }
    });
  });

  Crafty.scene("loading");
  Crafty.init($game.width(), $game.height(), $game[0]).canvas.init();
});