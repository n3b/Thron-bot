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
    var owned, available, target, distances, battlefront, neightbors, q = [], bf;

        var owned, available, target, distances, battlefront, neightbors, q = [], bf;

    var distances2 = {};

    this.calculate = function(positions, myIndex)
    {
        owned = {}, available = {}, distances = {}, battlefront = {}, target = null, neightbors = {}, bf = null;

        for( var k in positions )
        {
            var index = positions[k].index();
            owned[index] = k;
            available[k] = 0;
            q.push(index);
            neightbors[k] = {};
            distances[index] = 0;
        }

        while( q.length )
        {
            var index = q.shift();
            var player = owned[index];

            for( var i = 0; i < 4; i++ )
            {
                var next = map.next(index, i);
                if( null === next ) continue;

                var ownedNext = owned[next];
                if( undefined !== ownedNext )
                {
                    if( player == ownedNext ) continue;

                    if( player == myIndex ) {
                        bf = Math.min(bf || Number.MAX_VALUE, distances[index]);
                        if( null === target ) target = ownedNext;
                    } else if( player == ownedNext ) {
                        bf = Math.min(bf || Number.MAX_VALUE, distances[next]);
                        if( null === target ) target = player;
                    }

                    continue;
                }

                owned[next] = player;
                available[player]++;
                distances[next] = distances[index] + 1;
                q.push(next);
            }
        }
    };

    // space available
    this.available = function(player) { return available[player]; };
    this.distances = function() { return distances; };
    this.owned = function() { return owned; };
    this.battlefront = function() { return battlefront; };
    this.battlefront2 = function(index) { return battlefront[index]; };
    this.target = function() { return target; };
    this.bf = function() { return bf; };
    this.neighbors = function(player) { var count = 0; for(var i in neightbors) count++; return count; };
};

Components = function(map)
{
    this.visited = {}, this.spaces = {}, this.num = {}, this.low = {}, this.vertex = {}, this.node = 0,
        this.edges = {};

    this.calculateNeighborsDeep = function(component, index, parent)
    {
        if( undefined !== this.visited[index] ) return;
        this.spaces[component]++;

        var curnode = ++this.node;
        this.visited[index] = component;

        this.low[component][index] = this.num[component][index] = curnode;
        var children = 0;
        var edges = 0;

        for( var i = 0; i < 4; i++ )
        {
            var next = map.next(index, i);
            if( null === next ) continue;

            edges++;

            if( undefined === this.num[component][next] )
            {
                children++;

                this.calculateNeighborsDeep(component, next, curnode);

                if( this.low[component][next] >= curnode && parent !== -1 ) {
                    this.vertex[component][index] = 1;
                }

                if( this.low[component][next] < this.low[component][index] )
                    this.low[component][index] = this.low[component][next];
            }
            else if( this.num[component][next] < curnode && this.num[component][next] < this.low[component][index] )
            {
                this.low[component][index] = this.num[component][next];
            }
        }

        if( -1 === parent && children > 1 ) {
            this.vertex[component][index] = 1;
        }

        this.nodeEdges[index] = edges;
        this.edges[component] += edges;
    };

    this.calculate = function(index)
    {
        this.visited = {}, this.spaces = {}, this.num = {}, this.low = {}, this.vertex = {}, this.node = 0;
        this.nodeEdges = {};
        var component = 0;

        for( var i = 0; i < 4; i++ )
        {
            var next = map.next(index, i);
            if( null === next ) continue;

            if( undefined !== this.visited[next] ) continue;

            component++;
            this.vertex[component] = {};
            this.num[component] = {};
            this.low[component] = {};
            this.edges[component] = 0;
            this.spaces[component] = 0;
            this.calculateNeighborsDeep(component, next, -1);
        }
    };

    this.countSpaces = function(index)
    {
        return this.spaces[this.component(index)] || 0;
    };

    this.countEdges = function(index)
    {
        return this.edges[this.component(index)];
    };

    this.countNodeEdges = function(index)
    {
        return this.nodeEdges[index];
    };

    this.component = function(index)
    {
        return this.visited[index] || 0;
    };

    this.isVertex = function(index)
    {
        if( undefined === this.vertex[this.component(index)] ) return false;
        return this.vertex[this.component(index)][index];
    };

    this.isVertexAtDirection = function(position, direction)
    {
        var next = map.next(position.index(), direction);
        if( null === next ) return false;
        return this.vertex[this.component(next)][next];
    };
}

Strategy = function(map, voronoi, components)
{
    this.fill = function(position)
    {
        var best = -Number.MAX_VALUE;

        for( var i = 0; i < 4; i++ )
        {
            var next = map.next(position.index(), i);
            if( null === next ) continue;

            position.move(next);
            components.calculate(position.index());

            for( var n = 0; n < 4; n++ )
            {
                var next2 = map.next(position.index(), n);
                if( null === next2 ) continue;

//                var val = components.countEdges(next2) - components.countSpaces(next2) - 2 * components.countNodeEdges(next2);
                var val = components.countSpaces(next2);

//                if( components.isVertex(next2) ) val -= 4;

                if( best < val ) {
                    best = val;
                    direction = i;
                }
            }

            position.unmove();
        }

        return direction;
    };

    this.attack = function(positions, myIndex, enemyIndex)
    {
        var direction = 0;
        var best = - map.width * map.height;
        var battlefront = voronoi.battlefront();

        for( var i = 0; i < 4; i++ )
        {
            var next = map.next(positions[myIndex].index(), i);
            if( null === next ) continue;

            positions[myIndex].move(next);
            voronoi.calculate(positions, myIndex);
            var bf = voronoi.bf();

            var best2 = - map.width * map.height;
            for( var n = 0; n < 4; n++ )
            {
                var next2 = map.next(positions[enemyIndex].index(), n);
                if( null === next2 ) continue;

                positions[enemyIndex].move(next2);
                voronoi.calculate(positions, myIndex);
                var available = voronoi.available(myIndex) - voronoi.available(enemyIndex);
                positions[enemyIndex].unmove();

                if( available > best2 )
                    best2 = available;
            }

            positions[myIndex].unmove();

            best2 = best2 / (bf + 1);

            if( best2 > best ) {
                best = best2;
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
var directions = ['UP', 'RIGHT', 'DOWN', 'LEFT', 'You touch my tralala)'];
var move = 0;

while(1)
{
    move++;
    var direction = null;
    var myIndex;
    var data = [];


    var first =  readline().split(' ');
    myIndex = parseInt(first[1]);

    for( var i = 0; i < parseInt(first[0]); i++ ) {

        var tmp = readline().split(' ');
        data[i] = [parseInt(tmp[0]), parseInt(tmp[1]), parseInt(tmp[2]), parseInt(tmp[3])]

        if( undefined === positions[i] && data[i][2] > -1 ) {
            positions[i] = new Position(map);
            positions[i].move(data[i][0], data[i][1]);
        }

        if( data[i][2] < 0 ) {
            positions[i].clear();
            delete positions[i];
        }
        else positions[i].move(data[i][2], data[i][3]);
    }

    voronoi.calculate(positions, myIndex);
    var target = voronoi.target();

    if( target ) {
        printErr('attack');
        direction = strategy.attack(positions, myIndex, target);
    }

    if( null === direction ) {
        printErr('fill');
        direction = strategy.fill(positions[myIndex]);
    }

    if( undefined === directions[direction] ) direction = 4;
    print(directions[direction]);
}
