/**
 * Created by n3b on 04.02.14.
 */
Map = function()
{
    this.width = 30;
    this.height = 20;
    this.shifts = [-30, 1, 30, -1];

    var map = {};

    for( var i = 0, p = this.width * this.height; i < p; i++ ) {
        map[i] = 1;
    };

    this.lock = function(index)
    {
        if( index > -1 ) map[index] = 0;
    };

    this.unlock = function(index)
    {
        if( index > -1 ) map[index] = 1;
    };

    this.isLocked = function(index)
    {
        return ! map[index];
    };

    this.next = function(index, direction)
    {
        var mod = index % 30;
        if( ( 3 === direction && 0 === mod ) || ( 1 === direction && this.width - 1 === mod ) ) return null;

        var next = index + this.shifts[direction];
        var locked = this.isLocked(next);
        if( locked ) return null;

        return next;
    };

    this.matrix = function()
    {
        return map;
    };
};

Position = function(map)
{
    var last = [];
    var index = -1;

    this.move = function(x, y)
    {
        last.push(index);
        index = undefined === y ? x : ( y * 30 + x );
        map.lock(index);
        return this;
    };

    this.unmove = function()
    {
        map.unlock(index);
        index = last.pop();
        return index;
    };

    this.index = function() { return index; };
    this.clear = function() { while( this.unmove() ) {} };
    this.history = function() { var ret = last; ret.unshift(index); return ret; };
}

Voronoi = function(map)
{
    var owned = {};
    var available = {};
    var q = [];

    this.calculate = function(positions)
    {
        owned = {}, available = {};
        for( var k in positions )
        {
            var index = positions[k].index();
            owned[index] = k;
            available[k] = 0;
            q.push(index);
        }

        while( q.length )
        {
            var index = q.shift();
            var player = owned[index];

            for( var i = 0; i < 4; i++ )
            {
                var next = map.next(index, i);
                if( null === next ) continue;

                if( undefined !== owned[next] ) continue;

                owned[next] = player;
                available[player]++;

                var next2 = map.next(next, map.shifts[i]);
                if( undefined === owned[next2] ) {
                    q.push(next);
                }

            }
        }
    };

    this.available = function(player)
    {
        return available[player];
    };
};

Components = function(map)
{
    var visited = {}, q = [], spaces = {}, component;
    var num = {}, low = {}, vertex = {}, node;

    var calculateNeighborsDeep = function(component, index, parent)
    {
        if( undefined !== visited[index] ) return;

        var curnode = ++node;
        visited[index] = component;

        low[component][index] = num[component][index] = curnode;
        var children = 0;

        for( var i = 0; i < 4; i++ )
        {
            var next = map.next(index, i);
            if( null === next ) continue;

            if( undefined === num[component][next] )
            {
                children++;
                spaces[component]++;
                calculateNeighborsDeep(component, next, curnode);

                if( low[component][next] >= curnode && parent !== -1 ) {
                    vertex[component][index] = 1;
                }

                if( low[component][next] < low[component][index] )
                    low[component][index] = low[component][next];
            }
            else if( num[component][next] < curnode && num[component][next] < low[component][index] )
            {
                low[component][index] = num[component][next];
            }
        }

        if( -1 === parent && children > 1 ) {
            vertex[component][index] = 1;
        }
    }

    this.calculate = function()
    {
        visited = {};
        spaces = {};
        component = 0;
        num = {}, low = {}, vertex = {}, node = 0;

        for( var i = 0, p = map.width * map.height; i < p; i++ )
        {
            if( undefined !== visited[i] ) continue;
            if( map.isLocked(i) ) {
                visited[i] = 0;
                continue;
            }
            component++;
            vertex[component] = {};
            num[component] = {};
            low[component] = {};
            spaces[component] = 0;
            calculateNeighborsDeep(component, i, -1);
        }
    };

    this.spaces = function(index)
    {
        return spaces[this.component(index)] || 0;
    };

    this.component = function(index)
    {
        return visited[index] || 0;
    };

    this.isVertex = function(index)
    {
        if( undefined === vertex[this.component(index)] ) return false;
        return vertex[this.component(index)][index];
    };

    this.isVertexAtDirection = function(position, direction)
    {
        var next = map.next(position.index(), direction);
        if( null === next ) return false;
        return vertex[this.component(next)][next];
    };
}

