$(document).ready(function() {
  // Create an instance of our Play engine.
  var myPlay = new wcPlay({
    silent: false,
    updateRate: 10,
    updateLimit: 100,
    debugging: true,
  });

  // Load a pre-developed script (Serial string was previously generated by wcPlay.save).
  myPlay.load('{"properties":[],"nodes":[{"className":"wcNodeEntryStart","id":18,"name":"","color":"#CCCC00","x":-423.4728058482783,"y":82.59319069230193,"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true}],"exitChains":[{"inName":"in","inNodeId":26,"outName":"out","outNodeId":18}],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeEntryRemote","id":88,"name":"Looper","color":"#CCCC00","x":-180.94206153261962,"y":80.84123169589145,"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true}],"exitChains":[{"inName":"in","inNodeId":26,"outName":"out","outNodeId":88}],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeEntryCallRemote","id":89,"name":"Looper","color":"#CCCC00","x":-171.45743289019947,"y":817.0854098189068,"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"local","initialValue":true}],"exitChains":[],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessConsoleLog","id":19,"name":"","color":"#007ACC","x":-178.48999090590897,"y":360.6777002460762,"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"message","initialValue":"msg"}],"exitChains":[{"inName":"in","inNodeId":20,"outName":"out","outNodeId":19}],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessDelay","id":20,"name":"","color":"#007ACC","x":-178.48999090590902,"y":491.50404755146553,"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"milliseconds","initialValue":1000}],"exitChains":[{"inName":"add","inNodeId":21,"outName":"out","outNodeId":20}],"outputChains":[],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessOperation","id":21,"name":"","color":"#007ACC","x":-171.8928815316022,"y":641.114749672223,"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"valueA","initialValue":0},{"name":"valueB","initialValue":1},{"name":"result","initialValue":0}],"exitChains":[{"inName":"in","inNodeId":89,"outName":"out","outNodeId":21}],"outputChains":[{"inName":"value","inNodeId":22,"outName":"result","outNodeId":21}],"entryChains":[],"inputChains":[]},{"className":"wcNodeProcessStrCat","id":26,"name":"","color":"#007ACC","x":-178.29088910950182,"y":187.38428707242258,"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"valueA","initialValue":"Counter: "},{"name":"valueB","initialValue":0},{"name":"result","initialValue":"msg"}],"exitChains":[{"inName":"in","inNodeId":19,"outName":"out","outNodeId":26}],"outputChains":[{"inName":"message","inNodeId":19,"outName":"result","outNodeId":26}],"entryChains":[],"inputChains":[]},{"className":"wcNodeStorageNumber","id":22,"name":"","color":"#009900","x":-491.1882954471455,"y":612.2596963804712,"collapsed":true,"breakpoint":false,"properties":[{"name":"enabled","initialValue":true},{"name":"value","initialValue":0}],"exitChains":[],"outputChains":[{"inName":"valueA","inNodeId":21,"outName":"value","outNodeId":22},{"inName":"valueB","inNodeId":26,"outName":"value","outNodeId":22}],"entryChains":[],"inputChains":[]}]}');

  // Start execution of the script.
  myPlay.start();



  // Create an instance of our script editor.
  var myPlayEditor = new wcPlayEditor('.playContainer', {
    readOnly: false,
  });

  // Assign the current Play script to be rendered.
  myPlayEditor.engine(myPlay);

  // Create a second editor that links to the same wcPlay engine to test synchronization.
  if ($('.playContainer2').length) {
    var myPlayEditor2 = new wcPlayEditor('.playContainer2', {
      readOnly: false,
    });

    // Assign the current Play script to be rendered.
    myPlayEditor2.engine(myPlay);
  }
});