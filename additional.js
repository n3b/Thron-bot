Drawer = function()
{
    this.width = 30;
    this.height = 20;
    var map = {};
    var $p = $('p');

    for( var i = 0, p = this.width * this.height; i < p; i++ ) {
        map[i] = $('<div></div>').data('index', i);
        map[i].appendTo('blockquote');
    };

    $('blockquote').on('mousemove', function(e){
        if( 'DIV' !== e.target.tagName ) return;
        var $div = $(e.target);
        var index = $div.data('index');
        $p.html(index + '<br />x: ' + index % 30 + ', y: ' + Math.floor(index / 30));
    });

    this.clear = function() { for( var i in map ) map[i].attr('class', ''); };

    this.set = function(index, color)
    {
        map[index] && map[index].attr('class', color);
    };

    this.unset = function(index)
    {
        map[index] && map[index].attr('class', '');
    };

    this.draw = function(matrix, color, invert)
    {
        for( var i in matrix ){
            if( invert && matrix[i] ) this.set(i, color);
            else if( ! invert && ! matrix[i] ) this.set(i, color);
        }

    };

    this.drawNodes = function(nodes, color)
    {
        for( var i in nodes ) nodes[i] && this.set(nodes[i].id, color);
    };

    this.drawNodesMulti = function(nodes, colors)
    {
        var counters = {};
        for( var i in colors ) counters[colors[i]] = 0;

        for( var i in nodes ) {
            if( nodes[i] ) {
                this.set(i, colors[nodes[i]]);
//                nodes[i].vertex && this.set(i, 'black');
                counters[colors[nodes[i]]]++;
            }
        }
    };
};