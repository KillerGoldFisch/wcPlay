wcPlayNodes.wcNodeComposite.extend('wcNodeCompositeScript', 'Composite', 'Imported', {
  /**
   * A composite script node. These are nodes that contain additional nodes inside.
   * @class wcNodeCompositeScript
   * @param {string} parent - The parent object of this node.
   * @param {wcPlay~Coordinates} pos - The position of this node in the visual editor.
   * @param {wcNode[]} [nodes] - An optional set a nodes to use, instead of it's default behavior of generating a new set of nodes. Use this when porting existing nodes into a new composite.
   */
  init: function(parent, pos, nodes) {
    this._super(parent, pos);

    this.description('A node that contains its own set of nodes. Double click to view and edit its contents.');
    this.details('Composite nodes can also be generated from an external script file using the "File->Import" option. Doing so will allow you to load the entire script into a single Composite Node that appears in the Palette on the left side.');

    this._entryNodes = [];
    this._processNodes = [];
    this._storageNodes = [];
    this._compositeNodes = [];

    if (Array.isArray(nodes)) {
      for (var i = 0; i < nodes.length; ++i) {
        this.__addNode(nodes[i]);
        nodes[i]._parent = this;
      }
    }
  },

  /**
   * Gets or sets whether this node is paused, or any nodes inside if it is a composite.
   * <br>When pausing, all {@link wcNode#setTimeout} events are also paused so they don't jump ahead of the debugger.
   * @function wcNode#paused
   * @param {boolean} paused - If supplied, will assign a new paused state.
   * @returns {boolean} - Whether this, or inner nodes, are paused.
   */
  paused: function(paused) {
    var result = false, i = 0;
    for (i = 0; i < this._compositeNodes.length; ++i) {
      result |= this._compositeNodes[i].paused(paused);
    }
    for (i = 0; i < this._entryNodes.length; ++i) {
      result |= this._entryNodes[i].paused(paused);
    }
    for (i = 0; i < this._processNodes.length; ++i) {
      result |= this._processNodes[i].paused(paused);
    }
    for (i = 0; i < this._storageNodes.length; ++i) {
      result |= this._storageNodes[i].paused(paused);
    }

    return this._super(paused) || result;
  },

  /**
   * Compiles all nodes inside this composite into meta-data.
   * @function wcNodeCompositeScript#compile
   * @param {boolean} [minimal] - If true, only the most important data should be exported, this means current values and redundant link connections are omitted.
   */
  compile: function(minimal) {
    this.compiledNodes = [];

    function __compileNodes(nodes) {
      for (var i = 0; i < nodes.length; ++i) {
        this.compiledNodes.push(nodes[i].export(minimal));
      }
    }

    __compileNodes.call(this, this._compositeNodes);
    __compileNodes.call(this, this._entryNodes);
    __compileNodes.call(this, this._storageNodes);
    __compileNodes.call(this, this._processNodes);
  },

  /**
   * Loads the contents of this node based on its compiled data.
   * @function wcNodeCompositeScript#decompile
   * @param {Object} [idMap] - If supplied, overrides node id's with those that are mapped here.
   */
  decompile: function(idMap) {
    this.onDestroying();

    var engine = this.engine();
    var newNodes = [], i = 0, data = null;

    if (this.compiledNodes && engine) {
      var nodeLibrary = engine.nodeLibrary();
      for (i = 0; i < this.compiledNodes.length; ++i) {
        data = this.compiledNodes[i];
        if (wcPlayNodes[data.className]) {
          if (nodeLibrary.has(data.className)) {
            var newNode = new wcPlayNodes[data.className](this, data.pos, data.name);
            if (idMap) {
              idMap[data.id] = newNode.id;
            } else {
              newNode.id = data.id;
            }
            newNodes.push(newNode);
          } else {
            console.log('ERROR: Attempted to load node "' + data.className + '", but this script does not include it within its library of valid node types!');
            newNodes.push(null);
          }
        } else {
          console.log('ERROR: Attempted to load node "' + data.className + '", but the constructor could not be found!');
          newNodes.push(null);
        }
      }
      for (i = 0; i < this.compiledNodes.length; ++i) {
        if (newNodes[i]) {
          data = this.compiledNodes[i];
          newNodes[i].import(data, idMap);
        }
      }
    }
  },

  /**
   * Retrieves a node from a given ID, if it exists in this script.
   * @function wcNodeCompositeScript#nodeById
   * @param {number} id - The ID of the node.
   * @returns {wcNode|null} - Either the found node, or null.
   */
  nodeById: function(id) {
    var i = 0;
    for (i = 0; i < this._entryNodes.length; ++i) {
      if (this._entryNodes[i].id === id) {
        return this._entryNodes[i];
      }
    }
    for (i = 0; i < this._processNodes.length; ++i) {
      if (this._processNodes[i].id === id) {
        return this._processNodes[i];
      }
    }
    for (i = 0; i < this._storageNodes.length; ++i) {
      if (this._storageNodes[i].id === id) {
        return this._storageNodes[i];
      }
    }
    for (i = 0; i < this._compositeNodes.length; ++i) {
      if (this._compositeNodes[i].id === id) {
        return this._compositeNodes[i];
      }
    }

    for (i = 0; i < this._compositeNodes.length; ++i) {
      if (this._compositeNodes[i].instanceOf('wcNodeCompositeScript')) {
        var found = this._compositeNodes[i].nodeById(id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  },

  /**
   * Retrieves a list of nodes that match a given class name, if they exists in this script.
   * @function wcPlay#nodesByClassName
   * @param {string} className - The className of the nodes to retrieve.
   * @returns {wcNode[]} - A list of all found nodes.
   */
  nodesByClassName: function(className) {
    var result = [], i = 0;
    for (i = 0; i < this._compositeNodes.length; ++i) {
      if (this._compositeNodes[i].className === className) {
        result.push(this._compositeNodes[i]);
      }
    }
    for (i = 0; i < this._entryNodes.length; ++i) {
      if (this._entryNodes[i].className === className) {
        result.push(this._entryNodes[i]);
      }
    }
    for (i = 0; i < this._processNodes.length; ++i) {
      if (this._processNodes[i].className === className) {
        result.push(this._processNodes[i]);
      }
    }
    for (i = 0; i < this._storageNodes.length; ++i) {
      if (this._storageNodes[i].className === className) {
        result.push(this._storageNodes[i]);
      }
    }

    for (i = 0; i < this._compositeNodes.length; ++i) {
      if (this._compositeNodes[i].instanceOf('wcNodeCompositeScript')) {
        var found = this._compositeNodes[i].nodesByClassName(className);
        if (found.length) {
          result = result.concat(found);
        }
      }
    }
    return result;
  },

  /**
   * Retrieves a list of nodes that match a given search filter.
   * @function wcPlay#nodesBySearch
   * @param {string} search - The search value.
   * @returns {wcNode[]} - A list of all found nodes.
   */
  nodesBySearch: function(search) {
    var result = [], i = 0;
    for (i = 0; i < this._compositeNodes.length; ++i) {
      if (this._compositeNodes[i].search(search)) {
        result.push(this._compositeNodes[i]);
      }
    }
    for (i = 0; i < this._entryNodes.length; ++i) {
      if (this._entryNodes[i].search(search)) {
        result.push(this._entryNodes[i]);
      }
    }
    for (i = 0; i < this._processNodes.length; ++i) {
      if (this._processNodes[i].search(search)) {
        result.push(this._processNodes[i]);
      }
    }
    for (i = 0; i < this._storageNodes.length; ++i) {
      if (this._storageNodes[i].search(search)) {
        result.push(this._storageNodes[i]);
      }
    }

    for (i = 0; i < this._compositeNodes.length; ++i) {
      if (this._compositeNodes[i].instanceOf('wcNodeCompositeScript')) {
        var found = this._compositeNodes[i].nodesBySearch(search);
        if (found.length) {
          result = result.concat(found);
        }
      }
    }
    return result;
  },

  /**
   * Called by a child composite link node to notify and sort entry links based on position.
   * @function wcNodeCompositeScript#sortEntryLinks
   */
  sortEntryLinks: function() {
    var order = [], i = 0;
    // Find the Composite Entry nodes and order our entry links based on their x position.
    for (i = 0; i < this._compositeNodes.length; ++i) {
      var node = this._compositeNodes[i];
      if (node.instanceOf('wcNodeCompositeEntry')) {
        order.push({
          name: node.name,
          pos: node.pos.x
        });
      }
    }

    order.sort(function(a, b) {
      return a.pos - b.pos;
    });

    var oldLinks = this.chain.entry;

    var oldOrder = [];
    for (i = 0; i < oldLinks.length; ++i) {
      oldOrder.push(oldLinks[i].name);
    }

    this.chain.entry = [];
    for (i = 0; i < order.length; ++i) {
      var name = order[i].name;
      for (var a = 0; a < oldLinks.length; ++a) {
        if (oldLinks[a].name === name) {
          this.chain.entry.push(oldLinks[a]);
        }
      }
    }

    // Check to see if our order has changed.
    for (i = 0; i < oldOrder.length; ++i) {
      if (this.chain.entry.length <= i || this.chain.entry[i].name !== oldOrder[i]) {
        this._meta.dirty = true;
        break;
      }
    }
  },

  /**
   * Called by a child composite link node to notify and sort exit links based on position.
   * @function wcNodeCompositeScript#sortExitLinks
   */
  sortExitLinks: function() {
    var order = [], i = 0;
    // Find the Composite Exit nodes and order our exit links based on their x position.
    for (i = 0; i < this._compositeNodes.length; ++i) {
      var node = this._compositeNodes[i];
      if (node.instanceOf('wcNodeCompositeExit')) {
        order.push({
          name: node.name,
          pos: node.pos.x
        });
      }
    }

    order.sort(function(a, b) {
      return a.pos - b.pos;
    });

    var oldLinks = this.chain.exit;

    var oldOrder = [];
    for (i = 0; i < oldLinks.length; ++i) {
      oldOrder.push(oldLinks[i].name);
    }

    this.chain.exit = [];
    for (i = 0; i < order.length; ++i) {
      var name = order[i].name;
      for (var a = 0; a < oldLinks.length; ++a) {
        if (oldLinks[a].name === name) {
          this.chain.exit.push(oldLinks[a]);
        }
      }
    }

    // Check to see if our order has changed.
    for (i = 0; i < oldOrder.length; ++i) {
      if (this.chain.exit.length <= i || this.chain.exit[i].name !== oldOrder[i]) {
        this._meta.dirty = true;
        break;
      }
    }
  },

  /**
   * Called by a child composite link node to notify and sort property links based on position.
   * @function wcNodeCompositeScript#sortPropertyLinks
   */
  sortPropertyLinks: function() {
    var order = [], i = 0;
    // Find the Composite Property nodes and order our property links based on their y position.
    for (i = 0; i < this._compositeNodes.length; ++i) {
      var node = this._compositeNodes[i];
      if (node.instanceOf('wcNodeCompositeProperty')) {
        order.push({
          name: node.name,
          pos: node.pos.y
        });
      }
    }

    order.sort(function(a, b) {
      return a.pos - b.pos;
    });

    var oldProperties = this.properties;

    var oldOrder = [];
    for (i = 0; i < oldProperties.length; ++i) {
      oldOrder.push(oldProperties[i].name);
    }

    this.properties = [oldProperties[0]];
    oldProperties.splice(0, 1);
    for (i = 0; i < order.length; ++i) {
      var name = order[i].name;
      for (var a = 0; a < oldProperties.length; ++a) {
        if (oldProperties[a].name === name) {
          this.properties.push(oldProperties[a]);
          oldProperties.splice(a, 1);
          a--;
        }
      }
    }

    // Check to see if our order has changed.
    for (i = 0; i < oldOrder.length; ++i) {
      if (this.properties.length <= i || this.properties[i].name !== oldOrder[i]) {
        this._meta.dirty = true;
        break;
      }
    }
  },

  /**
   * Check children nodes, if any one is awake, this node should also be awake.
   * <br>Event that is called when this node is about to be drawn.
   * <br>Overload this in inherited nodes, be sure to call 'this._super(..)' at the top.
   * @function wcNodeCompositeScript#onDraw
   */
  onDraw: function() {
    this._super();
    this._meta.awake = false;
    var i = 0;

    for (i = 0; i < this._entryNodes.length; ++i) {
      if (this._entryNodes[i]._meta.awake) {
        this._meta.awake = true;
        this._meta.flash = true;
        return;
      }
    }
    for (i = 0; i < this._processNodes.length; ++i) {
      if (this._processNodes[i]._meta.awake) {
        this._meta.awake = true;
        this._meta.flash = true;
        return;
      }
    }
    for (i = 0; i < this._storageNodes.length; ++i) {
      if (this._storageNodes[i]._meta.awake) {
        this._meta.awake = true;
        this._meta.flash = true;
        return;
      }
    }
    for (i = 0; i < this._compositeNodes.length; ++i) {
      if (this._compositeNodes[i].instanceOf('wcNodeCompositeScript')) {
        this._compositeNodes[i].onDraw();
      }

      if (this._compositeNodes[i]._meta.awake) {
        this._meta.awake = true;
        this._meta.flash = true;
        return;
      }
    }
  },

  /**
   * Event that is called when an entry link has been activated.
   * <br>Overload this in inherited nodes, be sure to call 'this._super(..)' at the top.
   * @function wcNodeCompositeScript#onActivated
   * @param {string} name - The name of the entry link triggered.
   */
  onActivated: function(name) {
    this._super(name);

    // Find the Composite Entry node that matches the triggered entry.
    for (var i = 0; i < this._compositeNodes.length; ++i) {
      var node = this._compositeNodes[i];
      if (node.instanceOf('wcNodeCompositeEntry')) {
        if (node.name === name) {
          node._activeTracker = this._activeTracker;
          node.onActivated();
          node._activeTracker = null;
          break;
        }
      }
    }
  },

  /**
   * Event that is called when a property has changed.
   * <br>Overload this in inherited nodes, be sure to call 'this._super(..)' at the top.
   * @function wcNodeCompositeScript#onPropertyChanged
   * @param {string} name - The name of the property.
   * @param {Object} oldValue - The old value of the property.
   * @param {Object} newValue - The new value of the property.
   */
  onPropertyChanged: function(name, oldValue, newValue) {
    this._super(name, oldValue, newValue);

    // Find all Composite Property nodes that match the changed property.
    for (var i = 0; i < this._compositeNodes.length; ++i) {
      var node = this._compositeNodes[i];
      if (node.instanceOf('wcNodeCompositeProperty')) {
        if (node.name === name) {
          node.property('value', newValue, true);
        }
      }
    }
  },

  /**
   * Event that is called when the node is about to be imported. This is your chance to prepare the node for import, or possibly modify the import data.
   * <br>Overload this in inherited nodes, be sure to call 'this._super(..)' at the top.
   * @function wcNodeCompositeScript#onImporting
   * @param {Object} data - The data being imported.
   * @param {Number[]} [idMap] - If supplied, identifies a mapping of old ID's to new ID's, any not found in this list will be unchanged.
   */
  onImporting: function(data, idMap) {
    this.compiledNodes = data.nodes;
    this.decompile(idMap);

    this._super(data, idMap);
  },

  /**
   * Event that is called when the node is being exported, after the export data has been configured.
   * <br>Overload this in inherited nodes, be sure to call 'this._super(..)' at the top.
   * @function wcNodeCompositeScript#onExport
   * @param {Object} data - The export data for this node.
   * @param {boolean} [minimal] - If true, only the most important data should be exported, this means current values and redundant link connections are omitted.
   */
  onExport: function(data, minimal) {
    this._super(data, minimal);

    // Export the current set of nodes into our data.
    this.compile(minimal);
    data.nodes = this.compiledNodes;
  },

  /**
   * Event that is called when the node is about to be reset.
   * <br>Overload this in inherited nodes, be sure to call 'this._super(..)' at the top.
   * @function wcNodeCompositeScript#onReset
   */
  onReset: function() {
    this._super();
    var i = 0;

    for (i = 0; i < this._compositeNodes.length; ++i) {
      this._compositeNodes[i].reset();
    }
    for (i = 0; i < this._entryNodes.length; ++i) {
      this._entryNodes[i].reset();
    }
    for (i = 0; i < this._processNodes.length; ++i) {
      this._processNodes[i].reset();
    }
    for (i = 0; i < this._storageNodes.length; ++i) {
      this._storageNodes[i].reset();
    }
  },

  /**
   * Event that is called after the node has been destroyed.
   * <br>Overload this in inherited nodes, be sure to call 'this._super(..)' at the top.
   * @function wcNodeCompositeScript#onDestroyed
   */
  onDestroyed: function() {
    this._super();
    var i = 0;

    for (i = 0; i < this._entryNodes.length; ++i) {
      this._entryNodes[i].destroy();
    }
    for (i = 0; i < this._processNodes.length; ++i) {
      this._processNodes[i].destroy();
    }
    for (i = 0; i < this._storageNodes.length; ++i) {
      this._storageNodes[i].destroy();
    }
    for (i = 0; i < this._compositeNodes.length; ++i) {
      this._compositeNodes[i].destroy();
    }
    this._entryNodes = [];
    this._processNodes = [];
    this._storageNodes = [];
    this._compositeNodes = [];
  },

  /**
   * Sends a custom notification event to all nodes.
   * @function wcNodeCompositeScript#notifyNodes
   * @private
   * @param {string} func - The node function to call.
   * @param {Object[]} args - A list of arguments to forward into the function call.
   */
  notifyNodes: function(func, args) {
    var self = null, i = 0;
    for (i = 0; i < this._storageNodes.length; ++i) {
      self = this._storageNodes[i];
      if (typeof self[func] === 'function') {
        self[func].apply(self, args);
      }
    }
    for (i = 0; i < this._processNodes.length; ++i) {
      self = this._processNodes[i];
      if (typeof self[func] === 'function') {
        self[func].apply(self, args);
      }
    }
    for (i = 0; i < this._entryNodes.length; ++i) {
      self = this._entryNodes[i];
      if (typeof self[func] === 'function') {
        self[func].apply(self, args);
      }
    }
    for (i = 0; i < this._compositeNodes.length; ++i) {
      self = this._compositeNodes[i];
      if (typeof self[func] === 'function') {
        self[func].apply(self, args);
      }
    }

    for (i = 0; i < this._compositeNodes.length; ++i) {
      if (this._compositeNodes[i].instanceOf('wcNodeCompositeScript')) {
        this._compositeNodes[i].notifyNodes(func, args);
      }
    }
  },

  /**
   * Adds a node into the known node stacks.
   * @function wcNodeCompositeScript#__addNode
   * @private
   * @param {wcNode} node - The node to add.
   */
  __addNode: function(node) {
    if (node.instanceOf('wcNodeEntry')) {
      this._entryNodes.push(node);
    } else if (node.instanceOf('wcNodeProcess')) {
      this._processNodes.push(node);
    } else if (node.instanceOf('wcNodeStorage')) {
      this._storageNodes.push(node);
    } else if (node.instanceOf('wcNodeComposite')) {
      this._compositeNodes.push(node);
    }
  },

  /**
   * Removes a node from the known node stacks.
   * @function wcNodeCompositeScript#__removeNode
   * @private
   * @param {wcNode} node - The node to remove.
   * @returns {boolean} - Fails if the node was not found in this script.
   */
  __removeNode: function(node) {
    var index = -1;
    if (node.instanceOf('wcNodeEntry')) {
      index = this._entryNodes.indexOf(node);
      if (index > -1) {
        this._entryNodes.splice(index, 1);
      }
    } else if (node.instanceOf('wcNodeProcess')) {
      index = this._processNodes.indexOf(node);
      if (index > -1) {
        this._processNodes.splice(index, 1);
      }
    } else if (node.instanceOf('wcNodeStorage')) {
      index = this._storageNodes.indexOf(node);
      if (index > -1) {
        this._storageNodes.splice(index, 1);
      }
    } else if (node.instanceOf('wcNodeComposite')) {
      index = this._compositeNodes.indexOf(node);
      if (index > -1) {
        this._compositeNodes.splice(index, 1);
      }
    }

    // If the node was not found, propagate the removal to all composite nodes.
    if (index === -1) {
      for (var i = 0; i < this._compositeNodes.length; ++i) {
        if (this._compositeNodes[i].instanceOf('wcNodeCompositeScript') &&
            this._compositeNodes[i].__removeNode(node)) {
          return true;
        }
      }
    }

    return false;
  }
});
