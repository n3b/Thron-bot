/**
 * Created by n3b on 06.02.14.
 */
Node = function(map, index)
{
    this.locked = false;
    this.id = index;
    this.edges = 0;
    this.neighbors = {};
    this.visited = 0;
    this.next = function(d) { return this.neighbors[d] && !this.neighbors[d].isLocked() ? this.neighbors[d] : null; }; //todo
    this.add = function(d, node) { if( this.neighbors[d] ) return; this.neighbors[d] = node; node.add(d > 1 ? d - 2 : d + 2, this); this.edges++ };
    this.remove = function(d){ this.neighbors[d] = null; this.edges-- };
    this.lock = function(){ this.locked = true };
    this.unlock = function(){ this.locked = false };
    this.isLocked = function(){ return this.locked };
    this.index = function(){ return index; };
    this.toString = function(){return this.id};
};

Map = function()
{
    this.width = 30;
    this.height = 20;
    var nodes = {};

    this.lock = function(index){ nodes[index] && nodes[index].lock(); };
    this.unlock = function(index){ nodes[index] && nodes[index].unlock() };
    this.isLocked = function(index){ return nodes[index] && nodes[index].isLocked() };
    this.nodes = function(){ return nodes; };
    this.next = function(index, d){ return nodes[index].next(d) };
    this.node = function(x, y){ return undefined === y ? nodes[x] : nodes[x + y * 30]; };

    for( var i = 0, p = this.width * this.height; i < p; i++ ) {
        var node = new Node(this, i);
        nodes[i] = node;
        if( i > 29 ) nodes[i - 30].add(0, node);
        if( i % 30 > 0 ) nodes[i - 1].add(3, node);
    };
};

Position = function(map, id)
{
    var last = [];
    var node;
    this.direction = null;
    this.id = id;

    this.move = function(x, y){ node && last.push(node); node = map.node(x, y); node.lock(); return this; };
    this.unmove = function(){ map.unlock(node); node = last.pop(); };
    this.node = function(){ return node; };
    this.clear = function(){ while(this.node()){ this.unmove() } };
    this.history = function(){ var ret = last; ret.push(node); return ret; };
    this.next = function(d){ return node.next(d) };
    this.toString = function(){ return this.id; };
};

Voronoi = function()
{
    var run = 0;
    var available = {};
    var voronoi = {};
    var owned, available, target, distances, battlefront, neightbors, q = [], bf;

    this.calculate = function(positions, my)
    {
        run++;
        owned = [], available = [], distances = [], battlefront = [], target = null, neightbors = {}, bf = null;
        var next, visited = [], ownedNext, node, player;

        for( var k in positions ) {
            node = positions[k].node();
            owned[node] = positions[k];
            available[positions[k]] = 0;
            q.push(node);
            distances[node] = 0;
        }

        while( q.length )
        {
            node = q.shift();
            if( run === node.visited ) continue;
            node.visited = run;
            player = owned[node];

            for( var i = 0; i < 4; i++ )
            {
                next = node.next(i);
                if( ! next ) continue;

                ownedNext = owned[next];
                if( player === ownedNext ) continue;

                if( ownedNext ) {
                    if( player === my ) {
                        bf = Math.min(bf || Number.MAX_VALUE, distances[node]);
                        if( null === target ) target = ownedNext;
                    } else if( ownedNext === my ) {
                        bf = Math.min(bf || Number.MAX_VALUE, distances[next]);
                        if( null === target ) target = player;
                    }
                    continue;
                }

                owned[next] = player;
                available[player]++;
                distances[next] = distances[node] + 1;

                if( ! owned[next.next(i)] )
                    q.push(next);
            }
        }
    };

    this.owned = function() { return owned; };

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
        var best = -Number.MAX_VALUE, sub = -Number.MAX_VALUE;

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

                var val = components.countEdges(next2) - components.countSpaces(next2) - 2 * components.countNodeEdges(next2);

                if( components.isVertex(next2) ) val -= 4;
                if( sub < val ) sub = val;
            }

            position.unmove();

            if( best < sub ) {
                best = sub;
                direction = i;
            }
        }

        return direction;
    };

    this.attack = function(positions, myIndex, enemyIndex)
    {
        var direction = 0;
        var best = - map.width * map.height;
        var battlefront = voronoi.battlefront();
        var ps = {};
        ps[myIndex] = positions[myIndex];
        ps[enemyIndex] = positions[enemyIndex];

        for( var i = 0; i < 4; i++ )
        {
            var next = map.next(positions[myIndex].index(), i);
            if( null === next ) continue;

            positions[myIndex].move(next);
            voronoi.calculate(ps, myIndex);
            var bf = voronoi.bf();

            var best2 = - map.width * map.height;
            for( var n = 0; n < 4; n++ )
            {
                var next2 = map.next(positions[enemyIndex].index(), n);
                if( null === next2 ) continue;

                positions[enemyIndex].move(next2);
                voronoi.calculate(ps, myIndex);
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



//var map = new Map;
//var voronoi = new Voronoi(map);
//var components = new Components(map);
//var strategy = new Strategy(map, voronoi, components);
//var positions = {};
//var directions = ['UP', 'RIGHT', 'DOWN', 'LEFT', 'You Touch My Tralala)'];
//var move = 0;
//
//while(1)
//{
//    move++;
//    var direction = null;
//    var myIndex;
//    var data = [];
//
//
//    var first =  readline().split(' ');
//    myIndex = parseInt(first[1]);
//
//    for( var i = 0; i < parseInt(first[0]); i++ ) {
//
//        var tmp = readline().split(' ');
//        data[i] = [parseInt(tmp[0]), parseInt(tmp[1]), parseInt(tmp[2]), parseInt(tmp[3])]
//
//        if( undefined === positions[i] ) {
//            positions[i] = new Position(map);
//            positions[i].move(data[i][0], data[i][1]);
//        }
//
//        if( -1 === data[i][2] && -1 === data[i][3] )
//            positions[i].clear();
//        else
//            positions[i].move(data[i][2], data[i][3]);
//    }
//
//    voronoi.calculate(positions, myIndex);
//    var target = voronoi.target();
//
//    if( target ) {
//        printErr('attack');
//        direction = strategy.attack(positions, myIndex, target);
//    }
//
//    if( null === direction ) {
//        printErr('fill');
//        direction = strategy.fill(positions[myIndex]);
//    }
//
//    if( undefined === directions[direction] ) direction = 4;
//    print(directions[direction]);
//}