Strategy = function(map, voronoi, components)
{
    this.fill = function(position)
    {
        var best = -1, direction = 0;

        for( var i = 0; i < 4; i++ )
        {
            var next = map.next(position.index(), i);
            if( null === next ) continue;

            position.moveDirection(i);
            components.calculate();

            var vertexes = 0;
            var spaces = 0;

            for( var n = 0; n < 4; n++ ) {
                var next2 = map.next(position.index(), n);
                if( null === next2 ) continue;

                if( components.isVertex(next2) ) vertexes++;
                spaces = Math.max(components.spaces(next2), spaces);
            }

            var value = vertexes < spaces ? spaces - vertexes : spaces;

            position.unmove();

            if( value > best )
            {
                best = value;
                direction = i;
            }
        }

        return direction;
    };

    this.attack = function(positions, myIndex, enemyIndex)
    {
        var direction = 0;
        var best = - map.width * map.height;
        for( var i = 0; i < 4; i++ )
        {
            var next = map.next(positions[myIndex].index(), i);
            if( null === next ) continue;

            positions[myIndex].move(next);

            var worst = map.width * map.height;
            for( var n = 0; n < 4; n++ )
            {
                var next2 = map.next(positions[enemyIndex].index(), n);
                if( null === next2 ) continue;

                positions[enemyIndex].move(next2);
                voronoi.calculate(positions);
                var val2 = voronoi.available(myIndex) - voronoi.available(enemyIndex);
                positions[enemyIndex].unmove();

                if( val2 < worst )
                    worst = val2;
            }

            positions[myIndex].unmove();

            if( worst > best ) {
                best = worst;
                direction = i;
            }
        }

        return direction;
    };
};




var map = new Map;
var voronoi = new Voronoi(map);
var components = new Components(map);
var strategy = new Strategy(map, voronoi, components);
var positions = {};
var directions = ['UP', 'RIGHT', 'DOWN', 'LEFT', 'Uh, maaan...'];
var data = [], distances = [];
var myIndex, myCoords, myComponent, direction = null;;

var move = 0;

while(1)
{
    move++;
    var first =  readline().split(' ');
    myIndex = parseInt(first[1]);

    for( var i = 0; i < parseInt(first[0]); i++ ) {

        var tmp = readline().split(' ');
        data[i] = [parseInt(tmp[0]), parseInt(tmp[1]), parseInt(tmp[2]), parseInt(tmp[3])]

        if( undefined === positions[i] ) {
            positions[i] = new Position(map);
            positions[i].move(data[i][0], data[i][1]);
        }

        if( -1 === data[i][2] && -1 === data[i][3] )
            positions[i].clear();
        else
            positions[i].move(data[i][2], data[i][3]);
    }


    if( ! ( parseInt(first[0]) > 3 && move < 3 ) )
    {
        myCoords = data[myIndex];

        for( var i = 0; i < data.length; i++ )
        {
            if( i !== myIndex && data[i][2] > -1 && data[i][3] > -1 )
            {
                var coords = data[i];
                distances.push(
                    [i, Math.sqrt( Math.pow(coords[2] - myCoords[2], 2) + Math.pow(coords[3] - myCoords[3], 2))]
                );
            }
        }

        distances.sort(function(a, b){ return a[1] - b[1]; });
        var closest;

        while( closest = distances.shift() )
        {
            printErr('attack', closest[0]);
            direction = strategy.attack(positions, myIndex, closest[0]);
        }
    }

    if( null === direction ) {
        printErr('fill');
        direction = strategy.fill(positions[first[1]]);
    }

    print(directions[direction]);
}
