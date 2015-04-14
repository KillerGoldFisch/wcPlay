var _fs        = require('fs');
var _uglifyJS  = require('uglify-js');
var _uglifyCSS = require('uglifycss');

function concat(opts) {
    var fileList = opts.src;
    var distPath = opts.dest;
    var out = fileList.map(function(filePath){
            return _fs.readFileSync(filePath).toString();
        });
    _fs.writeFileSync(distPath, out.join('\n'));
    console.log(' '+ distPath +' built.');
}

function uglifyJS(srcPath, distPath) {
    var
      jsp = _uglifyJS.parser,
      pro = _uglifyJS.uglify,
      ast = jsp.parse( _fs.readFileSync(srcPath).toString() );
 
    ast = pro.ast_mangle(ast);
    ast = pro.ast_squeeze(ast);

var header = '\
/*!\n\
 * Web Cabin Play - Node based visual scripting tool.\n\
 *\n\
 * Dependancies:\n\
 *  JQuery 1.11.1\n\
 *  font-awesome 4.2.0\n\
 *\n\
 * Author: Jeff Houde (lochemage@webcabin.org)\n\
 * Web: http://play.webcabin.org/\n\
 *\n\
 * Licensed under\n\
 *   MIT License http://www.opensource.org/licenses/mit-license\n\
 *\n\
 */\n';

     _fs.writeFileSync(distPath, header + pro.gen_code(ast));
    console.log(' '+ distPath +' built.');
}

function uglifyCSS(srcPath, distPath) {
    var
      pro = _uglifyCSS.processString,
      ast = _fs.readFileSync(srcPath).toString();
 
    _fs.writeFileSync(distPath, pro(ast, {uglyComments:false}));
    console.log(' '+ distPath +' built.');
}



// Combine the source files
concat({
  src: [
    '../Code/docker.js',
    '../Code/ghost.js',
    '../Code/layout.js',
    '../Code/panel.js',
    '../Code/frame.js',
    '../Code/splitter.js',
    '../Code/collapser.js',
    '../Code/drawer.js',
    '../Code/tabframe.js',
    '../Code/iframe.js',
  ],
  dest: '../Build/wcDocker.js',
});

concat({
  src: [
    '../Code/style.css',
  ],
  dest: '../Build/wcDocker.css',
});

// Move the un-minified version to the build folder.
concat({
  src: [
    '../Themes/default.css',
  ],
  dest: '../Build/Themes/default.css',
});
concat({
  src: [
    '../Themes/bigRed.css',
  ],
  dest: '../Build/Themes/bigRed.css',
});
concat({
  src: [
    '../Themes/shadow.css',
  ],
  dest: '../Build/Themes/shadow.css',
});
concat({
  src: [
    '../Themes/ideDark.css',
  ],
  dest: '../Build/Themes/ideDark.css',
});


// Now minify them. 
uglifyJS('../Build/wcDocker.js', '../Build/wcDocker.min.js');
uglifyCSS('../Build/wcDocker.css', '../Build/wcDocker.min.css');

uglifyCSS('../Themes/default.css', '../Build/Themes/default.min.css');
uglifyCSS('../Themes/bigRed.css', '../Build/Themes/bigRed.min.css');
uglifyCSS('../Themes/shadow.css', '../Build/Themes/shadow.min.css');
uglifyCSS('../Themes/ideDark.css', '../Build/Themes/ideDark.min.css');
