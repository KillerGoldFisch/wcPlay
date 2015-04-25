wcNodeProcess.extend('wcNodeProcessExampleProperties', 'Example Properties', 'Example', {
  /**
   * @class
   * This node demonstrates an example of the different property types and how their values can be limited.
   * When inheriting, make sure to include 'this._super(parent, pos);' at the top of your init function.
   *
   * @constructor wcNodeProcessExampleProperties
   * @param {String} parent - The parent object of this node.
   * @param {wcPlay~Coordinates} pos - The position of this node in the visual editor.
   */
  init: function(parent, pos) {
    this._super(parent, pos);

    this.description("This node demonstrates an example of the different property types and how their values can be limited.");

    // Get rid of the flow links, as they do not function.
    this.removeEntry('in');
    this.removeExit('out');

    this.createProperty('toggle', wcPlay.PROPERTY.TOGGLE, true, {description: "Demonstration of the toggle property type."});
    this.createProperty('number', wcPlay.PROPERTY.NUMBER, 3, {description: "Demonstration of the number property type with a clamped range of 1-5.", min: 1, max: 5});
    this.createProperty('string', wcPlay.PROPERTY.STRING, 'Text', {description: "Demonstration of the string property with a max character length of 10.", maxlength: 10});
    this.createProperty('select', wcPlay.PROPERTY.SELECT, 3, {description: "Demonstration of the select property with a dynamic number of options based on the 'number' property.", items: this.selectItems});
  },

  /**
   * This function is used in the 'select' property to list a dynamic number of items that appear in edit combo box.
   * @function wcNodeProcessExampleProperties#selectItems
   * @returns {wcNode~SelectItem[]} - A list of items to populate in the combo box.
   */
  selectItems: function() {
    var result = [];

    var count = parseInt(this.property('number'));
    for (var i = 0; i < count; ++i) {
      result.push({
        name: 'Option ' + (i+1),
        value: i+1,
      });
    }

    return result;
  },
});